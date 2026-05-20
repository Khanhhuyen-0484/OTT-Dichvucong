import { io } from "socket.io-client";

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.debug("[Socket] skip connect: no token");
    return null;
  }

  if (socket?.connected && socket.auth?.token === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("http://localhost:3000", {
    auth: { token },
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
    console.log("SOCKET ERROR:", err.message);
    console.warn("[Socket] connect_error", err.message, err);
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
