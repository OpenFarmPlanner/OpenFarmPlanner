"""Entity-revision engine for per-entity history and point-in-time restore.

Public seam used by the API layer (views/mixins): recording revisions,
serializing snapshots, and restoring whole-project state.
"""

from .payloads import build_crop_history_payload
from .records import (
    _build_entity_revision_changes,
    _current_actor_label,
    _diff_changed_fields,
    _entity_display_name,
    _entity_type_for,
    _serialize_instance,
    record_entity_revision,
    start_batch_operation,
)
from .restore import _restore_project_state_at, restore_crop_from_revision

__all__ = [
    '_build_entity_revision_changes',
    '_current_actor_label',
    '_diff_changed_fields',
    '_entity_display_name',
    '_entity_type_for',
    '_restore_project_state_at',
    '_serialize_instance',
    'build_crop_history_payload',
    'record_entity_revision',
    'restore_crop_from_revision',
    'start_batch_operation',
]
