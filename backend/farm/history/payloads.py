"""Entry payloads for the crop history endpoints."""

from typing import Any

from farm.models import EntityRevision

from .records import _build_entity_revision_changes


def build_crop_history_payload(
    rows: list[EntityRevision],
    *,
    label_crop_in_summary: bool = False,
) -> list[dict[str, Any]]:
    """Turn crop revisions into `CropHistoryEntrySerializer` input.

    `rows` must be ordered newest first. Each entry is diffed against the next
    older revision *of the same crop*, so both the single-crop list and the
    global list (which interleaves crops) work. The global list sets
    `label_crop_in_summary` because its entries span several crops.
    """
    current_revision_id = rows[0].id if rows else None
    payload: list[dict[str, Any]] = []

    for index, row in enumerate(rows):
        summary = ', '.join(row.changed_fields[:5]) if row.changed_fields else 'snapshot'
        previous_snapshot = next(
            (
                candidate.snapshot
                for candidate in rows[index + 1:]
                if candidate.object_id == row.object_id
            ),
            None,
        )
        payload.append({
            'history_id': row.id,
            'crop_id': row.object_id,
            'history_date': row.created_at,
            'history_type': 'snapshot',
            'history_user': row.user_name or None,
            'summary': f"Crop #{row.object_id}: {summary}" if label_crop_in_summary else summary,
            'object_type': 'crop',
            'object_display_name': row.display_name or None,
            'action': row.action,
            'actor_label': row.user_name or None,
            'is_current_version': row.id == current_revision_id,
            'changes': _build_entity_revision_changes(
                row.snapshot,
                previous_snapshot,
                row.changed_fields,
            ),
        })

    return payload
