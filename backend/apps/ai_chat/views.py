from django.db.models import Count
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import ChatSession, ChatMessage
from .serializers import ChatSessionSerializer, ChatMessageSerializer
from .gemini import call_gemini

SESSION_DEFAULT_LIMIT = 20       # per conversation
USER_DEFAULT_LIMIT = 1000        # total messages per user (fallback)


def get_ai_limits(user):
    # If you have UserProfile with ai_message_limit:
    prof = getattr(user, "userprofile", None)
    user_limit = getattr(prof, "ai_message_limit", USER_DEFAULT_LIMIT) if prof else USER_DEFAULT_LIMIT
    return {
        "session_limit": SESSION_DEFAULT_LIMIT,
        "user_limit": user_limit,
    }


class SessionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            ChatSession.objects
            .filter(user=request.user)
            .annotate(message_count=Count("messages"))
            .order_by("-updated_at")[:50]
        )
        data = ChatSessionSerializer(qs, many=True).data
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        title = request.data.get("title") or "New chat"
        session = ChatSession.objects.create(user=request.user, title=title)
        session = (
            ChatSession.objects
            .annotate(message_count=Count("messages"))
            .get(pk=session.pk)
        )
        data = ChatSessionSerializer(session).data
        return Response(data, status=status.HTTP_201_CREATED)


class SessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, user, pk):
        return ChatSession.objects.filter(user=user, pk=pk).first()

    def get(self, request, pk):
        session = self.get_object(request.user, pk)
        if not session:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        msgs = session.messages.all()
        ser = ChatMessageSerializer(msgs, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        session = self.get_object(request.user, pk)
        if not session:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionSendMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        text = request.data.get("prompt") or request.data.get("text")
        if not text:
            return Response({"detail": "prompt is required"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        session = ChatSession.objects.filter(user=user, pk=pk).first()
        if not session:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        limits = get_ai_limits(user)

        # per-user total limit
        total_count = ChatMessage.objects.filter(user=user).count()
        if total_count >= limits["user_limit"]:
            return Response(
                {
                    "code": "USER_LIMIT_REACHED",
                    "detail": f"You have reached your limit of {limits['user_limit']} messages.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # per-session limit
        session_count = session.messages.count()
        if session_count >= limits["session_limit"]:
            return Response(
                {
                    "code": "SESSION_LIMIT_REACHED",
                    "detail": f"This chat reached its {limits['session_limit']} message limit. Start a new chat.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # save user message
        ChatMessage.objects.create(
            session=session,
            user=user,
            role="user",
            text=text,
        )

        # call your Gemini/AI backend here
        try:
            # TODO: replace this dummy reply with real AI call
            ai_reply = call_gemini(text)
        except Exception as e:
            return Response(
                {"detail": "AI backend error", "error": str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # save AI message
        ChatMessage.objects.create(
            session=session,
            user=user,
            role="assistant",
            text=ai_reply,
        )

        return Response({"response": ai_reply}, status=status.HTTP_200_OK)
