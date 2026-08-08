"""Farm domain models, organized into per-domain modules.

All models and shared helpers are re-exported here so ``from farm.models
import X`` keeps working unchanged. The two upload-path callables stay
defined in this module (not a submodule) so migrations that serialized them
as ``farm.models.<name>`` remain valid without a schema change.
"""

import uuid

from django.utils import timezone


def note_attachment_upload_path(instance: 'NoteAttachment', filename: str) -> str:
    """Build a deterministic storage path for note attachments."""
    extension = (filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin')
    return f"notes/{instance.planting_plan_id}/{uuid.uuid4().hex}.{extension}"


def culture_media_upload_path(instance: 'MediaFile', filename: str) -> str:
    """Build unique storage path for culture files."""
    extension = (filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin')
    return f"culture-media/{timezone.now().strftime('%Y/%m')}/{uuid.uuid4().hex}.{extension}"


from .base import TimestampedModel  # noqa: E402
from .agent_api import (  # noqa: E402
    API_TOKEN_PREFIX,
    CultureImportDraft,
    ProjectApiToken,
)
from .cultures import (  # noqa: E402
    ActiveCultureManager,
    Culture,
    CultureSupplierData,
    PublicCulture,
    PublicCultureChangeProposal,
    PublicCultureDiscussionComment,
    PublicCultureDiscussionTopic,
    PublicCultureRevision,
    PublicCultureStatusEvent,
    PublicCultureTranslation,
    SeedPackage,
    Supplier,
    format_culture_display_name,
    is_supplier_domain,
)
from .history import CultureRevision, EntityRevision, ProjectRevision  # noqa: E402
from .notes import NoteAttachment  # noqa: E402
from .planning import PlantingPlan, Task  # noqa: E402
from .projects import (  # noqa: E402
    AgentLoginToken,
    MediaFile,
    Project,
    ProjectInvitation,
    ProjectMembership,
)
from .structure import Bed, BedLayout, Field, FieldLayout, Location  # noqa: E402

__all__ = [
    'API_TOKEN_PREFIX',
    'ActiveCultureManager',
    'AgentLoginToken',
    'Bed',
    'BedLayout',
    'Culture',
    'CultureImportDraft',
    'CultureRevision',
    'CultureSupplierData',
    'EntityRevision',
    'Field',
    'FieldLayout',
    'Location',
    'MediaFile',
    'NoteAttachment',
    'PlantingPlan',
    'Project',
    'ProjectApiToken',
    'ProjectInvitation',
    'ProjectMembership',
    'ProjectRevision',
    'PublicCulture',
    'PublicCultureChangeProposal',
    'PublicCultureDiscussionComment',
    'PublicCultureDiscussionTopic',
    'PublicCultureRevision',
    'PublicCultureStatusEvent',
    'PublicCultureTranslation',
    'SeedPackage',
    'Supplier',
    'Task',
    'TimestampedModel',
    'culture_media_upload_path',
    'format_culture_display_name',
    'is_supplier_domain',
    'note_attachment_upload_path',
]
