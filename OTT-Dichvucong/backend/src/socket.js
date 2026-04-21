const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

function initSocket(server) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    },
    allowEIO3: true
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Không có token socket"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Token socket không hợp lệ"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket.data;
    if (user?.id) {
      socket.join(`user_${user.id}`);
    }
    if (user?.role === "admin") {
      socket.join("admin");
    }

    socket.on("joinRoom", ({ room }) => {
      if (typeof room === "string" && room.trim()) {
        socket.join(room.trim());
      }
    });

    socket.on("leaveRoom", ({ room }) => {
      if (typeof room === "string" && room.trim()) {
        socket.leave(room.trim());
      }
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.IO chưa được khởi tạo");
  }
  return io;
}

module.exports = {
  initSocket,
  getIo
};
