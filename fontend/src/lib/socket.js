import { io } from "socket.io-client";

let socket = null;

/**
 * Trả về socket singleton để tạo mới chỉ khi chưa có instance nào.
 * Không kiểm tra socket.connected để tránh tạo duplicate instance
 * khi socket đang trong trạng thái "connecting".
 */
export const connectSocket = () => {
  if (socket) return socket; // ??? FIX: tr? v? instance cu d? chua connected

  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("[SOCKET] Không tìm thấy token.");
  }

  const socketURL = import.meta.env.VITE_SOCKET_URL || "/";
  console.log(`[SOCKET] Đang khởi tạo kết nối tới: ${socketURL}`);

  socket = io(socketURL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log(`[SOCKET] Đã kết nối: ${socket.id}`);
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
 * Ng?t k�t n?'i khi Logout
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("[SOCKET] Đã xoá instance socket.");
  }
};