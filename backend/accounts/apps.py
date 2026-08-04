from django.apps import AppConfig


class AccountsConfig(AppConfig):
    # Use a large auto-incrementing primary key field for models in this app.
    default_auto_field = 'django.db.models.BigAutoField'
    # Register the app with Django using its package name.
    name = 'accounts'
