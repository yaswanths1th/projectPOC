from django.urls import path
from .views import SessionListCreateView, SessionDetailView, SessionSendMessageView

urlpatterns = [
    path("sessions/", SessionListCreateView.as_view(), name="chat-sessions"),
    path("sessions/<int:pk>/", SessionDetailView.as_view(), name="chat-session-detail"),
    path("sessions/<int:pk>/send/", SessionSendMessageView.as_view(), name="chat-session-send"),
]
