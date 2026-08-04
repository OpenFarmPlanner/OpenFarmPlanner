"""Accounts admin module."""

from django.contrib import admin
from django.contrib.admin.sites import NotRegistered
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import UserProjectSettings

User = get_user_model()

# Remove the default Django user admin registration so the project can provide
# its own customized admin configuration for the user model.
try:
    admin.site.unregister(User)
except NotRegistered:
    pass


class OpenFarmPlannerUserAdmin(DjangoUserAdmin):
    """Custom admin interface configuration for the built-in Django user model."""

    # Extend the default user admin columns with registration and last-login dates.
    list_display = [*DjangoUserAdmin.list_display, 'date_joined', 'last_login']
    # Make the registration and login timestamps read-only in the admin form.
    readonly_fields = [*DjangoUserAdmin.readonly_fields, 'date_joined', 'last_login']


# Register the customized user admin with Django's admin site.
admin.site.register(User, OpenFarmPlannerUserAdmin)


@admin.register(UserProjectSettings)
class UserProjectSettingsAdmin(admin.ModelAdmin):
    """Admin interface configuration for the UserProjectSettings model."""

    # Show the most relevant project settings fields in the admin list view.
    list_display = ['user', 'default_project', 'last_project', 'updated_at']
    # Allow searching by the related user and project names.
    search_fields = ['user__email', 'user__username', 'default_project__name', 'last_project__name']
