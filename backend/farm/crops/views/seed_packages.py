"""API endpoints for seed packages."""


from rest_framework import viewsets

from farm.common.mixins import ProjectRevisionMixin, ProjectScopedMixin
from farm.history import (
    _entity_display_name,
    _serialize_instance,
)
from farm.models import (
    EntityRevision,
    SeedPackage,
)

from ..serializers import (
    SeedPackageSerializer,
)


class SeedPackageViewSet(ProjectScopedMixin, ProjectRevisionMixin, viewsets.ModelViewSet):

    # Read-only for project-bound API tokens: agents may look these up to
    # resolve references, but changing them stays session-only in this
    # version (see farm/agent_api/permissions.py).
    api_token_actions = {'list', 'retrieve'}
    queryset = SeedPackage.objects.select_related('crop').all().order_by('size_unit', 'size_value')
    serializer_class = SeedPackageSerializer

    def perform_create(self, serializer):
        instance = serializer.save(project=self.request.active_project)
        self.record_revision(instance, EntityRevision.ACTION_CREATED)

    def perform_destroy(self, instance):
        package_id = instance.pk
        snapshot = _serialize_instance(instance)
        display_name = _entity_display_name(instance)
        instance.delete()
        self.record_revision(
            instance, EntityRevision.ACTION_DELETED,
            object_id=package_id, snapshot=snapshot, display_name=display_name, changed_fields=[],
        )
