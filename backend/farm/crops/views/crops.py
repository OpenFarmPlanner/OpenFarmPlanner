"""API endpoints for crops (CRUD, history, publish, undelete)."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.demo_access import guest_demo_forbidden_response, is_active_guest_demo_user
from accounts.consent import has_accepted_current, record_acceptance
from accounts.models import DocumentConsent
from farm.common.mixins import ProjectScopedMixin
from farm.history import (
    _build_entity_revision_changes,
    _current_actor_label,
)
from farm.history.serializers import CropHistoryEntrySerializer, CropRestoreSerializer
from farm.models import (
    Crop,
    EntityRevision,
    MediaFile,
    PlantingPlan,
    PublicCrop,
    Supplier,
    format_crop_display_name,
)
from farm.services.crop_import.field_specs import seed_rate_unit_constraints_payload
from farm.services.public_crops import (
    DuplicatePublicCropError,
    PublicCropPublishingValidationError,
    PublicCropUpdateBlockedError,
    build_public_crop_update_status,
    build_publishing_check_result,
    link_project_crop_to_public_reference,
    publish_crop_to_public_library,
    reject_public_crop_update,
)


from ..serializers import (
    CropSerializer,
    PublicCropSerializer,
)


def _request_boolean(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return False


class CropViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    """ViewSet for Crop model providing CRUD operations.
    
    Provides list, create, retrieve, update, and delete operations
    for crops and varieties.
    
    Attributes:
        queryset: All Crop objects ordered by name and variety
        serializer_class: CropSerializer for serialization
    """
    queryset = (
        Crop.objects
        .select_related('supplier', 'image_file', 'source_public_crop', 'crop_species')
        .prefetch_related('crop_species__translations')
    )
    serializer_class = CropSerializer

    # Actions reachable with a project-bound API token (see
    # farm/agent_api/permissions.py). `destroy` and `undelete` additionally
    # require the dedicated delete scope.
    api_token_actions = {
        'list',
        'retrieve',
        'create',
        'update',
        'partial_update',
        'destroy',
        'delete_preview',
        'duplicate_check',
        'seed_rate_constraints',
        'history',
        'undelete',
    }
    api_token_delete_actions = {'destroy', 'undelete'}

    def _set_latest_revision_actor(self, crop: Crop) -> None:
        actor_label = _current_actor_label(self.request)
        if not actor_label:
            return
        latest_revision = (
            EntityRevision.objects
            .filter(project_id=crop.project_id, entity_type='crop', object_id=crop.pk)
            .order_by('-id')
            .first()
        )
        if latest_revision and not latest_revision.user_name:
            latest_revision.user_name = actor_label[:150]
            latest_revision.save(update_fields=['user_name'])

    def _crop_group_q(self, crop: Crop) -> Q:
        if crop.crop_species_id is not None:
            return Q(project_id=crop.project_id, crop_species_id=crop.crop_species_id)
        return Q(project_id=crop.project_id, crop_species_id__isnull=True, name_normalized=crop.name_normalized)

    def _active_crop_group(self, crop: Crop):
        return (
            Crop.objects
            .filter(self._crop_group_q(crop))
            .select_related('crop_species')
            .order_by('id')
        )

    def _crops_affected_by_delete(self, crop: Crop) -> list[Crop]:
        group = list(self._active_crop_group(crop))
        has_general_entry = any(candidate.variety_normalized is None for candidate in group)
        deletes_whole_group = crop.variety_normalized is None or not has_general_entry
        if deletes_whole_group:
            return group
        return [crop]

    def _delete_preview_payload(self, crop: Crop) -> dict[str, object]:
        affected_crops = self._crops_affected_by_delete(crop)
        affected_ids = [affected.id for affected in affected_crops]
        varieties = [
            {
                'id': affected.id,
                'name': affected.variety or affected.name,
            }
            for affected in affected_crops
            if affected.variety_normalized is not None
        ]
        has_general_entry = any(
            candidate.variety_normalized is None
            for candidate in self._active_crop_group(crop)
        )
        planning_data_count = (
            PlantingPlan.objects
            .filter(project_id=crop.project_id, crop_id__in=affected_ids)
            .count()
        )
        return {
            'crop_ids': affected_ids,
            'varieties': varieties,
            'variety_count': len(varieties),
            'planning_data_count': planning_data_count,
            'deletes_general_crop': crop.variety_normalized is None,
            'group_without_general': crop.variety_normalized is not None and not has_general_entry,
        }

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self._set_latest_revision_actor(instance)
        auto_general_crop = getattr(instance, '_auto_general_crop', None)
        if auto_general_crop is not None:
            self._set_latest_revision_actor(auto_general_crop)

    def get_queryset(self):
        include_deleted = self.request.query_params.get('include_deleted') in {'1', 'true', 'True'}
        manager = Crop.all_objects if include_deleted else Crop.objects
        owned_public_crops_prefetch = Prefetch(
            'published_public_crops',
            # `crop_species` is read per row by the serializer's
            # `public_crop_species_pending` flag; without it every owned entry
            # costs one extra query.
            queryset=PublicCrop.objects.filter(
                status=PublicCrop.STATUS_PUBLISHED,
                created_by=self.request.user,
            ).select_related('crop_species').order_by('-updated_at', '-id'),
            to_attr='_prefetched_owned_public_crops',
        )
        return (
            manager
            .filter(project=self.request.active_project)
            .select_related(
                'supplier', 'image_file', 'source_public_crop',
                'source_public_crop__crop_species', 'crop_species',
            )
            .prefetch_related('supplier_data__supplier', 'seed_packages', 'crop_species__translations', owned_public_crops_prefetch)
        )

    @action(detail=False, methods=['get'], url_path='duplicate-check')
    def duplicate_check(self, request):
        """Check whether a crop identity already exists in the active project."""
        from farm.utils import normalize_text

        normalized_name = normalize_text(request.query_params.get('name'))
        normalized_variety = normalize_text(request.query_params.get('variety'))
        if not normalized_name:
            return Response({'exists': False})

        queryset = self.get_queryset()
        exclude_id = request.query_params.get('exclude_id')
        if exclude_id:
            try:
                queryset = queryset.exclude(pk=int(exclude_id))
            except (TypeError, ValueError):
                pass

        name_queryset = queryset.filter(name_normalized=normalized_name)
        identity_queryset = name_queryset.filter(variety_normalized=normalized_variety)
        # `name_exists` drives the "a general crop with this name already
        # exists" warning for crop creation, which mirrors what
        # `unique_general_crop_name_per_project` actually forbids — a
        # varietyless row with this name. It must not fire just because
        # variety-only rows (no general entry) happen to share the name, or
        # creating a general crop over an existing variety-only group
        # (see the cascade-delete "group without general" case) would be
        # blocked even though the backend allows it.
        general_name_queryset = name_queryset.filter(
            Q(variety_normalized__isnull=True) | Q(variety_normalized='')
        )

        return Response({
            'exists': identity_queryset.exists(),
            'name_exists': general_name_queryset.exists(),
        })

    @action(detail=False, methods=['get'], url_path='seed-rate-constraints')
    def seed_rate_constraints(self, request):
        """Return backend-owned seed-rate value constraints for crop forms."""
        return Response({'units': seed_rate_unit_constraints_payload()})

    def _resolve_supplier(self, crop_data: dict) -> Supplier | None:
        """Resolve supplier from crop data using supplier_id or supplier_name.
        
        :param crop_data: Dictionary containing crop data
        :return: Supplier instance or None
        """
        from farm.utils import normalize_supplier_name
        
        supplier_id = crop_data.get('supplier_id')
        supplier_name = crop_data.get('supplier_name')
        
        if supplier_id:
            # Project-scoped so a supplied id cannot pull in a supplier from
            # another project and attach it to this project's crop.
            try:
                return Supplier.objects.get(id=supplier_id, project=self.request.active_project)
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
    
    def _find_matching_crop(
        self,
        name: str,
        variety: str | None,
        supplier: Supplier | None,
        supplier_name: str | None = None,
    ) -> Crop | None:
        """Find existing crop by normalized fields.
        
        :param name: Crop name
        :param variety: Crop variety (optional)
        :param supplier: Supplier instance (optional)
        :param supplier_name: Supplier name from import data for legacy matching
        :return: Matching Crop instance or None
        """
        from farm.utils import normalize_supplier_name, normalize_text
        
        name_norm = normalize_text(name) or ''
        variety_norm = normalize_text(variety)

        # Scoped to the active project: without this filter an import row could
        # match — and then overwrite — a crop belonging to a different
        # project that happens to share a name/variety pair.
        base_queryset = Crop.objects.filter(
            project=self.request.active_project,
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
    
    def _compute_diff(self, existing_crop: Crop, import_data: dict) -> list[dict]:
        """Compute field differences between existing crop and import data.
        
        :param existing_crop: Existing Crop instance
        :param import_data: Dictionary of import data
        :return: List of field differences
        """
        diff = []
        serializer = CropSerializer(existing_crop)
        existing_data = serializer.data
        
        # Fields to compare (excluding read-only and auto-generated fields)
        comparable_fields = [
            'name', 'variety', 'notes', 'seed_supplier',
            'crop_family', 'nutrient_demand', 'cultivation_type',
            'growth_duration_days', 'harvest_duration_days', 'propagation_duration_days',
            'harvest_method', 'expected_yield',
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
        """Preview crop import without writing to database.
        
        Analyzes import data and returns status for each item:
        - 'create': New crop
        - 'update_candidate': Matches existing crop
        
        :param request: HTTP request containing array of crop objects
        :return: Response with preview results for each item
        """
        if not isinstance(request.data, list):
            return Response(
                {'message': 'Request body must be an array of crop objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        
        for idx, crop_data in enumerate(request.data):
            if not isinstance(crop_data, dict) or not crop_data.get('name'):
                results.append({
                    'index': idx,
                    'error': 'Entry must be an object with at least a "name" field.',
                    'import_data': crop_data
                })
                continue
            
            try:
                # Resolve supplier
                supplier = self._resolve_supplier(crop_data)
                
                # Find matching crop
                name = crop_data['name']
                variety = crop_data.get('variety', '')
                matching_crop = self._find_matching_crop(
                    name,
                    variety,
                    supplier,
                    crop_data.get('supplier_name') or crop_data.get('seed_supplier')
                )
                
                if matching_crop:
                    # Compute diff
                    diff = self._compute_diff(matching_crop, crop_data)
                    
                    results.append({
                        'index': idx,
                        'status': 'update_candidate',
                        'matched_crop_id': matching_crop.id,
                        'diff': diff,
                        'import_data': crop_data
                    })
                else:
                    results.append({
                        'index': idx,
                        'status': 'create',
                        'import_data': crop_data
                    })
            except Exception as e:
                results.append({
                    'index': idx,
                    'error': str(e),
                    'import_data': crop_data
                })
        
        return Response({'results': results}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='import/apply')
    def import_apply(self, request):
        """Apply crop import with optional update confirmation.
        
        Creates new crops and optionally updates existing ones.
        
        :param request: HTTP request with items array and confirm_updates flag
        :return: Response with import summary
        """
        items = request.data.get('items', [])
        confirm_updates = request.data.get('confirm_updates', False)
        
        if not isinstance(items, list):
            return Response(
                {'message': 'Items must be an array of crop objects.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for idx, crop_data in enumerate(items):
            if not isinstance(crop_data, dict) or not crop_data.get('name'):
                errors.append({
                    'index': idx,
                    'error': 'Entry must be an object with at least a "name" field.'
                })
                continue
            
            try:
                # Resolve supplier
                supplier = self._resolve_supplier(crop_data)
                if supplier:
                    crop_data['supplier'] = supplier.id
                
                # Find matching crop
                name = crop_data['name']
                variety = crop_data.get('variety', '')
                matching_crop = self._find_matching_crop(
                    name,
                    variety,
                    supplier,
                    crop_data.get('supplier_name') or crop_data.get('seed_supplier')
                )
                
                if matching_crop:
                    if confirm_updates:
                        # Update existing crop
                        serializer = CropSerializer(
                            matching_crop,
                            data=crop_data,
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
                    # Create new crop. `project` is read-only on the
                    # serializer, so it is assigned server-side from the active
                    # project here; any client-supplied project in the payload
                    # is intentionally ignored to keep imports project-scoped.
                    serializer = CropSerializer(data=crop_data)
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
        crop = self.get_object()
        if crop.deleted_at is not None:
            return Response(status=status.HTTP_204_NO_CONTENT)

        deleted_at = timezone.now()
        with transaction.atomic():
            for affected_crop in self._crops_affected_by_delete(crop):
                affected_crop.deleted_at = deleted_at
                affected_crop._history_action = EntityRevision.ACTION_DELETED
                affected_crop.save(update_fields=['deleted_at', 'updated_at'])
                self._set_latest_revision_actor(affected_crop)
                if affected_crop.image_file_id:
                    MediaFile.objects.filter(
                        id=affected_crop.image_file_id,
                        orphaned_at__isnull=True,
                    ).update(orphaned_at=deleted_at)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='delete-preview')
    def delete_preview(self, request, pk=None):
        crop = self.get_object()
        return Response(self._delete_preview_payload(crop), status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        crop = get_object_or_404(
            Crop.all_objects.filter(project=self.request.active_project),
            pk=pk,
        )
        deleted_at = crop.deleted_at
        crops_to_restore = [crop]
        if deleted_at is not None:
            crops_to_restore = list(
                Crop.all_objects
                .filter(self._crop_group_q(crop), deleted_at=deleted_at)
                .order_by('id')
            )
        with transaction.atomic():
            for restored_crop in crops_to_restore:
                restored_crop.deleted_at = None
                restored_crop._history_action = EntityRevision.ACTION_RESTORED
                restored_crop.save(update_fields=['deleted_at', 'updated_at'])
                self._set_latest_revision_actor(restored_crop)
                if restored_crop.image_file_id:
                    MediaFile.objects.filter(id=restored_crop.image_file_id).update(orphaned_at=None)
        return Response(self.get_serializer(crop).data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        instance = self.get_object()
        previous_media_id = instance.image_file_id
        old_name = instance.name
        old_crop_species_id = instance.crop_species_id
        with transaction.atomic():
            updated = serializer.save()
            self._set_latest_revision_actor(updated)
            auto_general_crop = getattr(updated, '_auto_general_crop', None)
            if auto_general_crop is not None:
                self._set_latest_revision_actor(auto_general_crop)
            if updated.name != old_name:
                self._rename_sibling_crops(updated, old_name, old_crop_species_id)
        if previous_media_id and previous_media_id != updated.image_file_id:
            MediaFile.objects.filter(id=previous_media_id, orphaned_at__isnull=True).update(orphaned_at=timezone.now())
        if updated.image_file_id:
            MediaFile.objects.filter(id=updated.image_file_id).update(orphaned_at=None)

    def _rename_sibling_crops(
        self, updated: Crop, old_name: str, old_crop_species_id: int | None,
    ) -> None:
        """Cascade a Crop's name change to its crop siblings.

        A "crop" has no dedicated table - it's just every Crop row that
        shares a name (or crop_species), grouped the same way the frontend's
        `getCropSpeciesKey` does. Without this, renaming one variety's own
        row leaves its siblings behind under the old name, which visually
        looks like a brand new crop was created instead of a rename.
        """
        from farm.utils import normalize_text

        siblings_qs = Crop.objects.filter(project_id=updated.project_id).exclude(pk=updated.pk)
        if old_crop_species_id:
            siblings_qs = siblings_qs.filter(crop_species_id=old_crop_species_id)
        else:
            siblings_qs = siblings_qs.filter(
                crop_species_id__isnull=True, name_normalized=normalize_text(old_name),
            )

        for sibling in siblings_qs:
            sibling.name = updated.name
            sibling.save(update_fields=['name', 'name_normalized', 'updated_at'])

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        crop = self.get_object()
        since = timezone.now() - timedelta(days=30)
        rows = list(
            EntityRevision.objects
            .filter(project_id=crop.project_id, entity_type='crop', object_id=crop.pk, created_at__gte=since)
            .order_by('-created_at')
        )
        current_revision_id = rows[0].id if rows else None
        payload = [
            {
                'history_id': row.id,
                'crop_id': row.object_id,
                'history_date': row.created_at,
                'history_type': 'snapshot',
                'history_user': row.user_name or None,
                'summary': ', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot',
                'object_type': 'crop',
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
        return Response(CropHistoryEntrySerializer(payload, many=True).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        lookup_value = self.kwargs.get(self.lookup_field, pk)
        crop = get_object_or_404(Crop.all_objects.all(), pk=lookup_value)
        serializer = CropRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision_id = serializer.validated_data['history_id']

        revision = get_object_or_404(
            EntityRevision.objects.filter(project_id=crop.project_id, entity_type='crop', object_id=crop.pk),
            id=revision_id,
        )
        snapshot = revision.snapshot
        allowed_fields = {f.name for f in Crop._meta.fields if f.name not in {'id', 'created_at', 'updated_at'}}

        with transaction.atomic():
            for key, value in snapshot.items():
                if key in allowed_fields:
                    setattr(crop, key, value)
            crop.deleted_at = None
            crop._history_action = EntityRevision.ACTION_RESTORED
            crop.save()
        self._set_latest_revision_actor(crop)

        return Response(self.get_serializer(crop).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='publish-public')
    def publish_public(self, request, pk=None):
        if is_active_guest_demo_user(request.user):
            return guest_demo_forbidden_response()
        crop = self.get_object()
        if not crop.name.strip():
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
            public_crop, duplicates, operation = publish_crop_to_public_library(
                crop=crop,
                user=request.user,
                crop_species_id=crop_species_id,
                original_language_code=request.data.get('original_language_code'),
                publish_as_general=_request_boolean(request.data.get('publish_as_general')),
            )
        except PublicCropPublishingValidationError as error:
            return Response(
                {
                    'code': 'public_crop_publishing_checks_failed',
                    'detail': 'Public crop publishing checks failed.',
                    'checks': self._serialize_publishing_check_result(error.check_result),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PublicCropUpdateBlockedError as error:
            return Response({
                'code': 'public_crop_update_blocked',
                'detail': 'The public entry has a newer version this copy has not taken over.',
                'reason': error.reason,
            }, status=status.HTTP_409_CONFLICT)
        except DuplicatePublicCropError as error:
            return Response({
                'code': 'duplicate_public_crop',
                'detail': 'A similar public crop already exists.',
                'duplicates': self._serialize_duplicates(error.duplicates),
                'normalized_identity': error.normalized_identity,
            }, status=status.HTTP_409_CONFLICT)
        if not has_library_consent:
            record_acceptance(request.user, DocumentConsent.DOCUMENT_PUBLIC_LIBRARY)
        serializer = PublicCropSerializer(public_crop, context={'request': request})
        return Response({
            'operation': operation,
            'public_crop': serializer.data,
            'duplicates': self._serialize_duplicates(duplicates),
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='link-public-crop')
    def link_public_crop(self, request: Request, pk: str | None = None) -> Response:
        crop = self.get_object()
        public_crop_id = request.data.get('public_crop_id')
        try:
            public_crop_id = int(public_crop_id)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'A valid public crop ID is required.', 'code': 'public_crop_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        public_crop = get_object_or_404(
            PublicCrop.objects.filter(status=PublicCrop.STATUS_PUBLISHED),
            pk=public_crop_id,
        )
        linked = link_project_crop_to_public_reference(crop=crop, public_crop=public_crop)
        serializer = self.get_serializer(linked)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='public-update')
    def public_update(self, request: Request, pk: str | None = None) -> Response:
        """Preview the pending library update for an imported crop.

        Read-only on purpose: nothing is copied into the project until the user
        confirms, at which point the frontend calls the existing
        `public-crops/<id>/import/` action with `mode=update` — the same
        entry point the library page uses, so both surfaces go through one
        import/update model.
        """
        crop = self.get_object()
        update_status = build_public_crop_update_status(crop)
        if update_status is None:
            return Response({'available': False})
        public_crop = update_status.public_crop
        return Response({
            'available': True,
            'public_crop_id': public_crop.id,
            'public_crop_name': format_crop_display_name(
                public_crop.name, public_crop.variety,
            ),
            'public_version': update_status.public_version,
            'local_version': update_status.local_version,
            'has_local_changes': update_status.has_local_changes,
            'is_rejected': update_status.is_rejected,
            'changes': [
                {
                    'field': change.field,
                    'local_value': change.local_value,
                    'public_value': change.public_value,
                }
                for change in update_status.changes
            ],
        })

    @action(detail=True, methods=['post'], url_path='public-update/reject')
    def reject_public_update(self, request: Request, pk: str | None = None) -> Response:
        """Record that the user declined the pending library version.

        The counterpart to confirming in the diff dialog: no library-sourced
        field is copied, only the decision is stored, so the notice disappears
        for exactly this public version. The diff itself stays reachable and a
        later public edit surfaces the notice again on its own.
        """
        crop = self.get_object()
        update_status = build_public_crop_update_status(crop)
        if update_status is None:
            return Response(
                {
                    'detail': 'There is no pending public update for this crop.',
                    'code': 'no_pending_public_update',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        reject_public_crop_update(crop)
        serializer = self.get_serializer(crop)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='publish-public/preview')
    def publish_public_preview(self, request, pk=None):
        crop = self.get_object()
        crop_species_id = request.query_params.get('crop_species_id')
        try:
            crop_species_id = int(crop_species_id) if crop_species_id else None
        except (TypeError, ValueError):
            crop_species_id = None
        result = build_publishing_check_result(
            crop=crop,
            crop_species_id=crop_species_id,
            original_language_code=request.query_params.get('original_language_code'),
            user=request.user,
            publish_as_general=_request_boolean(request.query_params.get('publish_as_general')),
        )
        return Response(self._serialize_publishing_check_result(result))

    def _serialize_duplicates(self, duplicates):
        return [
            {
                'id': item.id,
                'name': item.name,
                'variety': item.variety,
                'version': item.version,
                'published_at': item.published_at,
                'created_by_label': item.created_by_label,
                'is_mine': item.is_mine,
            }
            for item in duplicates
        ]

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
            'duplicates': self._serialize_duplicates(result.duplicates),
            'can_publish': result.can_publish,
            'general_crop_notice': (
                {
                    'public_crop_id': result.general_crop_notice.public_crop_id,
                    'updated_at': result.general_crop_notice.updated_at,
                    'is_stale': result.general_crop_notice.is_stale,
                    'is_incomplete': result.general_crop_notice.is_incomplete,
                }
                if result.general_crop_notice
                else None
            ),
        }
