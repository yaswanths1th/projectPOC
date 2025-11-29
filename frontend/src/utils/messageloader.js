// 🔐 Message Loader — Fetch system messages (errors, validations, info)
// ✅ IMPORTANT: Only localStorage for MESSAGE TABLES, NOT for tokens!

export async function loadMessages() {
  try {
    // ✅ Clear old cache
    localStorage.removeItem("messages_loaded");

    const res = await fetch("http://127.0.0.1:8000/api/auth/messages/", {
      credentials: "include",  // 🔐 Send cookies if needed
    });

    if (!res.ok) throw new Error("Failed to fetch message tables");

    const data = await res.json();

    // ✅ Save ONLY message tables (not tokens!)
    localStorage.setItem("user_error", JSON.stringify(data.user_error || []));
    localStorage.setItem("user_information", JSON.stringify(data.user_information || []));
    localStorage.setItem("user_validation", JSON.stringify(data.user_validation || []));

    // ✅ Mark as loaded
    localStorage.setItem("messages_loaded", "1");
  } catch (e) {
    console.warn("⚠️ Failed to load messages:", e);

    // ✅ Fallback structure
    if (!localStorage.getItem("user_error")) {
      localStorage.setItem("user_error", "[]");
    }
    if (!localStorage.getItem("user_information")) {
      localStorage.setItem("user_information", "[]");
    }
    if (!localStorage.getItem("user_validation")) {
      localStorage.setItem("user_validation", "[]");
    }
  }
}

// ✅ Helper functions to lookup text
export const getErrorText = (list, code) => {
  try {
    const c = (code || "").toUpperCase();
    const item = list.find((e) => e.error_code === c);
    return item ? item.error_message : "";
  } catch {
    return "";
  }
};

export const getInfoText = (list, code) => {
  try {
    const c = (code || "").toUpperCase();
    const item = list.find((i) => i.information_code === c);
    return item ? item.information_text : "";
  } catch {
    return "";
  }
};

