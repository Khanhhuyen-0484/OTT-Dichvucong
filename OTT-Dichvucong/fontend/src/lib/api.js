import axios from "axios";

const envBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const baseURL = envBase || "/api";

const api = axios.create({
  baseURL,
  timeout: 20000,
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
    },
  );
}

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
      smtp && (smtp.response || smtp.responseCode || smtp.code)
        ? [
            smtp.responseCode && `SMTP ${smtp.responseCode}`,
            smtp.code && String(smtp.code),
            smtp.response && String(smtp.response),
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

      if (raw && raw !== "{}") {
        return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
      }
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
export { api };

export async function sendOtp(email) {
  return await api.post("/auth/send-otp", { email });
}

export async function register(payload) {
  return await api.post("/auth/register", payload);
}

export async function forgotPassword(email) {
  return await api.post("/auth/forgot-password", { email });
}

export async function forgotPasswordOtp(email) {
  return await api.post("/forgot-password/otp", { email });
}

export async function resetPasswordWithOtp(payload) {
  return await api.post("/reset-password/otp", payload);
}

export async function login(data) {
  return API.post("/auth/login", data);
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

export async function deleteMe() {
  return api.delete("/me");
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

export async function getServices(params = {}) {
  return api.get("/services", { params });
}

export async function getServiceById(id) {
  return api.get(`/services/${id}`);
}

export async function submitServiceApplication(payload) {
  return api.post("/services/submit", payload);
}

export async function trackApplication(code) {
  return api.get(`/services/track/${code}`);
}

export async function getApplicationByCode(code) {
  return api.get(`/services/application/code/${code}`);
}

export async function getMyApplications() {
  return api.get("/services/my-applications");
}

export async function payForApplication(payload) {
  return api.post("/services/pay", payload);
}

export async function supplementApplication(applicationCode, payload) {
  return api.post(
    `/services/application/${applicationCode}/supplement`,
    payload,
  );
}

export async function downloadApplicationResult(applicationCode) {
  return api.get(`/services/application/${applicationCode}/result`);
}

export async function getServiceNotifications() {
  return api.get("/services/notifications");
}

export async function getServicePayments(applicationId) {
  return api.get(`/services/payments/${applicationId}`);
}

export async function presignAttachmentUpload(payload) {
  return api.post("/upload/presign", payload);
}

export async function generatePaymentQr(payload) {
  return api.post("/services/payment-qr", payload);
}

export async function verifyPaymentStatus(applicationCode) {
  return api.get(`/services/payment-status/${applicationCode}`);
}

export async function mockPaymentComplete(applicationCode) {
  return api.post(`/services/payment-mock/${applicationCode}`);
}

export async function createBankTransferPayment(payload) {
  return api.post("/payments/bank-transfer/create", payload);
}

export async function getBankTransferPaymentStatus(dossierId) {
  return api.get(`/payments/status/${dossierId}`);
}

export async function postAiChat(payload) {
  return await api.post("/chat/ai", payload);
}

export async function getStaffChat() {
  return await api.get("/chat/staff");
}

export async function postStaffChat(text) {
  return await api.post("/chat/staff", { text });
}

export async function getChatContacts(query = "") {
  return await api.get("/chat/contacts", {
    params: { q: query },
  });
}

export async function getChatRooms() {
  return await api.get("/chat/rooms");
}

export async function getChatRoomDetail(roomId) {
  return await api.get(`/chat/rooms/${roomId}`);
}

export async function ensureDirectRoom(userId) {
  return await api.post("/chat/direct/ensure", {
    userId,
  });
}

export async function createGroupRoom(payload) {
  return await api.post("/chat/groups", {
    name: payload?.name,
    avatarUrl: payload?.avatarUrl || payload?.avatar || "",
    memberIds: payload?.memberIds || [],
  });
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

export async function togglePinRoomMessage(roomId, messageId) {
  return await api.post(`/chat/rooms/${roomId}/messages/${messageId}/pin`);
}

export async function forwardRoomMessage(roomId, messageId, targetRoomId) {
  return await api.post(`/chat/rooms/${roomId}/messages/${messageId}/forward`, {
    targetRoomId,
  });
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

export async function updateGroupInfo(roomId, payload) {
  return await api.patch(`/chat/groups/${roomId}`, payload);
}

export async function updateGroupRoom(roomId, payload) {
  return await api.patch(`/chat/groups/${roomId}`, payload);
}

export async function getFriendDiscovery(query) {
  return api.get("/chat/friends/discovery", {
    params: { query },
  });
}

export async function getFriendRequests() {
  return api.get("/chat/friends/requests");
}

export async function getFriendSuggestions(limit = 5) {
  return api.get("/chat/friends/suggestions", {
    params: { limit },
  });
}

export async function getGroupInvites() {
  return api.get("/chat/groups/invites");
}

export async function getBlockedFriends() {
  return api.get("/chat/friends/blocked");
}

export async function postFriendRequest(userId) {
  return api.post("/chat/friends/request", {
    targetUserId: userId,
  });
}

export async function postFriendRequestResponse(userId, action) {
  return api.post(`/chat/friends/request/${userId}/respond`, { action });
}

export async function deleteFriendRequest(userId) {
  return api.delete(`/chat/friends/request/${userId}`);
}

export async function deleteFriend(userId) {
  return api.delete(`/chat/friends/${userId}`);
}

export async function postBlockFriend(userId) {
  return api.post(`/chat/friends/${userId}/block`);
}

export async function postUnblockFriend(userId) {
  return api.post(`/chat/friends/${userId}/unblock`);
}

export async function postGroupInvites(roomId, memberIds) {
  return api.post(`/chat/groups/${roomId}/invites`, {
    memberIds,
  });
}

export async function postGroupInviteResponse(roomId, action) {
  return api.post(`/chat/groups/${roomId}/invites/response`, { action });
}

export async function getAdminDashboard() {
  return await api.get("/admin/dashboard");
}

export async function getAdminStatistics(params = {}) {
  return api.get("/admin/statistics", { params });
}

export async function getAdminDossiers(query = "") {
  return await api.get("/admin/dossiers", {
    params: { q: query },
  });
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
  return await api.post(`/admin/support/conversations/${id}/messages`, {
    text,
  });
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
  return await api.put("/admin/ai/rules", {
    rulesText,
  });
}

export async function createService(payload) {
  return api.post("/services/admin", payload);
}

export async function seedServices() {
  return api.post("/services/admin/seed");
}

export async function updateService(serviceId, payload) {
  return api.put(`/services/admin/${serviceId}`, payload);
}

export async function deleteService(serviceId) {
  return api.delete(`/services/admin/${serviceId}`);
}

export async function updateAdminDossierStatus(id, payload) {
  return api.patch(`/admin/dossiers/${id}/status`, payload);
}

export async function getAdminServiceCategories() {
  return api.get("/admin/service-categories");
}

export async function seedAdminServiceCategories() {
  return api.post("/admin/service-categories/seed");
}

export default api;
