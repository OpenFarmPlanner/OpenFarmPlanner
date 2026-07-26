from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.test import SimpleTestCase

from accounts.admin import OpenFarmPlannerUserAdmin


class UserAdminConfigTests(SimpleTestCase):
    def test_builtin_user_model_uses_openfarmplanner_admin(self) -> None:
        user_model = get_user_model()

        registered_admin = admin.site._registry[user_model]

        self.assertIsInstance(registered_admin, OpenFarmPlannerUserAdmin)

    def test_user_changelist_shows_registration_and_last_login_dates(self) -> None:
        admin_class = OpenFarmPlannerUserAdmin

        self.assertEqual(
            admin_class.list_display,
            [*DjangoUserAdmin.list_display, 'date_joined', 'last_login'],
        )

    def test_user_detail_keeps_registration_and_last_login_read_only(self) -> None:
        admin_class = OpenFarmPlannerUserAdmin

        self.assertIn('date_joined', admin_class.readonly_fields)
        self.assertIn('last_login', admin_class.readonly_fields)
        self.assertIn(
            ('Important dates', {'fields': ('last_login', 'date_joined')}),
            admin_class.fieldsets,
        )
