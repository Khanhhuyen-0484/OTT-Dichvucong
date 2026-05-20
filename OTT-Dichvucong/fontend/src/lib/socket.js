<<<<<<< HEAD
import { io } from "socket.io-client";

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem("token");
  const serverUrl = String(
    import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_ORIGIN ||
      (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin)
  ).trim();
  const auth = token ? { token } : {};

  if (socket && socket.auth?.token === auth.token && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(serverUrl, {
    auth,
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });

  socket.on("connect", () => {
    console.info("[Socket] connected", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] connect_error", err.message);
  });

  socket.on("reconnect_attempt", (attempt) => {
    console.info("[Socket] reconnect_attempt", attempt);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
=======
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
>>>>>>> 51cc27517d280490b4c1eb1cd5d570b82366995d
