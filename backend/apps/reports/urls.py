from django.urls import path
from .views import AdminUserGrowth, AdminRecentUsers

urlpatterns = [
    path("admin/user-growth/", AdminUserGrowth.as_view()),
    path("admin/recent-users/", AdminRecentUsers.as_view()),
]
