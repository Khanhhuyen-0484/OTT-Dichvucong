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
