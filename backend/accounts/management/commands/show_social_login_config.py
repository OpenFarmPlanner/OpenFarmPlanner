"""Print the social login configuration, including the exact redirect URIs.

Registering an OAuth application at Google or Microsoft requires the redirect
URI to match byte for byte. It depends on the deployment (public origin, URL
prefix), so this command prints what this deployment actually uses instead of
leaving it to be reconstructed by hand.
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

from accounts.social_auth import build_provider_callback_url, social_callback_base_url
from accounts.social_urls import PROVIDER_ADAPTERS
from accounts.social_views import PROVIDER_NAMES


class Command(BaseCommand):
    help = 'Show the configured social login providers and their OAuth redirect URIs.'

    def handle(self, *args: object, **options: object) -> None:
        """Write the provider configuration to stdout."""
        self.stdout.write(f'Callback base URL: {social_callback_base_url() or "(not configured)"}')
        for provider_id in PROVIDER_ADAPTERS:
            apps = settings.SOCIALACCOUNT_PROVIDERS.get(provider_id, {}).get('APPS', [])
            name = PROVIDER_NAMES.get(provider_id, provider_id)
            state = 'configured' if apps else 'not configured (no client id/secret)'
            self.stdout.write('')
            self.stdout.write(f'{name} [{provider_id}]: {state}')
            self.stdout.write(f'  Redirect URI: {build_provider_callback_url(provider_id)}')
