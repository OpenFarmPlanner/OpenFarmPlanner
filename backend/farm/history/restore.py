"""Restore a single entity from one of its recorded revisions.

Every `EntityRevision` carries the entity's full field snapshot at that point,
so restoring one sets just that entity back to that state — nothing else in the
project is touched. A `deleted` revision holds the entity's last state before
deletion, so restoring it brings the entity back.
"""

from typing import Any

from django.db import IntegrityError, transaction

from farm.models import EntityRevision, Project, Season

from .records import _ENTITY_TYPE_LABELS

_MODEL_BY_ENTITY_TYPE: dict[str, type] = {label: model for model, label in _ENTITY_TYPE_LABELS.items()}
# Seasons record history but are not in the whole-project entity-type list.
_MODEL_BY_ENTITY_TYPE['season'] = Season

_SKIP_ON_UPDATE = {'id', 'created_at', 'updated_at'}


class RevisionNotRestorableError(Exception):
    """The revision can't be applied as a single-entity restore: unknown entity
    type, empty snapshot, a non-nullable related row it points at is gone, or
    the insert would violate a constraint."""


def _target_manager(model):
    return getattr(model, 'all_objects', None) or model._base_manager


def restore_entity_from_revision(project: Project, revision: EntityRevision) -> None:
    """Set the entity `revision` belongs to back to that revision's snapshot."""
    model = _MODEL_BY_ENTITY_TYPE.get(revision.entity_type)
    snapshot = revision.snapshot
    if model is None or not isinstance(snapshot, dict) or not snapshot:
        raise RevisionNotRestorableError(revision.entity_type)

    concrete = {field.attname for field in model._meta.concrete_fields}
    row_data: dict[str, Any] = {key: value for key, value in snapshot.items() if key in concrete}
    row_data['project_id'] = project.id

    # A related row referenced by the snapshot may be gone. Null the FK if it is
    # optional, refuse the restore if it is required.
    for field in model._meta.concrete_fields:
        if field.remote_field is None or field.attname not in row_data:
            continue
        related_id = row_data[field.attname]
        if related_id is None:
            continue
        if not _target_manager(field.remote_field.model).filter(pk=related_id).exists():
            if not field.null:
                raise RevisionNotRestorableError(revision.entity_type)
            row_data[field.attname] = None

    if 'deleted_at' in concrete:
        row_data['deleted_at'] = None

    manager = _target_manager(model)
    try:
        with transaction.atomic():
            if manager.filter(project=project, pk=revision.object_id).exists():
                manager.filter(pk=revision.object_id).update(
                    **{key: value for key, value in row_data.items() if key not in _SKIP_ON_UPDATE},
                )
            else:
                model.objects.bulk_create([model(**row_data)])
    except IntegrityError as exc:
        raise RevisionNotRestorableError(revision.entity_type) from exc
