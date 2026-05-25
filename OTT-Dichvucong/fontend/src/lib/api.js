import axios from "axios";

const envBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
export const resolvedApiBaseUrl = envBase || "/api";

export const api = axios.create({ baseURL: resolvedApiBaseUrl, timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  config.headers = config.headers || {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers.Accept = "application/json";
  return config;
});

export function getApiErrorMessage(err) { return err?.response?.data?.message || err?.message || "Lỗi không xác định"; }

export async function postAiChat(payload) { return api.post("/chat/ai", payload); }
export async function getMe() { return api.get("/me"); }
export async function patchProfile(payload) { return api.patch("/me", payload); }
export async function login(payload) { return api.post("/auth/login", payload); }
export async function register(payload) { return api.post("/auth/register", payload); }
export async function sendOtp(email) { return api.post("/auth/send-otp", { email }); }
export async function forgotPassword(email) { return api.post("/auth/forgot-password", { email }); }
export async function getServices(params = {}) { return api.get("/services", { params }); }
export async function getServiceById(id) { return api.get(`/services/${id}`); }
export async function submitServiceApplication(payload) { return api.post("/services/submit", payload); }
export async function trackApplication(code) { return api.get(`/services/track/${code}`); }
export async function getApplicationByCode(code) { return api.get(`/services/application/code/${code}`); }
export async function getMyApplications() { return api.get("/services/my-applications"); }
export async function payForApplication(payload) { return api.post("/services/pay", payload); }
export async function supplementApplication(applicationCode, payload) { return api.post(`/services/application/${applicationCode}/supplement`, payload); }
export async function downloadApplicationResult(applicationCode) { return api.get(`/services/application/${applicationCode}/result`); }
export async function getServiceNotifications() { return api.get("/services/notifications"); }
export async function getServicePayments(applicationId) { return api.get(`/services/payments/${applicationId}`); }
export async function presignAttachmentUpload(payload) { return api.post("/upload/presign", payload); }
export async function generatePaymentQr(payload) { return api.post("/services/payment-qr", payload); }
export async function verifyPaymentStatus(applicationCode) { return api.get(`/services/payment-status/${applicationCode}`); }
export async function mockPaymentComplete(applicationCode) { return api.post(`/services/payment-mock/${applicationCode}`); }

export async function getStaffChat() { return api.get("/chat/staff"); }
export async function postStaffChat(text) { return api.post("/chat/staff", { text }); }
export async function getChatContacts(query = "") { return api.get("/chat/contacts", { params: { query } }); }
export async function getChatRooms() { return api.get("/chat/rooms"); }
export async function ensureDirectRoom(contactId) { return api.post("/chat/direct/ensure", { userId: contactId }); }
export async function createGroupRoom(payload) { return api.post("/chat/groups", { name: payload?.name, avatarUrl: payload?.avatarUrl || payload?.avatar || "", memberIds: payload?.memberIds || [] }); }
export async function postRoomMessage(roomId, payload) { return api.post(`/chat/rooms/${roomId}/messages`, payload); }
export async function deleteRoomMessageForMe(roomId, messageId) { return api.post(`/chat/rooms/${roomId}/messages/${messageId}/delete`); }
export async function unsendRoomMessage(roomId, messageId) { return api.post(`/chat/rooms/${roomId}/messages/${messageId}/unsend`); }
export async function togglePinRoomMessage(roomId, messageId) { return api.post(`/chat/rooms/${roomId}/messages/${messageId}/pin`); }
export async function forwardRoomMessage(roomId, messageId, targetRoomId) { return api.post(`/chat/rooms/${roomId}/messages/${messageId}/forward`, { targetRoomId }); }
export async function addGroupMember(roomId, memberId) { return api.post(`/chat/groups/${roomId}/members`, { memberId }); }
export async function removeGroupMember(roomId, memberId) { return api.delete(`/chat/groups/${roomId}/members/${memberId}`); }
export async function assignGroupDeputy(roomId, memberId) { return api.post(`/chat/groups/${roomId}/deputies/${memberId}`); }
export async function removeGroupDeputy(roomId, memberId) { return api.delete(`/chat/groups/${roomId}/deputies/${memberId}`); }
export async function updateGroupRoom(roomId, payload) { return api.patch(`/chat/groups/${roomId}`, payload); }
export async function dissolveGroup(roomId) { return api.delete(`/chat/groups/${roomId}`); }
export async function getFriendDiscovery(query) { return api.get("/chat/friends/discovery", { params: { query } }); }
export async function getFriendRequests() { return api.get("/chat/friends/requests"); }
export async function getFriendSuggestions(limit = 5) { return api.get("/chat/friends/suggestions", { params: { limit } }); }
export async function getGroupInvites() { return api.get("/chat/groups/invites"); }
export async function getBlockedFriends() { return api.get("/chat/friends/blocked"); }
export async function postFriendRequest(userId) { return api.post("/chat/friends/request", { targetUserId: userId }); }
export async function postFriendRequestResponse(userId, action) { return api.post(`/chat/friends/request/${userId}/respond`, { action }); }
export async function deleteFriendRequest(userId) { return api.delete(`/chat/friends/request/${userId}`); }
export async function deleteFriend(userId) { return api.delete(`/chat/friends/${userId}`); }
export async function postBlockFriend(userId) { return api.post(`/chat/friends/${userId}/block`); }
export async function postUnblockFriend(userId) { return api.post(`/chat/friends/${userId}/unblock`); }
export async function postGroupInvites(roomId, memberIds) { return api.post(`/chat/groups/${roomId}/invites`, { memberIds }); }
export async function postGroupInviteResponse(roomId, action) { return api.post(`/chat/groups/${roomId}/invites/response`, { action }); }

export async function getAdminDashboard() { return api.get("/admin/dashboard"); }
export async function getAdminStatistics(params = {}) { return api.get("/admin/statistics", { params }); }
export async function getAdminDossiers(query = "") { return api.get("/admin/dossiers", { params: { query } }); }
export async function getAdminSupportConversations() { return api.get("/admin/support/conversations"); }
export async function getAdminSupportConversation(id) { return api.get(`/admin/support/conversations/${id}`); }
export async function postAdminSupportMessage(id, text) { return api.post(`/admin/support/conversations/${id}/messages`, { text }); }
export async function postAdminSupportResolve(id) { return api.post(`/admin/support/conversations/${id}/resolve`); }
export async function getAdminAiHistory() { return api.get("/admin/ai/history"); }
export async function getAdminAiRules() { return api.get("/admin/ai/rules"); }
export async function putAdminAiRules(rulesText) { return api.put("/admin/ai/rules", { rulesText }); }
export async function createService(payload) { return api.post("/services/admin", payload); }
export async function seedServices() { return api.post("/services/admin/seed"); }
export async function updateService(serviceId, payload) { return api.put(`/services/admin/${serviceId}`, payload); }
export async function deleteService(serviceId) { return api.delete(`/services/admin/${serviceId}`); }
export async function updateAdminDossierStatus(id, payload) { return api.patch(`/admin/dossiers/${id}/status`, payload); }
export async function getAdminServiceCategories() { return api.get("/admin/service-categories"); }
export async function seedAdminServiceCategories() { return api.post("/admin/service-categories/seed"); }
export async function createBankTransferPayment(payload) { return api.post("/payments/bank-transfer/create", payload); }
export async function getBankTransferPaymentStatus(dossierId) { return api.get(`/payments/status/${dossierId}`); }

export default api;
