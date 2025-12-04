# backend/apps/subscriptions/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('plans/', views.plans_list, name='plans-list'),
    # legacy endpoint (if other code expects this)
    path('subscription/', views.user_subscription, name='current-subscription'),
    path('subscribe/', views.subscribe_view, name='subscribe'),
    # profile (this view will be reachable under the app's include prefix)
    path('profile/', views.profile_view, name='profile'),
    # explicit API subscription endpoint (match frontend usage)
    path('api/subscription/', views.user_subscription, name='api-user-subscription'),

    # AI endpoints kept (unchanged)
    path('ai/free-chat/', views.ai_free_chat, name='ai-free-chat'),
    path('api/ai/free-chat/', views.ai_free_chat, name='api-ai-free-chat'),
    path('subscription/ai/free-chat/', views.ai_free_chat, name='subscription-ai-free-chat'),
    path('accounts/ai/free-chat/', views.ai_free_chat, name='accounts-ai-free-chat'),
]
