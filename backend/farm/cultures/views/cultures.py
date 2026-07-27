"""API endpoints for cultures (CRUD, history, publish, undelete)."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.consent import has_accepted_current, record_acceptance
from accounts.models import DocumentConsent
from crops.permissions import is_public_library_moderator
from farm.common.mixins import ProjectScopedMixin
from farm.history import (
    _build_entity_revision_changes,
    _current_actor_label,
)
from farm.history.serializers import CultureHistoryEntrySerializer, CultureRestoreSerializer
from farm.models import (
    Culture,
    EntityRevision,
    MediaFile,
    PublicCulture,
    Supplier,
)
from farm.project_context import get_active_project_or_400
from farm.services.public_cultures import (
    DuplicatePublicCultureError,
    PublicCulturePublishingValidationError,
    build_publishing_check_result,
    publish_culture_to_public_library,
)

from ..serializers import (
    CultureSerializer,
    PublicCultureSerializer,
)


class CultureViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    """ViewSet for Culture model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for crop cultures and varieties.
    
    Attributes:
        queryset: All Culture objects ordered by name and variety
        serializer_class: CultureSerializer for serialization
    """
    queryset = Culture.objects.select_related('supplier', 'image_file', 'source_public_culture')
    serializer_class = CultureSerializer

    def _set_latest_revision_actor(self, culture: Culture) -> None:
        actor_label = _current_actor_label(self.request)
        if not actor_label:
            return
        latest_revision = (
            EntityRevision.objects
            .filter(project_id=culture.project_id, entity_type='culture', object_id=culture.pk)
            .order_by('-id')
            .first()
        )
        if latest_revision and not latest_revision.user_name:
            latest_revision.user_name = actor_label[:150]
            latest_revision.save(update_fields=['user_name'])

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self._set_latest_revision_actor(instance)

    def get_queryset(self):
        include_deleted = self.request.query_params.get('include_deleted') in {'1', 'true', 'True'}
        manager = Culture.all_objects if include_deleted else Culture.objects
        public_cultures_queryset = PublicCulture.objects.filter(status=PublicCulture.STATUS_PUBLISHED)
        if not is_public_library_moderator(self.request.user):
            public_cultures_queryset = public_cultures_queryset.filter(created_by=self.request.user)
        owned_public_cultures_prefetch = Prefetch(
            'published_public_cultures',
            queryset=public_cultures_queryset.order_by('-updated_at', '-id'),
            to_attr='_prefetched_owned_public_cultures',
        )
        return (
            manager
            .filter(project=self.request.active_project)
            .select_related('supplier', 'image_file', 'source_public_culture')
            .prefetch_related('supplier_data__supplier', 'seed_packages', owned_public_cultures_prefetch)
        )

    @action(detail=False, methods=['get'], url_path='duplicate-check')
    def duplicate_check(self, request):
        """Check whether a culture identity already exists in the active project."""
        from farm.utils import normalize_text

        normalized_name = normalize_text(request.query_params.get('name'))
        normalized_variety = normalize_text(request.query_params.get('variety'))
        if not normalized_name or not normalized_variety:
            return Response({'exists': False})

        queryset = self.get_queryset().filter(
            name_normalized=normalized_name,
            variety_normalized=normalized_variety,
        )
        exclude_id = request.query_params.get('exclude_id')
        if exclude_id:
            try:
                queryset = queryset.exclude(pk=int(exclude_id))
            except (TypeError, ValueError):
                pass

        return Response({'exists': queryset.exists()})

    def _resolve_supplier(self, culture_data: dict) -> Supplier | None:
        """Resolve supplier from culture data using supplier_id or supplier_name.
        
        :param culture_data: Dictionary containing culture data
        :return: Supplier instance or None
        """
        from farm.utils import normalize_supplier_name
        
        supplier_id = culture_data.get('supplier_id')
        supplier_name = culture_data.get('supplier_name')
        
        if supplier_id:
            try:
                return Supplier.objects.get(id=supplier_id)
            except Supplier.DoesNotExist:
                return None
        elif supplier_name:
            normalized = normalize_supplier_name(supplier_name)
            if normalized:
                supplier, _ = Supplier.objects.get_or_create(
                    name_normalized=normalized,
                    project=self.request.active_project,
                    defaults={
                        'name': supplier_name,
                        'homepage_url': 'https://example.invalid',
                        'project': self.request.active_project,
                    },
                )
                return supplier
        
        return None
    
    def _find_matching_culture(
        self,
        name: str,
        variety: str | None,
        supplier: Supplier | None,
        supplier_name: str | None = None,
    ) -> Culture | None:
        """Find existing culture by normalized fields.
        
        :param name: Culture name
        :param variety: Culture variety (optional)
        :param supplier: Supplier instance (optional)
        :param supplier_name: Supplier name from import data for legacy matching
        :return: Matching Culture instance or None
        """
        from farm.utils import normalize_supplier_name, normalize_text
        
        name_norm = normalize_text(name) or ''
        variety_norm = normalize_text(variety)
        
        base_queryset = Culture.objects.filter(
            name_normalized=name_norm,
            variety_normalized=variety_norm,
        )

        # Prefer exact FK match when supplier could be resolved.
        if supplier:
            direct_match = base_queryset.filter(supplier=supplier).first()
            if direct_match:
                return direct_match

        # Fallback for legacy/partial imports: match supplier names case-insensitively,
        # whether supplier is stored as FK supplier or legacy seed_supplier text.
        supplier_name_normalized = normalize_supplier_name(supplier_name)
        if not supplier_name_normalized and supplier:
            supplier_name_normalized = supplier.name_normalized

        if supplier_name_normalized:
            for candidate in base_queryset.select_related('supplier'):
                candidate_supplier_normalized = normalize_supplier_name(
                    candidate.supplier.name if candidate.supplier else candidate.seed_supplier
                )
                if candidate_supplier_normalized == supplier_name_normalized:
                    return candidate

        # Final fallback: legacy behavior when no supplier information is available.
        return base_queryset.filter(supplier__isnull=True).first()
    
    def _compute_diff(self, existing_culture: Culture, import_data: dict) -> list[dict]:
        """Compute field differences between existing culture and import data.
        
        :param existing_culture: Existing Culture instance
        :param import_data: Dictionary of import data
        :return: List of field differences
        """
        diff = []
        serializer = CultureSerializer(existing_culture)
        existing_data = serializer.data
        
        # Fields to compare (excluding read-only and auto-generated fields)
        comparable_fields = [
            'name', 'variety', 'notes', 'seed_supplier',
            'crop_family', 'nutrient_demand', 'cultivation_type',
            'growth_duration_days', 'harvest_duration_days', 'propagation_duration_days',
            'harvest_method', 'expected_yield', 'allow_deviation_delivery_weeks',
            'distance_within_row_cm', 'row_spacing_cm', 'sowing_depth_cm',
            'seed_rate_value', 'seed_rate_unit', 'sowing_calculation_safety_percent',
            'seed_rate_direct_value', 'seed_rate_direct_unit', 'sowing_calculation_safety_percent_direct',
            'seed_rate_pre_cultivation_value', 'seed_rate_pre_cultivation_unit', 'sowing_calculation_safety_percent_pre_cultivation',
            'thousand_kernel_weight_g',
            'seeding_requirement', 'seeding_requirement_type', 'display_color'
        ]
        
        for field in comparable_fields:
            if field in import_data:
                import_value = import_data[field]
                existing_value = existing_data.get(field)
                
                # Normalize for comparison
                if import_value != existing_value:
                    # Special handling for None vs empty string
                    if (import_value == '' and existing_value is None) or \
                       (import_value is None and existing_value == ''):
                        continue
                    
                    diff.append({
                        'field': field,
                        'current': existing_value,
                        'new': import_value
                    })
        
        return diff
    
    @action(detail=False, methods=['post'], url_path='import/preview')
    def import_preview(self, request):
        """Preview culture import without writing to database.
        
        Analyzes import data and returns status for each item:
        - 'create': New culture
        - 'update_candidate': Matches existing culture
        
        :param request: HTTP request containing array of culture objects
        :return: Response with preview results for each item
        """
        if not isinstance(request.data, list):
            return Response(
                {'message': 'Request body must be an array of culture objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        
        for idx, culture_data in enumerate(request.data):
            if not isinstance(culture_data, dict) or not culture_data.get('name'):
                results.append({
                    'index': idx,
                    'error': 'Entry must be an object with at least a "name" field.',
                    'import_data': culture_data
                })
                continue
            
            try:
                # Resolve supplier
                supplier = self._resolve_supplier(culture_data)
                
                # Find matching culture
                name = culture_data['name']
                variety = culture_data.get('variety', '')
                matching_culture = self._find_matching_culture(
                    name,
                    variety,
                    supplier,
                    culture_data.get('supplier_name') or culture_data.get('seed_supplier')
                )
                
                if matching_culture:
                    # Compute diff
                    diff = self._compute_diff(matching_culture, culture_data)
                    
                    results.append({
                        'index': idx,
                        'status': 'update_candidate',
                        'matched_culture_id': matching_culture.id,
                        'diff': diff,
                        'import_data': culture_data
                    })
                else:
                    results.append({
                        'index': idx,
                        'status': 'create',
                        'import_data': culture_data
                    })
            except Exception as e:
                results.append({
                    'index': idx,
                    'error': str(e),
                    'import_data': culture_data
                })
        
        return Response({'results': results}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='import/apply')
    def import_apply(self, request):
        """Apply culture import with optional update confirmation.
        
        Creates new cultures and optionally updates existing ones.
        
        :param request: HTTP request with items array and confirm_updates flag
        :return: Response with import summary
        """
        items = request.data.get('items', [])
        confirm_updates = request.data.get('confirm_updates', False)
        
        if not isinstance(items, list):
            return Response(
                {'message': 'Items must be an array of culture objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for idx, culture_data in enumerate(items):
            if not isinstance(culture_data, dict) or not culture_data.get('name'):
                errors.append({
                    'index': idx,
                    'error': 'Entry must be an object with at least a "name" field.'
                })
                continue
            
            try:
                # Resolve supplier
                supplier = self._resolve_supplier(culture_data)
                if supplier:
                    culture_data['supplier'] = supplier.id
                
                # Find matching culture
                name = culture_data['name']
                variety = culture_data.get('variety', '')
                matching_culture = self._find_matching_culture(
                    name,
                    variety,
                    supplier,
                    culture_data.get('supplier_name') or culture_data.get('seed_supplier')
                )
                
                if matching_culture:
                    if confirm_updates:
                        # Update existing culture
                        serializer = CultureSerializer(
                            matching_culture,
                            data=culture_data,
                            partial=True
                        )
                        if serializer.is_valid():
                            serializer.save()
                            updated_count += 1
                        else:
                            errors.append({
                                'index': idx,
                                'error': serializer.errors
                            })
                    else:
                        # Skip update without confirmation
                        skipped_count += 1
                else:
                    # Create new culture. `project` is read-only on the
                    # serializer, so it is assigned server-side from the active
                    # project here; any client-supplied project in the payload
                    # is intentionally ignored to keep imports project-scoped.
                    serializer = CultureSerializer(data=culture_data)
                    if serializer.is_valid():
                        serializer.save(project=request.active_project)
                        created_count += 1
                    else:
                        errors.append({
                            'index': idx,
                            'error': serializer.errors
                        })
            except Exception as e:
                errors.append({
                    'index': idx,
                    'error': str(e)
                })
        
        return Response({
            'created_count': created_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'errors': errors
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        culture = self.get_object()
        if culture.deleted_at is not None:
            return Response(status=status.HTTP_204_NO_CONTENT)

        culture.deleted_at = timezone.now()
        culture._history_action = EntityRevision.ACTION_DELETED
        culture.save()
        self._set_latest_revision_actor(culture)

        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        culture = self.get_object()
        culture.deleted_at = None
        culture._history_action = EntityRevision.ACTION_RESTORED
        culture.save()
        self._set_latest_revision_actor(culture)
        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id).update(orphaned_at=None)
        return Response(self.get_serializer(culture).data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        instance = self.get_object()
        previous_media_id = instance.image_file_id
        updated = serializer.save()
        self._set_latest_revision_actor(updated)
        if previous_media_id and previous_media_id != updated.image_file_id:
            MediaFile.objects.filter(id=previous_media_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())
        if updated.image_file_id:
            MediaFile.objects.filter(id=updated.image_file_id).update(orphaned_at=None)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        culture = self.get_object()
        since = timezone.now() - timedelta(days=30)
        rows = list(
            EntityRevision.objects
            .filter(project_id=culture.project_id, entity_type='culture', object_id=culture.pk, created_at__gte=since)
            .order_by('-created_at')
        )
        current_revision_id = rows[0].id if rows else None
        payload = [
            {
                'history_id': row.id,
                'culture_id': row.object_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': ', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot',
                'object_type': 'culture',
                'object_display_name': row.display_name or None,
                'action': row.action,
                'actor_label': row.user_name or None,
                'is_current_version': row.id == current_revision_id,
                'changes': _build_entity_revision_changes(
                    row.snapshot,
                    rows[index + 1].snapshot if index + 1 < len(rows) else None,
                    row.changed_fields,
                ),
            }
            for index, row in enumerate(rows)
        ]
        return Response(CultureHistoryEntrySerializer(payload, many=True).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        lookup_value = self.kwargs.get(self.lookup_field, pk)
        culture = get_object_or_404(Culture.all_objects.all(), pk=lookup_value)
        serializer = CultureRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(
            EntityRevision.objects.filter(project_id=culture.project_id, entity_type='culture', object_id=culture.pk),
            id=revision_id,
        )
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Culture._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(culture, key, value)
            culture.deleted_at = None
            culture._history_action = EntityRevision.ACTION_RESTORED
            culture.save()
        self._set_latest_revision_actor(culture)

        return Response(self.get_serializer(culture).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='publish-public')
    def publish_public(self, request, pk=None):
        culture = self.get_object()
        if not culture.name.strip():
            return Response({'detail': 'Name is required for publishing.'}, status=status.HTTP_400_BAD_REQUEST)
        has_library_consent = has_accepted_current(request.user, DocumentConsent.DOCUMENT_PUBLIC_LIBRARY)
        accepted_library_terms = request.data.get('accepted_public_library_terms') is True
        if not has_library_consent and not accepted_library_terms:
            return Response({
                'code': 'public_library_terms_required',
                'detail': 'Public library contribution terms must be accepted before publishing.',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            crop_species_id = request.data.get('crop_species_id')
            try:
                crop_species_id = int(crop_species_id) if crop_species_id else None
            except (TypeError, ValueError):
                crop_species_id = None
            public_culture, duplicates, operation = publish_culture_to_public_library(
                culture=culture,
                user=request.user,
                crop_species_id=crop_species_id,
                original_language_code=request.data.get('original_language_code'),
            )
        except PublicCulturePublishingValidationError as error:
            return Response(
                {
                    'code': 'public_culture_publishing_checks_failed',
                    'detail': 'Public culture publishing checks failed.',
                    'checks': self._serialize_publishing_check_result(error.check_result),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DuplicatePublicCultureError as error:
            return Response({
                'code': 'duplicate_public_culture',
                'detail': 'A similar public culture already exists.',
                'duplicates': [
                    {
                        'id': item.id,
                        'name': item.name,
                        'variety': item.variety,
                        'version': item.version,
                        'published_at': item.published_at,
                        'created_by_label': item.created_by_label,
                    }
                    for item in error.duplicates
                ],
                'normalized_identity': error.normalized_identity,
            }, status=status.HTTP_409_CONFLICT)
        if not has_library_consent:
            record_acceptance(request.user, DocumentConsent.DOCUMENT_PUBLIC_LIBRARY)
        serializer = PublicCultureSerializer(public_culture)
        return Response({
            'operation': operation,
            'public_culture': serializer.data,
            'duplicates': [
                {
                    'id': item.id,
                    'name': item.name,
                    'variety': item.variety,
                    'version': item.version,
                    'published_at': item.published_at,
                    'created_by_label': item.created_by_label,
                }
                for item in duplicates
            ],
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='publish-public/preview')
    def publish_public_preview(self, request, pk=None):
        culture = self.get_object()
        crop_species_id = request.query_params.get('crop_species_id')
        try:
            crop_species_id = int(crop_species_id) if crop_species_id else None
        except (TypeError, ValueError):
            crop_species_id = None
        result = build_publishing_check_result(
            culture=culture,
            crop_species_id=crop_species_id,
            original_language_code=request.query_params.get('original_language_code'),
        )
        return Response(self._serialize_publishing_check_result(result))

    def _serialize_publishing_check_result(self, result):
        return {
            'crop_species': (
                {'id': result.crop_species.id, 'name': result.crop_species.name}
                if result.crop_species
                else None
            ),
            'original_language_code': result.original_language_code,
            'available_language_codes': result.available_language_codes,
            'missing_required_fields': [
                {'field': item.field, 'label_key': item.label_key}
                for item in result.missing_required_fields
            ],
            'duplicates': [
                {
                    'id': item.id,
                    'name': item.name,
                    'variety': item.variety,
                    'version': item.version,
                    'published_at': item.published_at,
                    'created_by_label': item.created_by_label,
                }
                for item in result.duplicates
            ],
            'can_publish': result.can_publish,
        }


class CultureUndeleteView(APIView):
    """Undelete a soft-deleted culture by ID."""

    def post(self, request, pk: int):
        active_project = get_active_project_or_400(request)
        culture = get_object_or_404(Culture.all_objects.filter(project=active_project), pk=pk)
        culture.deleted_at = None
        culture._history_action = EntityRevision.ACTION_RESTORED
        culture.save()
        if culture.image_file_id:
            MediaFile.objects.filter(id=culture.image_file_id).update(orphaned_at=None)
        return Response(CultureSerializer(culture).data, status=status.HTTP_200_OK)
