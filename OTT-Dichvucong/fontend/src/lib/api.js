import axios from "axios";

const envBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const baseURL = envBase || "/api";

const api = axios.create({
  baseURL,
  timeout: 20000
});
const API = api;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  config.headers = config.headers || {};
  config.headers.Accept = "application/json";
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

if (import.meta.env.DEV) {
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      const url = err.config?.baseURL + (err.config?.url || "");
      console.error("[API lỗi]", url, err.response?.status, err.response?.data);
      return Promise.reject(err);
    }
  );
}

/**
 * Trích thông báo lỗi từ axios (Network Error, 500 có { message, error }, v.v.)
 */
export function getApiErrorMessage(err) {
  if (!err) return "Lỗi không xác định";
  const data = err.response?.data;
  if (typeof data === "string" && data.trim()) {
    const s = data.trim();
    if (s.startsWith("<!DOCTYPE") || s.startsWith("<html")) {
      return `Server trả về HTML (không phải JSON). HTTP ${err.response?.status}. Kiểm tra backend có chạy đúng API không.`;
    }
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  }
  if (data && typeof data === "object") {
    const msg = data.message;
    const detail = data.error;
    const smtp = data.smtp;
    const smtpLine =
      smtp &&
      (smtp.response || smtp.responseCode || smtp.code)
        ? [
            smtp.responseCode && `SMTP ${smtp.responseCode}`,
            smtp.code && String(smtp.code),
            smtp.response && String(smtp.response)
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
    if (msg && detail && smtpLine) return `${msg} — ${detail} (${smtpLine})`;
    if (msg && detail) return `${msg} — ${detail}`;
    if (msg && smtpLine) return `${msg} (${smtpLine})`;
    if (msg) return String(msg);
    if (detail) return String(detail);
    if (smtpLine) return smtpLine;
    try {
      const raw = JSON.stringify(data);
      if (raw && raw !== "{}") return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
    } catch {
      /* ignore */
    }
  }
  const code = err.code;
  if (code === "ECONNREFUSED" || err.message === "Network Error") {
    return "Không kết nối được server API. Hãy chạy backend (node backend/src/app.js, cổng 3000) và thử lại.";
  }
  return err.message || String(err);
}

export { baseURL as resolvedApiBaseUrl };

export async function sendOtp(email) {
  return await api.post("/send-otp", { email });
}

export async function register(payload) {
  return await api.post("/register", payload);
}

export async function forgotPassword(email) {
  return await api.post("/forgot-password", { email });
}

export async function login(data) {
  return API.post("/login", data);
}

export async function getMe() {
  try {
    return await api.get("/me");
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.get("/auth/me");
    }
    throw err;
  }
}

export async function patchProfile(payload) {
  try {
    return await api.patch("/me", payload);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.patch("/auth/me", payload);
    }
    throw err;
  }
}

export async function presignAvatarUpload(payload) {
  try {
    return await api.post("/me/avatar/presign", payload);
  } catch (err) {
    if (err.response?.status === 404) {
      return await api.post("/auth/me/avatar/presign", payload);
    }
    throw err;
  }
}

export async function getStaffChat() {
  return await api.get("/chat/staff");
}

export async function postStaffChat(text) {
  return await api.post("/chat/staff", { text });
}

export async function postAiChat(payload) {
  return await api.post("/chat/ai", payload);
}

export async function getChatContacts(query = "") {
  return await api.get("/chat/contacts", { params: { q: query } });
}

export async function getChatRooms() {
  return await api.get("/chat/rooms");
}

export async function getChatRoomDetail(roomId) {
  return await api.get(`/chat/rooms/${roomId}`);
}

export async function ensureDirectRoom(userId) {
  return await api.post("/chat/direct/ensure", { userId });
}

export async function createGroupRoom(payload) {
  return await api.post("/chat/groups", payload);
}

export async function postRoomMessage(roomId, payload) {
  return await api.post(`/chat/rooms/${roomId}/messages`, payload);
}

export async function presignChatMediaUpload(payload) {
  return await api.post("/chat/media/presign", payload);
}

export async function unsendRoomMessage(roomId, messageId) {
  return await api.post(`/chat/rooms/${roomId}/messages/${messageId}/unsend`);
}

export async function deleteRoomMessageForMe(roomId, messageId) {
  return await api.post(`/chat/rooms/${roomId}/messages/${messageId}/delete`);
}

export async function forwardRoomMessage(roomId, messageId, targetRoomId) {
  return await api.post(`/chat/rooms/${roomId}/messages/${messageId}/forward`, { targetRoomId });
}

export async function addGroupMember(roomId, memberId) {
  return await api.post(`/chat/groups/${roomId}/members`, { memberId });
}

export async function removeGroupMember(roomId, memberId) {
  return await api.delete(`/chat/groups/${roomId}/members/${memberId}`);
}

export async function assignGroupDeputy(roomId, memberId) {
  return await api.post(`/chat/groups/${roomId}/deputies/${memberId}`);
}

export async function removeGroupDeputy(roomId, memberId) {
  return await api.delete(`/chat/groups/${roomId}/deputies/${memberId}`);
}

export async function dissolveGroup(roomId) {
  return await api.delete(`/chat/groups/${roomId}`);
}

export async function getAdminDashboard() {
  return await api.get("/admin/dashboard");
}

export async function getAdminDossiers(query = "") {
  return await api.get("/admin/dossiers", { params: { q: query } });
}

export async function getAdminDossierDetail(id) {
  return await api.get(`/admin/dossiers/${id}`);
}

export async function postAdminDossierDecision(id, payload) {
  return await api.post(`/admin/dossiers/${id}/decision`, payload);
}

export async function postAdminOpenDossierChat(id) {
  return await api.post(`/admin/dossiers/${id}/chat-open`);
}

export async function getAdminSupportConversations() {
  return await api.get("/admin/support/conversations");
}

export async function getAdminSupportConversation(id) {
  return await api.get(`/admin/support/conversations/${id}`);
}

export async function postAdminSupportMessage(id, text) {
  return await api.post(`/admin/support/conversations/${id}/messages`, { text });
}

export async function postAdminSupportResolve(id) {
  return await api.post(`/admin/support/conversations/${id}/resolve`);
}

export async function getAdminAiHistory() {
  return await api.get("/admin/ai/history");
}

export async function getAdminAiRules() {
  return await api.get("/admin/ai/rules");
}

export async function putAdminAiRules(rulesText) {
  return await api.put("/admin/ai/rules", { rulesText });
}

export { api };

export default api;

