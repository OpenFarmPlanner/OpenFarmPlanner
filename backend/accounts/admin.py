"""Accounts admin module."""

from django.contrib import admin
from django.contrib.admin.sites import NotRegistered
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import UserProjectSettings

User = get_user_model()

try:
    admin.site.unregister(User)
except NotRegistered:
    pass


class OpenFarmPlannerUserAdmin(DjangoUserAdmin):
    """Custom admin interface configuration for the built-in Django user model."""

    list_display = [*DjangoUserAdmin.list_display, 'date_joined', 'last_login']
    readonly_fields = [*DjangoUserAdmin.readonly_fields, 'date_joined', 'last_login']


admin.site.register(User, OpenFarmPlannerUserAdmin)


@admin.register(UserProjectSettings)
class UserProjectSettingsAdmin(admin.ModelAdmin):
    """Admin interface configuration for the UserProjectSettings model."""

    list_display = ['user', 'default_project', 'last_project', 'updated_at']
    search_fields = ['user__email', 'user__username', 'default_project__name', 'last_project__name']
