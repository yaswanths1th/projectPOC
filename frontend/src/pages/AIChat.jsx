import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../config/api";
import { UserContext } from "../context/UserContext";
import "./AIChat.css";

/**
 * AIChat component — scroll behavior removed, full-bleed layout (no left/right gaps).
 * All original networking/logic preserved.
 */

export default function AIChat() {
  const { user, setUser } = useContext(UserContext) || {};
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]); // { role, text, ts }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Removed auto-scroll effect and chatRef usage per request
  useEffect(() => {
    // intentionally left empty — no auto-scroll
  }, [messages, loading]);

  // Read canonical user (context preferred, fallback to localStorage)
  const localUser = user || (() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  })();

  // Determine AI permission from a few shapes
  function detectCanUseAI(u) {
    if (!u) return false;
    const s = u.subscription || null;
    if (!s) return false;
    if (typeof s.can_use_ai === "boolean") return s.can_use_ai;
    if (s.plan && typeof s.plan.can_use_ai === "boolean") return s.plan.can_use_ai;
    if (typeof s.slug === "string" && s.slug.toLowerCase() === "enterprise") return true;
    return false;
  }

  const canUseAI = detectCanUseAI(localUser);

  // Candidate endpoints - try each until success
  const aiEndpoints = [
    `${(API_URL || "").replace(/\/+$/, "")}/api/ai/free-chat/`,
    `${(API_URL || "").replace(/\/+$/, "")}/accounts/ai/free-chat/`,
    `${(API_URL || "").replace(/\/+$/, "")}/api/subscription/ai/free-chat/`,
    `${(API_URL || "").replace(/\/+$/, "")}/subscription/ai/free-chat/`,
    `${(API_URL || "").replace(/\/+$/, "")}/ai/free-chat/`,
  ];

  // low-level POST caller
  async function callEndpoint(url, token, payload = { prompt: "" }) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
      const res = await axios.post(url, payload, { headers, timeout: 30000 });
      return { ok: true, data: res.data, status: res.status, url };
    } catch (err) {
      return { ok: false, error: err, status: err?.response?.status, url, response: err?.response };
    }
  }

  // try to refresh profile from likely endpoints
  async function refetchProfileOnce(token) {
    if (!token) return null;
    const profileCandidates = [
      `${(API_URL || "").replace(/\/+$/, "")}/api/auth/profile/`,
      `${(API_URL || "").replace(/\/+$/, "")}/api/profile/`,
      `${(API_URL || "").replace(/\/+$/, "")}/accounts/profile/`,
      `${(API_URL || "").replace(/\/+$/, "")}/api/viewprofile/`,
    ];
    for (const endpoint of profileCandidates) {
      try {
        const r = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` }, timeout: 7000 });
        if (r && r.data) {
          try { setUser && setUser(r.data); localStorage.setItem("user", JSON.stringify(r.data)); } catch (e) {/* ignore */ }
          return r.data;
        }
      } catch (e) { /* try next */ }
    }
    return null;
  }

  // tries endpoints, optionally refreshes profile if suspicion of stale permissions
  async function callAiWithRetries(promptText) {
    const token = localStorage.getItem("access");
    if (!token) return { ok: false, error: new Error("Authentication required"), code: "NO_TOKEN" };

    const payload = { prompt: promptText };
    let lastFailure = null;

    for (const ep of aiEndpoints) {
      const attempt = await callEndpoint(ep, token, payload);
      if (attempt.ok) return attempt;
      lastFailure = attempt;
      // if auth error, short-circuit
      if (attempt.status === 401) return attempt;
      // continue trying on 404/5xx/network
    }

    // If unsuccessful and user locally looked like they should have AI, refresh profile and retry once
    if ((lastFailure?.status === 403 || lastFailure?.status === 404) && detectCanUseAI(localUser)) {
      const refreshed = await refetchProfileOnce(token);
      if (refreshed && detectCanUseAI(refreshed)) {
        for (const ep of aiEndpoints) {
          const attempt = await callEndpoint(ep, token, payload);
          if (attempt.ok) return attempt;
          lastFailure = attempt;
          if (attempt.status === 401) return attempt;
        }
      }
    }

    return lastFailure || { ok: false, error: new Error("No endpoint responded") };
  }

  async function handleSend() {
    const text = prompt.trim();
    if (!text) return;

    setError(null);
    const userMsg = { role: "user", text, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);

    try {
      const token = localStorage.getItem("access");
      if (!token) throw new Error("You must be logged in to use AI chat.");

      if (!canUseAI) {
        // show short advisory (we still attempt to call so devs can surface backend responses)
        setError("Your plan does not indicate AI access locally. Attempting call to backend (for testing).");
      }

      const result = await callAiWithRetries(text);

      if (!result || !result.ok) {
        let msg = "AI request failed.";
        if (result?.status === 401) msg = "Authentication failed. Please log in again.";
        else if (result?.status === 403) msg = "You don't have access to AI (403). Upgrade your plan.";
        else if (result?.status === 404) msg = "AI endpoint not found (404). Check backend routes.";
        else if (result?.error?.code === "ECONNABORTED") msg = "Request timed out.";
        else if (result?.error?.message) msg = `Network error: ${result.error.message}`;
        setError(msg);
        setMessages(prev => [...prev, { role: "assistant", text: `Error: ${msg}`, ts: new Date().toISOString() }]);
        return;
      }

      const data = result.data || {};
      const reply = data.response ?? data.result ?? data.message ?? (typeof data === "string" ? data : null);
      const finalText = reply ?? JSON.stringify(data).slice(0, 800);

      setMessages(prev => [...prev, { role: "assistant", text: finalText, ts: new Date().toISOString() }]);
    } catch (err) {
      console.error("AI Chat Error:", err);
      const errMsg = err?.message || "Unknown error when calling AI";
      setError(errMsg);
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${errMsg}`, ts: new Date().toISOString() }]);
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
    const time = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
            <div className="bubble-text">{m.text}</div>
            <div className="bubble-time">{time}</div>
          </div>
        </div>
      );
    }
    return <div className="system-msg">{m.text}</div>;
  }

  // If local user lacks AI, show upgrade prompt but still allow test call UI (no scrolling)
  if (!canUseAI) {
    return (
      <div className="ai-fullscreen-noscroll">
        <main className="ai-main-noscroll">
          <header className="ai-main-header">
            <h2 className="ai-title">AI Chat</h2>
            <div className="ai-user-info">{localUser?.email ?? localUser?.username ?? "User"}</div>
          </header>

          <div className="ai-upgrade-msg boxed">
            AI access is not enabled for your current subscription.
            <br />
            {localUser ? "Please upgrade to Enterprise to use AI chat (or use test send below)." : "Please log in first."}
          </div>

          <div className="ai-chat-area-noscroll">
            <div className="messages-list">
              {messages.map((m, i) => (<div key={i}>{renderBubble(m)}</div>))}
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
              rows={3}
              value={prompt}
              placeholder="Type your message... (Enter to send)"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="ai-controls">
              <div className="msg-count">{messages.length} messages</div>
              <div className="controls-right">
                <button className="btn btn-clear" onClick={() => { setMessages([]); setError(null); }}>Clear</button>
                <button className="btn btn-send" onClick={handleSend} disabled={loading || !prompt.trim()}>
                  {loading ? "Sending..." : "Send (test)"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Normal allowed UI (fullscreen, no scroll)
  return (
    <div className="ai-fullscreen-noscroll">
      <main className="ai-main-noscroll">
        <header className="ai-main-header">
          <div className="ai-left">
            <h2 className="ai-title">AI Chat</h2>
            <div className="ai-sub">Ask anything — messages are proxied to your backend AI endpoint.</div>
          </div>
          <div className="ai-right">
            <div className="ai-user-info">{localUser?.email ?? localUser?.username ?? "User"}</div>
          </div>
        </header>

        <div className="ai-chat-area-noscroll">
          {messages.length === 0 && <div className="ai-placeholder">Start the conversation...</div>}
          <div className="messages-list">
            {messages.map((m, i) => (<div key={i}>{renderBubble(m)}</div>))}
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
              <button className="btn btn-clear" onClick={() => { setMessages([]); setError(null); }}>Clear</button>
              <button className="btn btn-send" onClick={handleSend} disabled={loading || !prompt.trim()}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
