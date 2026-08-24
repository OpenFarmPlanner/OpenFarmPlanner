"""Seed-demand list endpoint and supplier-selection POST."""


from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response

from config.languages import resolve_request_language
from farm.common.mixins import ProjectScopedMixin
from farm.models import (
    Culture,
    CultureSupplierData,
    Supplier,
)
from farm.project_context import resolve_season_id_from_request
from farm.services.seed_demand import build_seed_demand_rows, parse_selected_suppliers

from ..serializers import (
    SeedDemandSerializer,
)


class SeedDemandListView(ProjectScopedMixin, generics.ListAPIView):
    """Read-only endpoint returning typed seed demand aggregated by culture.

    The calculation itself lives in farm.services.seed_demand (see
    docs/seed-demand-calculation.md); this view only parses the request,
    delegates, and serializes the result.
    """

    serializer_class = SeedDemandSerializer

    def list(self, request, *args, **kwargs):
        rows = build_seed_demand_rows(
            project=request.active_project,
            selected_supplier_by_culture=parse_selected_suppliers(
                request.query_params.get('supplier_selection')
            ),
            language_code=resolve_request_language(request),
            season_id=resolve_season_id_from_request(request),
        )
        serializer = self.get_serializer(rows, many=True)
        return Response({'count': len(rows), 'next': None, 'previous': None, 'results': serializer.data})

    def post(self, request, *args, **kwargs):
        culture_id = request.data.get('culture_id')
        supplier_id = request.data.get('supplier_id')
        try:
            culture_id = int(culture_id)
        except (TypeError, ValueError):
            return Response({'detail': 'culture_id must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if culture_id <= 0:
            return Response({'detail': 'culture_id must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)

        culture = get_object_or_404(Culture, id=culture_id, project=request.active_project)

        if supplier_id in (None, ''):
            culture.selected_seed_demand_supplier = None
            culture.save(update_fields=['selected_seed_demand_supplier', 'updated_at'])
            return Response({'culture_id': culture.id, 'selected_supplier_id': None}, status=status.HTTP_200_OK)

        try:
            supplier_id = int(supplier_id)
        except (TypeError, ValueError):
            return Response({'detail': 'supplier_id must be an integer or null.'}, status=status.HTTP_400_BAD_REQUEST)

        supplier = get_object_or_404(Supplier, id=supplier_id, project=request.active_project)
        has_supplier_data = CultureSupplierData.objects.filter(
            project=request.active_project,
            culture=culture,
            supplier=supplier,
        ).exists()
        if not has_supplier_data:
            return Response({'detail': 'Supplier is not available for this culture.'}, status=status.HTTP_400_BAD_REQUEST)

        culture.selected_seed_demand_supplier = supplier
        culture.save(update_fields=['selected_seed_demand_supplier', 'updated_at'])
        return Response({'culture_id': culture.id, 'selected_supplier_id': supplier.id}, status=status.HTTP_200_OK)
