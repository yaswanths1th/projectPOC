from django.core.management.base import BaseCommand
from apps.subscriptions.models import Plan


class Command(BaseCommand):
    help = 'Create default subscription plans'

    def handle(self, *args, **options):
        plans_data = [
            {
                'slug': 'free',
                'name': 'Free Plan',
                'description': 'Basic features with limited access',
                'price_cents': 0,
                'interval': 'monthly',
                'can_use_ai': False,
                'can_edit_profile': True,
                'can_change_password': True,
            },
            {
                'slug': 'pro',
                'name': 'Pro Plan',
                'description': 'Professional features with AI access',
                'price_cents': 99900,  # ₹999
                'interval': 'monthly',
                'can_use_ai': True,
                'can_edit_profile': True,
                'can_change_password': True,
            },
            {
                'slug': 'enterprise',
                'name': 'Enterprise Plan',
                'description': 'Full access to all features including AI',
                'price_cents': 299900,  # ₹2999
                'interval': 'monthly',
                'can_use_ai': True,
                'can_edit_profile': True,
                'can_change_password': True,
            },
        ]

        for plan_data in plans_data:
            plan, created = Plan.objects.update_or_create(
                slug=plan_data['slug'],
                defaults=plan_data
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created plan: {plan.name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'↻ Updated plan: {plan.name}')
                )

        self.stdout.write(
            self.style.SUCCESS('\nSubscription plans setup complete!')
        )
