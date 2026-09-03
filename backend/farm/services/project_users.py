"""Shared user provisioning for the seeded demo and hint-test projects.

Both seeders need the same "create the account if missing, otherwise reset its
password" behaviour, including backfilling a username on legacy accounts that
were created without one.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

User = get_user_model()


def get_or_create_project_user(*, email: str, username: str, password: str) -> tuple[Any, bool]:
    """Return the seeded account for ``email`` and whether it was just created.

    A newly created account always gets ``password``. An existing account keeps
    its record but has ``password`` reapplied when one is given, so re-running a
    seeder restores known credentials; a missing ``username`` is backfilled in
    the same save.
    """
    user, created_user = User.objects.get_or_create(
        email=email,
        defaults={
            'username': username,
            'is_active': True,
        },
    )
    if created_user:
        user.set_password(password)
        user.save(update_fields=['password'])
    elif password:
        user.set_password(password)
        if not user.username:
            user.username = username
            user.save(update_fields=['password', 'username'])
        else:
            user.save(update_fields=['password'])
    return user, created_user
