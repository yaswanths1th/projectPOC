from django.apps import AppConfig

class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"          # full import path
    label = "accounts" # ✅ short label used by Django internally
    def ready(self):
        # import permissions models so migrations detect them
        from . import models_permissions  # noqa
