import { io } from "socket.io-client";

let socket = null;

/**
 * Trả về socket singleton — tạo mới chỉ khi chưa có instance nào.
 * Không kiểm tra socket.connected để tránh tạo duplicate instance
 * khi socket đang ở trạng thái "connecting".
 */
export const connectSocket = () => {
  if (socket) return socket; // ← FIX: trả về instance cũ dù chưa connected

  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("[SOCKET] ⚠️ Không tìm thấy token.");
  }

  const socketURL = import.meta.env.VITE_SOCKET_URL || "/";
  console.log(`[SOCKET] 🔌 Khởi tạo kết nối tới: ${socketURL}`);

  socket = io(socketURL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log(`[SOCKET] ✅ Đã kết nối: ${socket.id}`);
  });

  socket.on("connect_error", (err) => {
    console.error(`[SOCKET] ❌ Lỗi kết nối: ${err.message}`);
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[SOCKET] ⚠️ Ngắt kết nối: ${reason}`);
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });

  return socket;
};

/**
 * Ngắt kết nối khi Logout
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("[SOCKET] ⏹️ Đã xóa instance socket.");
  }
};