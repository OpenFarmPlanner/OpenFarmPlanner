from allauth.account.models import EmailAddress
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.test import RequestFactory, SimpleTestCase, TestCase

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
            [
                *DjangoUserAdmin.list_display,
                'primary_email_verified',
                'date_joined',
                'last_login',
            ],
        )

    def test_user_detail_keeps_registration_and_last_login_read_only(self) -> None:
        admin_class = OpenFarmPlannerUserAdmin

        self.assertIn('date_joined', admin_class.readonly_fields)
        self.assertIn('last_login', admin_class.readonly_fields)
        self.assertIn('primary_email_verified', admin_class.readonly_fields)
        personal_info_fields = next(
            options['fields']
            for _name, options in admin_class.fieldsets
            if 'email' in options['fields']
        )
        self.assertEqual(
            personal_info_fields,
            (
                *next(
                    options['fields']
                    for _name, options in DjangoUserAdmin.fieldsets
                    if 'email' in options['fields']
                ),
                'primary_email_verified',
            ),
        )
        self.assertIn(
            ('Important dates', {'fields': ('last_login', 'date_joined')}),
            admin_class.fieldsets,
        )


class UserAdminEmailVerificationTests(TestCase):
    def setUp(self) -> None:
        self.user_model = get_user_model()
        self.request = RequestFactory().get('/admin/auth/user/')
        self.user_admin = OpenFarmPlannerUserAdmin(self.user_model, admin.site)

    def verification_status(self, user_id: int) -> bool:
        user = self.user_admin.get_queryset(self.request).get(pk=user_id)
        return self.user_admin.primary_email_verified(user)

    def test_primary_verified_email_is_shown_as_verified(self) -> None:
        user = self.user_model.objects.create_user(
            username='verified', email='verified@example.com'
        )
        EmailAddress.objects.create(
            user=user,
            email=user.email,
            primary=True,
            verified=True,
        )

        self.assertIs(self.verification_status(user.pk), True)

    def test_unverified_primary_email_is_shown_as_unverified(self) -> None:
        user = self.user_model.objects.create_user(
            username='unverified', email='unverified@example.com'
        )
        EmailAddress.objects.create(
            user=user,
            email=user.email,
            primary=True,
            verified=False,
        )

        self.assertIs(self.verification_status(user.pk), False)

    def test_verified_non_primary_email_is_not_used(self) -> None:
        user = self.user_model.objects.create_user(
            username='old-address', email='current@example.com'
        )
        EmailAddress.objects.create(
            user=user,
            email='old@example.com',
            primary=False,
            verified=True,
        )

        self.assertIs(self.verification_status(user.pk), False)
