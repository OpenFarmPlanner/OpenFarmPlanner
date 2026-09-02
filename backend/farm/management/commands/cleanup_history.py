from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Max
from django.utils import timezone

from farm.models import BatchOperation, CropRevision, EntityRevision, ProjectRevision


class Command(BaseCommand):
    help = (
        'Delete history entries older than 30 days. For EntityRevision, the latest '
        'revision per (project, entity_type, object_id) is kept indefinitely so '
        'point-in-time project restore stays correct for entities that were never '
        'touched again after creation; CropRevision/ProjectRevision are legacy '
        'tables with a flat cutoff, draining until empty.'
    )

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)

        latest_ids = (
            EntityRevision.objects
            .values('project_id', 'entity_type', 'object_id')
            .annotate(latest_id=Max('id'))
            .values_list('latest_id', flat=True)
        )
        deleted_entity, _ = (
            EntityRevision.objects
            .filter(created_at__lt=cutoff)
            .exclude(id__in=list(latest_ids))
            .delete()
        )

        deleted_crop, _ = CropRevision.objects.filter(created_at__lt=cutoff).delete()
        deleted_project, _ = ProjectRevision.objects.filter(created_at__lt=cutoff).delete()

        # Drop batch operations whose revisions have all been pruned (or NULLed
        # via SET_NULL) — an empty group carries no history value.
        deleted_batches, _ = (
            BatchOperation.objects
            .filter(created_at__lt=cutoff, revisions__isnull=True)
            .delete()
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Deleted {deleted_entity} entity, {deleted_crop} legacy crop, '
                f'{deleted_project} legacy project historical records and '
                f'{deleted_batches} empty batch operations.'
            )
        )
