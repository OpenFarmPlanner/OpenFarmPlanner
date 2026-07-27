from __future__ import annotations

from typing import Any

from django.contrib.auth.models import Group, Permission

PUBLIC_LIBRARY_MODERATOR_GROUP = 'Public Library Moderators'
MODERATE_CROP_SPECIES_PERMISSION = 'crops.moderate_crop_species'


def is_public_library_moderator(user: Any) -> bool:
    """Return whether a user may review community moderation queues."""
    return bool(
        user
        and user.is_authenticated
        and (
            getattr(user, 'is_staff', False)
            or getattr(user, 'is_superuser', False)
            or user.has_perm(MODERATE_CROP_SPECIES_PERMISSION)
        )
    )


def is_public_library_admin(user: Any) -> bool:
    """Return whether a user may grant or reject public library moderator access."""
    return bool(
        user
        and user.is_authenticated
        and (getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False))
    )


def ensure_public_library_moderator_group() -> Group:
    """Create the moderator group and attach only public-library moderation rights."""
    group, _ = Group.objects.get_or_create(name=PUBLIC_LIBRARY_MODERATOR_GROUP)
    permission = Permission.objects.get(
        codename='moderate_crop_species',
        content_type__app_label='crops',
    )
    group.permissions.add(permission)
    return group


def grant_public_library_moderator_access(user: Any) -> None:
    group = ensure_public_library_moderator_group()
    user.groups.add(group)
