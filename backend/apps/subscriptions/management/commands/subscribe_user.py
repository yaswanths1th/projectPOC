from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.subscriptions.models import Plan, UserSubscription
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = 'Subscribe a user to a plan'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username to subscribe')
        parser.add_argument('--plan', type=str, default='enterprise', help='Plan slug (default: enterprise)')

    def handle(self, *args, **options):
        username = options['username']
        plan_slug = options['plan']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User "{username}" not found')
            )
            return

        try:
            plan = Plan.objects.get(slug=plan_slug, is_active=True)
        except Plan.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Plan "{plan_slug}" not found or inactive')
            )
            return

        # Create or update subscription
        sub, created = UserSubscription.objects.update_or_create(
            user=user,
            defaults={
                'plan': plan,
                'active': True,
                'started_at': timezone.now()
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Subscribed {username} to {plan.name}'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'↻ Updated {username}\'s subscription to {plan.name}'
                )
            )
