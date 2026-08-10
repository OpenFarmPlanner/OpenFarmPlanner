"""Whole-project point-in-time restore built on recorded entity revisions."""

from typing import Any

from django.db import transaction

from farm.models import EntityRevision, Project

from .records import _RESTORABLE_ENTITY_TYPES


def _entity_states_at(project: Project, entity_type: str, target_time) -> dict[int, dict[str, Any] | None]:
    """Return {object_id: snapshot} for every object with a revision at/before
    target_time; a value of None marks an object that was deleted by then."""
    revisions = (
        EntityRevision.objects
        .filter(project=project, entity_type=entity_type, created_at__lte=target_time)
        .order_by('object_id', '-created_at')
    )
    states: dict[int, dict[str, Any] | None] = {}
    for revision in revisions:
        if revision.object_id in states:
            continue
        states[revision.object_id] = None if revision.action == EntityRevision.ACTION_DELETED else revision.snapshot
    return states


def _restore_project_state_at(project: Project, target_time) -> None:
    """Reconstruct every restorable entity type to its state at target_time."""
    restorable_models = {model for model, _entity_type in _RESTORABLE_ENTITY_TYPES}
    with transaction.atomic():
        for model, _entity_type in reversed(_RESTORABLE_ENTITY_TYPES):
            manager = getattr(model, 'all_objects', None) or model._base_manager
            manager.filter(project=project).delete()

        created_ids: dict[type, set[int]] = {}
        for model, entity_type in _RESTORABLE_ENTITY_TYPES:
            allowed_fields = {field.attname for field in model._meta.concrete_fields}
            # FKs to other restorable types: a DB-level cascade delete of the parent
            # (e.g. deleting a Location hard-deletes its Fields/Beds) never records an
            # EntityRevision for the cascaded child, so its last snapshot can still look
            # "active" even though the row — and its parent — are long gone. Recreating
            # such an orphan would reference a parent row that was correctly *not*
            # recreated, violating the FK constraint, so it's dropped here instead.
            restorable_fk_fields = [
                field for field in model._meta.concrete_fields
                if field.remote_field is not None and field.remote_field.model in restorable_models
            ]
            # FKs to non-restorable models (e.g. Culture -> PublicCulture) aren't
            # touched by this restore, but the referenced row can still have been
            # hard-deleted since the snapshot was taken. Re-inserting a stale
            # reference would violate the FK constraint, so — unlike restorable
            # FKs above, where the whole row is dropped — these are simply nulled
            # out if the target no longer exists.
            external_fk_fields = [
                field for field in model._meta.concrete_fields
                if field.remote_field is not None
                and field.remote_field.model not in restorable_models
                and field.null
            ]
            existing_external_ids: dict[type, set[int]] = {
                field.remote_field.model: set(
                    field.remote_field.model._base_manager.values_list('pk', flat=True)
                )
                for field in external_fk_fields
            }
            states = _entity_states_at(project, entity_type, target_time)
            rows = []
            ids: set[int] = set()
            for object_id, snapshot in states.items():
                if snapshot is None:
                    continue
                if any(
                    snapshot.get(field.attname) is not None
                    and snapshot[field.attname] not in created_ids.get(field.remote_field.model, set())
                    for field in restorable_fk_fields
                ):
                    continue
                # Old snapshots may carry fields since renamed/removed from the model
                # (schema changes don't rewrite historical JSON) — drop anything the
                # current model no longer has instead of crashing on an unknown kwarg.
                row_data = {key: value for key, value in snapshot.items() if key in allowed_fields}
                for field in external_fk_fields:
                    if row_data.get(field.attname) is not None and row_data[field.attname] not in existing_external_ids[field.remote_field.model]:
                        row_data[field.attname] = None
                row_data['project_id'] = project.id
                rows.append(model(**row_data))
                ids.add(object_id)
            if rows:
                model.objects.bulk_create(rows)
            created_ids[model] = ids
