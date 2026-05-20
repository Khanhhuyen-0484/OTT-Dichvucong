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
    console.log("[socket] connected", socket.id, user?.id || "anonymous");

    if (user?.id) {
      socket.join(`user_${user.id}`);
    }
    if (user?.role === "admin") {
      socket.join("admin");
    }

    socket.on("joinRoom", ({ room }) => {
      if (typeof room === "string" && room.trim()) {
        const joined = room.trim();
        socket.join(joined);
        console.log("[socket] joinRoom", socket.id, joined);
      }
    });

    socket.on("leaveRoom", ({ room }) => {
      if (typeof room === "string" && room.trim()) {
        const left = room.trim();
        socket.leave(left);
        console.log("[socket] leaveRoom", socket.id, left);
      }
    });

    socket.on("call:invite", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      if (!roomId) return;
      const eventPayload = {
        roomId,
        fromUserId: user?.id,
        callType: payload.callType === "group" ? "group" : "direct",
        createdAt: new Date().toISOString()
      };
      io.to(`chat_${roomId}`).emit("call:invite", eventPayload);
      console.log("[socket] call:invite", roomId, eventPayload.callType, user?.id);
    });

    socket.on("call:ringing", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      if (!roomId) return;
      io.to(`chat_${roomId}`).emit("call:ringing", {
        roomId,
        userId: user?.id,
        createdAt: new Date().toISOString()
      });
    });

    socket.on("call:accept", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      if (!roomId) return;
      io.to(`chat_${roomId}`).emit("call:accept", {
        roomId,
        userId: user?.id,
        createdAt: new Date().toISOString()
      });
      console.log("[socket] call:accept", roomId, user?.id);
    });

    socket.on("call:reject", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      if (!roomId) return;
      io.to(`chat_${roomId}`).emit("call:reject", {
        roomId,
        userId: user?.id,
        reason: String(payload.reason || "rejected"),
        createdAt: new Date().toISOString()
      });
      console.log("[socket] call:reject", roomId, user?.id);
    });

    socket.on("call:end", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      if (!roomId) return;
      io.to(`chat_${roomId}`).emit("call:end", {
        roomId,
        userId: user?.id,
        createdAt: new Date().toISOString()
      });
      console.log("[socket] call:end", roomId, user?.id);
    });

    socket.on("webrtc:offer", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      const toUserId = String(payload.toUserId || "").trim();
      if (!roomId || !toUserId || !payload.sdp) return;
      io.to(`user_${toUserId}`).emit("webrtc:offer", {
        roomId,
        fromUserId: user?.id,
        sdp: payload.sdp
      });
    });

    socket.on("webrtc:answer", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      const toUserId = String(payload.toUserId || "").trim();
      if (!roomId || !toUserId || !payload.sdp) return;
      io.to(`user_${toUserId}`).emit("webrtc:answer", {
        roomId,
        fromUserId: user?.id,
        sdp: payload.sdp
      });
    });

    socket.on("webrtc:ice-candidate", (payload = {}) => {
      const roomId = String(payload.roomId || "").trim();
      const toUserId = String(payload.toUserId || "").trim();
      if (!roomId || !toUserId || !payload.candidate) return;
      io.to(`user_${toUserId}`).emit("webrtc:ice-candidate", {
        roomId,
        fromUserId: user?.id,
        candidate: payload.candidate
      });
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
