const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

function initSocket(server) {
  if (io) return io;

  io = new Server(server, {
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch { next(new Error("Invalid token")); }
  });

  io.on("connection", (socket) => {
    const { user } = socket.data;
    if (user?.id) socket.join(`user_${user.id}`);

    socket.on("call-user", (data) => {
      io.to(`user_${data.targetUserId}`).emit("incoming-call", {
        fromUserId: user?.id,
        callerName: data.callerName || user?.fullName,
        roomId: data.roomId,
        offer: data.offer,
      });
    });

    socket.on("call-accepted", (data) => {
      io.to(`user_${data.toUserId}`).emit("call-accepted", { answer: data.answer });
    });

    socket.on("ice-candidate", (data) => {
      io.to(`user_${data.toUserId}`).emit("ice-candidate", { candidate: data.candidate });
    });

    socket.on("end-call", (data) => {
      if (data.toUserId) io.to(`user_${data.toUserId}`).emit("call-ended");
    });

    socket.on("disconnect", () => console.log("Disconnected:", user?.fullName));
  });

  return io;
}

module.exports = { initSocket };