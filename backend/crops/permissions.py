from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.db.models import Q

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser
    from django.db.models import QuerySet

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


def public_library_moderator_users() -> QuerySet[AbstractBaseUser]:
    """Every active user who may review crop species proposals.

    Mirrors :func:`is_public_library_moderator`'s three ways in (staff,
    superuser, or the moderator group/permission) so notification fan-out
    never misses a moderator granted access outside the group, e.g. directly
    via `is_staff`.
    """
    User = get_user_model()
    return User.objects.filter(
        Q(is_staff=True) | Q(is_superuser=True) | Q(groups__name=PUBLIC_LIBRARY_MODERATOR_GROUP),
        is_active=True,
    ).distinct()


def public_library_admin_users() -> QuerySet[AbstractBaseUser]:
    """Every active user who may review public library moderator requests."""
    User = get_user_model()
    return User.objects.filter(Q(is_staff=True) | Q(is_superuser=True), is_active=True).distinct()
