// frontend/src/pages/AIChat.jsx
import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../config/api";
import { UserContext } from "../context/UserContext";
import "./AIChat.css";
import ReactMarkdown from "react-markdown";
import { FiTrash2 } from "react-icons/fi"; // 🗑 delete icon

const PROFILE_URL = `${API_URL}/api/auth/profile/`;
const SESSIONS_BASE_URL = `${(API_URL || "").replace(/\/+$/, "")}/api/chat/sessions/`;

function detectCanUseAI(u) {
  if (!u) return false;
  const s = u.subscription || null;
  if (!s) return false;
  if (typeof s.can_use_ai === "boolean") return s.can_use_ai;
  if (s.plan && typeof s.plan.can_use_ai === "boolean") return s.plan.can_use_ai;
  if (typeof s.slug === "string" && s.slug.toLowerCase() === "enterprise") return true;
  return false;
}

export default function AIChat() {
  const { user, setUser } = useContext(UserContext) || {};

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [deletePopup, setDeletePopup] = useState({ show: false, sessionId: null });

  const [effectiveUser, setEffectiveUser] = useState(() => {
    if (user) return user;
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const [canUseAI, setCanUseAI] = useState(() =>
    detectCanUseAI(
      user ||
        (() => {
          try {
            return JSON.parse(localStorage.getItem("user") || "null");
          } catch {
            return null;
          }
        })()
    )
  );

  // New: sidebar expanded state for mobile toggle
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      setEffectiveUser(null);
      setCanUseAI(false);
      return;
    }

    const doRefresh = async () => {
      try {
        let fresh = null;
        if (typeof window !== "undefined" && typeof window.__refreshUser === "function") {
          fresh = await window.__refreshUser();
        } else {
          const res = await axios.get(PROFILE_URL, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
          });
          fresh = res.data;
          if (setUser) setUser(fresh);
          try {
            localStorage.setItem("user", JSON.stringify(fresh));
          } catch {}
        }

        if (!fresh) return;
        setEffectiveUser(fresh);
        setCanUseAI(detectCanUseAI(fresh));
      } catch (e) {
        console.warn("[AIChat] profile refresh on mount failed:", e);
        const fallback =
          user ||
          (() => {
            try {
              return JSON.parse(localStorage.getItem("user") || "null");
            } catch {
              return null;
            }
          })();
        setEffectiveUser(fallback);
        setCanUseAI(detectCanUseAI(fallback));
      }
    };

    doRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      setEffectiveUser(user);
      setCanUseAI(detectCanUseAI(user));
    }
  }, [user]);

  async function loadMessagesForSession(sessionId, tokenOverride) {
    const token = tokenOverride || localStorage.getItem("access");
    if (!token || !sessionId) return;
    try {
      const res = await axios.get(`${SESSIONS_BASE_URL}${sessionId}/`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      const history = (res.data || []).map((m) => ({
        role: m.role,
        text: m.text,
        ts: m.created_at,
      }));
      setMessages(history);
    } catch (e) {
      console.warn("[AIChat] failed to load messages:", e);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token || !effectiveUser) return;

    const loadSessions = async () => {
      try {
        const res = await axios.get(SESSIONS_BASE_URL, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        const list = res.data || [];
        setSessions(list);

        if (!activeSessionId && list.length > 0) {
          const firstId = list[0].id;
          setActiveSessionId(firstId);
          await loadMessagesForSession(firstId, token);
        }
      } catch (e) {
        console.warn("[AIChat] failed to load sessions:", e);
      }
    };

    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUser]);

  async function ensureActiveSession(token) {
    if (activeSessionId) return activeSessionId;

    try {
      const res = await axios.post(
        SESSIONS_BASE_URL,
        { title: "New chat" },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );
      const newSession = { ...res.data, message_count: 0 };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      return newSession.id;
    } catch (e) {
      console.error("[AIChat] failed to create session:", e);
      setError("Failed to start a new chat session.");
      return null;
    }
  }

  async function handleSelectSession(id) {
    setActiveSessionId(id);
    await loadMessagesForSession(id);
    // On mobile, auto-collapse sidebar so chat gets screen space
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setSidebarExpanded(false);
    }
  }

  async function handleNewChat() {
    const token = localStorage.getItem("access");
    if (!token) {
      setError("You must be logged in to start a new chat.");
      return;
    }

    try {
      const res = await axios.post(
        SESSIONS_BASE_URL,
        { title: "New chat" },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const newSession = res.data;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setError(null);
      // expand sidebar on mobile to show the new session
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        setSidebarExpanded(true);
      }
    } catch (e) {
      console.error("[AIChat] failed to create new chat:", e);
      setError("Failed to start a new chat session.");
    }
  }

  async function deleteSessionById(id) {
    const token = localStorage.getItem("access");
    if (!token) {
      setError("You must be logged in to delete a chat.");
      return;
    }

    try {
      await axios.delete(`${SESSIONS_BASE_URL}${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });

      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);

        if (activeSessionId === id) {
          const nextId = remaining.length > 0 ? remaining[0].id : null;
          setActiveSessionId(nextId);
          if (nextId) {
            loadMessagesForSession(nextId, token);
          } else {
            setMessages([]);
          }
        }

        return remaining;
      });
    } catch (e) {
      console.error("[AIChat] failed to delete session:", e);
      setError("Failed to delete chat.");
    }
  }

  function openDeletePopup(id, e) {
    if (e) e.stopPropagation();
    setDeletePopup({ show: true, sessionId: id });
  }

  function cancelDelete() {
    setDeletePopup({ show: false, sessionId: null });
  }

  async function confirmDelete() {
    if (!deletePopup.sessionId) return;
    await deleteSessionById(deletePopup.sessionId);
    setDeletePopup({ show: false, sessionId: null });
  }

  async function handleSend() {
    const text = prompt.trim();
    if (!text) return;

    setError(null);

    const token = localStorage.getItem("access");
    if (!token) {
      setError("You must be logged in to use AI chat.");
      return;
    }

    const sessionId = await ensureActiveSession(token);
    if (!sessionId) return;

    const nowTs = new Date().toISOString();
    const userMsg = { role: "user", text, ts: nowTs };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);


    // ✅ FIX: update session title + message count immediately
setSessions((prev) =>
  prev.map((s) =>
    s.id === sessionId
      ? {
          ...s,
          title: s.title === "New chat" ? text.slice(0, 40) : s.title,
          message_count: (s.message_count || 0) + 1,
        }
      : s
  )
);

    if (!canUseAI) {
      setError(
        "Your plan does not show AI access locally. If backend disagrees, you'll see a 403 or success below."
      );
    }

    try {
      const res = await axios.post(
        `${SESSIONS_BASE_URL}${sessionId}/send/`,
        { prompt: text },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const data = res.data || {};
      const reply =
        data.response ?? data.result ?? data.message ?? (typeof data === "string" ? data : null);
      const finalText = reply ?? JSON.stringify(data).slice(0, 800);

      const aiMsg = { role: "assistant", text: finalText, ts: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);

      // ✅ FIX: increment count for AI reply
setSessions((prev) =>
  prev.map((s) =>
    s.id === sessionId
      ? { ...s, message_count: (s.message_count || 0) + 1 }
      : s
  )
);
    } catch (err) {
      console.error("[AIChat] send error:", err);

      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const detail = err?.response?.data?.detail;

      let msg = detail || err?.message || "Unknown error when calling AI";

      if (code === "SESSION_LIMIT_REACHED") {
        msg =
          detail ||
          "This chat reached its message limit. Please create a new chat in the sidebar.";
      } else if (code === "USER_LIMIT_REACHED") {
        msg =
          detail ||
          "You have reached your total AI message limit. Please contact admin or upgrade.";
      } else if (status === 401) {
        msg = "Authentication failed. Please log in again.";
      }

      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${msg}`, ts: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && prompt.trim()) handleSend();
    }
  }

  function renderBubble(m) {
    const time = new Date(m.ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (m.role === "user") {
      return (
        <div className="message-row user-row">
          <div className="bubble user-bubble">
            <div className="bubble-text">{m.text}</div>
            <div className="bubble-time">{time}</div>
          </div>
        </div>
      );
    }

    if (m.role === "assistant") {
      return (
        <div className="message-row bot-row">
          <div className="bot-avatar">AI</div>
          <div className="bubble bot-bubble">
            <div className="bubble-text markdown-text">
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </div>
            <div className="bubble-time">{time}</div>
          </div>
        </div>
      );
    }

    return <div className="system-msg">{m.text}</div>;
  }

  const userLabel = effectiveUser?.email ?? effectiveUser?.username ?? "User";

  return (
    <div className="ai-fullscreen-noscroll">
      <main className="ai-main-noscroll">
        <div className="ai-layout">
          {/* LEFT: sessions sidebar */}
          <aside className={`ai-sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}>
            <div className="ai-sidebar-header">
              <h3>Chats</h3>

              {/* mobile toggle button: visible only on mobile via CSS */}
              <button
                className="mobile-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarExpanded((s) => !s);
                }}
                aria-expanded={sidebarExpanded}
                aria-label={sidebarExpanded ? "Collapse chats" : "Expand chats"}
                type="button"
              >
                {sidebarExpanded ? "✕" : "☰"}
              </button>

              <button className="btn btn-new-chat" onClick={handleNewChat}>
                + New Chat
              </button>
            </div>

            <div className="ai-session-list" role="list">
              {sessions.length === 0 && (
                <div className="ai-session-empty">No chats yet. Start a new one.</div>
              )}

              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={
                    "ai-session-item" + (s.id === activeSessionId ? " active-session" : "")
                  }
                  onClick={() => handleSelectSession(s.id)}
                  role="listitem"
                >
                  <div className="ai-session-title">{s.title || "New chat"}</div>
                  <div className="ai-session-meta">
                    {s.message_count != null ? `${s.message_count} msgs` : ""}
                  </div>
                  <button
                    className="ai-session-delete"
                    onClick={(e) => openDeletePopup(s.id, e)}
                    aria-label="Delete chat"
                    type="button"
                  >
                    <FiTrash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT: chat area */}
          <section className="ai-chat-pane">
            <header className="ai-main-header">
              <div className="ai-left">
                <h2 className="ai-title">AI Chat</h2>
                <div className="ai-sub">Ask anything</div>
                {!canUseAI && (
                  <div className="ai-upgrade-msg inline">
                    AI access is not enabled for your current subscription. You may receive 403
                    errors until you upgrade.
                  </div>
                )}
              </div>
              <div className="ai-right">
                <div className="ai-user-info">{userLabel}</div>
              </div>
            </header>

            <div className="ai-chat-area-noscroll">
              {messages.length === 0 && !loading && (
                <div className="ai-placeholder">Start the conversation..</div>
              )}
              <div className="messages-list">
                {messages.map((m, i) => (
                  <div key={i}>{renderBubble(m)}</div>
                ))}
                {loading && (
                  <div className="typing-row">
                    <div className="bot-avatar">AI</div>
                    <div className="typing">AI is typing...</div>
                  </div>
                )}
              </div>
            </div>

            <div className="ai-composer-noscroll">
              {error && <div className="ai-error">{error}</div>}

              <textarea
                className="ai-input"
                rows={2}
                value={prompt}
                placeholder="Type your message... (Enter to send, Shift+Enter newline)"
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <div className="ai-controls">
                <div className="msg-count">{messages.length} messages</div>
                <div className="controls-right">
                  <button
                    className="btn btn-clear"
                    onClick={() => {
                      setMessages([]);
                      setError(null);
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                  <button
                    className="btn btn-send"
                    onClick={handleSend}
                    disabled={loading || !prompt.trim()}
                    type="button"
                  >
                    {loading ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {deletePopup.show && (
          <div className="popup-backdrop">
            <div className="popup-box">
              <h3>Delete this chat?</h3>
              <p>This action cannot be undone.</p>
              <div className="popup-actions">
                <button className="btn-cancel" onClick={cancelDelete} type="button">
                  Cancel
                </button>
                <button className="btn-delete" onClick={confirmDelete} type="button">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
