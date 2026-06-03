import { io } from "socket.io-client";

let socket = null;
let socketToken = "";

function resolveSocketUrl() {
  const explicit = String(import.meta.env.VITE_SOCKET_URL || "").trim();
  if (explicit) return explicit;

  const apiBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (/^https?:\/\//i.test(apiBase)) {
    return apiBase.replace(/\/api\/?$/i, "");
  }

  return "/";
}

/**
 * Trả về socket singleton để tạo mới chỉ khi chưa có instance nào.
 * Không kiểm tra socket.connected để tránh tạo duplicate instance
 * khi socket đang trong trạng thái "connecting".
 */
export const connectSocket = () => {
  const token = localStorage.getItem("token") || "";
  if (socket && socketToken === token) {
    if (!socket.connected) socket.connect();
    return socket; // Trả về instance cũ nếu vẫn cùng token.
  }

  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = "";
    console.log("[SOCKET] Token thay đổi, khởi tạo lại kết nối.");
  }

  if (!token) {
    console.warn("[SOCKET] Không tìm thấy token.");
  }

  const socketURL = resolveSocketUrl();
  console.log(`[SOCKET] Đang khởi tạo kết nối tới: ${socketURL}`);

  socket = io(socketURL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    withCredentials: true,
  });
  socketToken = token;

  socket.on("connect", () => {
    console.log(`[SOCKET] Đã kết nối: ${socket.id}`);
  });

  socket.on("socket-ready", (payload) => {
    console.log("[SOCKET] Đã join user room:", payload);
  });

  socket.on("connect_error", (err) => {
    console.error(`[SOCKET] Lỗi kết nối: ${err.message}`);
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[SOCKET] Đã ngắt kết nối: ${reason}`);
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });

  return socket;
};

/**
 * Ngắt kết nối khi logout.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = "";
    console.log("[SOCKET] Đã xoá instance socket.");
  }
};