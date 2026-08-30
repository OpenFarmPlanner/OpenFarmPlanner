"""Whole-project point-in-time restore built on recorded entity revisions."""

from typing import Any

from django.db import IntegrityError, transaction

from farm.models import EntityRevision, Project

from .records import _RESTORABLE_ENTITY_TYPES


def _model_manager(model):
    return getattr(model, 'all_objects', None) or model._base_manager


def _bulk_create_skipping_conflicts(model, instances: list, object_ids: list[int]) -> set[int]:
    """Recreate `instances` (aligned with `object_ids`), returning the ids that
    landed.

    Fast path is one `bulk_create`. It can still fail when two historical
    snapshots both look "active" and collide on a (possibly partial) unique
    constraint — which happens when an entity was hard-deleted without an
    `ACTION_DELETED` revision (e.g. an old demo reset). Then fall back to
    inserting row by row in savepoints and skip the losers; callers pass the
    rows newest-id-first, so the most recent snapshot wins.
    """
    if not instances:
        return set()
    try:
        with transaction.atomic():
            model.objects.bulk_create(instances)
        return set(object_ids)
    except IntegrityError:
        pass

    inserted: set[int] = set()
    for instance, object_id in zip(instances, object_ids):
        try:
            with transaction.atomic():
                model.objects.bulk_create([instance])
            inserted.add(object_id)
        except IntegrityError:
            continue
    return inserted


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


_SKIP_ON_UPDATE = {'id', 'created_at', 'updated_at'}


def _restore_project_state_at(project: Project, target_time) -> None:
    """Roll every restorable entity type back to its state at target_time.

    Works only through recorded revisions and never mass-deletes: a tracked row
    is *updated in place* to its snapshot (or recreated if it had been
    deleted). The only rows it removes are ones history positively records as
    deleted by target_time. Rows history never recorded (the auto
    "Hauptstandort" default, demo-seeder rows, data predating history) — and
    entities merely created *after* target_time — are left untouched, so a
    partial history can't empty a project or orphan its planting plans. The
    trade-off is deliberate: recovering old state matters more than perfectly
    un-creating everything newer.
    """
    restorable_models = {model for model, _entity_type in _RESTORABLE_ENTITY_TYPES}
    with transaction.atomic():
        # 1. Remove tracked rows history records as deleted by target_time.
        #    Reverse dependency order so a parent's delete cascade never hits a
        #    child we still have to process.
        for model, entity_type in reversed(_RESTORABLE_ENTITY_TYPES):
            states = _entity_states_at(project, entity_type, target_time)
            gone_at_target = {object_id for object_id, snap in states.items() if snap is None}
            if gone_at_target:
                _model_manager(model).filter(project=project, pk__in=gone_at_target).delete()

        # 2. Bring every tracked row that existed at target_time to its
        #    snapshot — update in place, or recreate if it had been deleted.
        present_ids: dict[type, set[int]] = {}
        for model, entity_type in _RESTORABLE_ENTITY_TYPES:
            manager = _model_manager(model)
            allowed_fields = {field.attname for field in model._meta.concrete_fields}
            restorable_fk_fields = [
                field for field in model._meta.concrete_fields
                if field.remote_field is not None and field.remote_field.model in restorable_models
            ]
            # FKs to non-restorable models can still dangle if the target row was
            # hard-deleted since the snapshot — null the (nullable) FK instead of
            # failing the insert.
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

            live_ids = set(manager.filter(project=project).values_list('pk', flat=True))
            present_ids[model] = set(live_ids)
            states = _entity_states_at(project, entity_type, target_time)
            recreate: list[tuple[int, Any]] = []
            for object_id, snapshot in states.items():
                if snapshot is None:
                    continue
                # Skip if a parent this row needs was itself not restored.
                if any(
                    snapshot.get(field.attname) is not None
                    and snapshot[field.attname] not in present_ids.get(field.remote_field.model, set())
                    for field in restorable_fk_fields
                ):
                    continue
                # Snapshots may carry fields the model has since dropped — keep
                # only what still exists rather than crashing on an unknown kwarg.
                row_data = {key: value for key, value in snapshot.items() if key in allowed_fields}
                for field in external_fk_fields:
                    if (
                        row_data.get(field.attname) is not None
                        and row_data[field.attname] not in existing_external_ids[field.remote_field.model]
                    ):
                        row_data[field.attname] = None
                row_data['project_id'] = project.id
                if 'deleted_at' in allowed_fields:
                    row_data['deleted_at'] = None

                if object_id in live_ids:
                    manager.filter(pk=object_id).update(
                        **{key: value for key, value in row_data.items() if key not in _SKIP_ON_UPDATE},
                    )
                    present_ids[model].add(object_id)
                else:
                    recreate.append((object_id, model(**row_data)))

            # Newest object_id first, so a unique-constraint collision between
            # two stale snapshots resolves in favour of the most recent one.
            recreate.sort(key=lambda pair: pair[0], reverse=True)
            present_ids[model] |= _bulk_create_skipping_conflicts(
                model,
                [instance for _object_id, instance in recreate],
                [object_id for object_id, _instance in recreate],
            )
