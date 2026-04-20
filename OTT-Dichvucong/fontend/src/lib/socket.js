import { io } from "socket.io-client";

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem("token");
  const serverUrl = import.meta.env.DEV ? "http://localhost:3000" : "";
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
    reconnectionDelayMax: 5000
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] connect_error", err.message);
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
