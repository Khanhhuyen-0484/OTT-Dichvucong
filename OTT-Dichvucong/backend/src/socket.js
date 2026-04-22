const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
 
let io = null;
 
function initSocket(server) {
  if (io) return io;
 
  io = new Server(server, {
    cors: { origin: true, credentials: true },
    allowEIO3: true,
    transports: ["websocket", "polling"],
  });
 
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });
 
  io.on("connection", (socket) => {
    const user = socket.data.user;
    if (!user || !user.id) return;
 
    const userRoom = `user_${user.id}`;
    socket.join(userRoom);
    console.log(`[SOCKET] ✅ Online: ${user.fullName} | room=${userRoom} | socketId=${socket.id}`);
 
    io.in(userRoom).fetchSockets().then((sockets) => {
      console.log(`[SOCKET] 📋 Room ${userRoom} hiện có ${sockets.length} socket(s)`);
    });
 
    // ─────────────────────────────────────────────
    // 1. Người gọi gửi Offer
    // ─────────────────────────────────────────────
    socket.on("call-user", async (data) => {
      const { targetUserId, offer, roomId, callerName, isGroupCall, groupName } = data;
      const targetRoom = `user_${targetUserId}`;
 
      const targetSockets = await io.in(targetRoom).fetchSockets();
      console.log(`[CALL] 📞 ${user.fullName} (${user.id}) → target=${targetUserId} | isGroup=${!!isGroupCall} | target sockets=${targetSockets.length}`);
 
      if (targetSockets.length === 0) {
        socket.emit("call-rejected", { reason: "offline" });
        console.log(`[CALL] ❌ Target ${targetUserId} không online!`);
        return;
      }
 
      socket.to(targetRoom).emit("incoming-call", {
        fromUserId:  user.id,
        callerName:  callerName || user.fullName,
        offer,
        roomId,
        // ✅ FIX: truyền thông tin nhóm để IncomingCallModal hiển thị đúng
        isGroupCall: !!isGroupCall,
        groupName:   groupName || null,
      });
      console.log(`[CALL] ✅ Đã gửi incoming-call tới room ${targetRoom} | isGroup=${!!isGroupCall}`);
    });
 
    // ─────────────────────────────────────────────
    // 2. Người nhận gửi Answer
    // ─────────────────────────────────────────────
    socket.on("call-accepted", (data) => {
      const { toUserId, answer, roomId } = data;
      console.log(`[CALL] ✔️  ${user.fullName} chấp nhận → gửi answer tới user_${toUserId}`);
 
      socket.to(`user_${toUserId}`).emit("call-accepted", {
        fromUserId: user.id,
        answer,
        roomId,
      });
    });
 
    // ─────────────────────────────────────────────
    // 3. ICE Candidate relay
    // ─────────────────────────────────────────────
    socket.on("ice-candidate", (data) => {
      const { toUserId, candidate } = data;
      if (!toUserId || !candidate) {
        console.warn(`[ICE] ⚠️ Thiếu toUserId hoặc candidate từ ${user.fullName}`);
        return;
      }
      console.log(`[ICE] 🧊 ${user.fullName} (${user.id}) → user_${toUserId}`);
      socket.to(`user_${toUserId}`).emit("ice-candidate", {
        fromUserId: user.id,
        candidate,
      });
    });
 
    // ─────────────────────────────────────────────
    // 4. Kết thúc / Từ chối cuộc gọi
    // ─────────────────────────────────────────────
    socket.on("end-call", (data) => {
      const { toUserId } = data;
      console.log(`[CALL] 📵 ${user.fullName} kết thúc → user_${toUserId}`);
      // FIX: truyền fromUserId để client nhóm chỉ xóa peer này
      socket.to(`user_${toUserId}`).emit("call-ended", { fromUserId: user.id });
    });
 
    socket.on("call-rejected", (data) => {
      const { toUserId } = data;
      console.log(`[CALL] 🚫 ${user.fullName} từ chối → user_${toUserId}`);
      // FIX: truyền fromUserId để client nhóm chỉ xóa peer này, không đóng hết
      socket.to(`user_${toUserId}`).emit("call-rejected", { fromUserId: user.id });
      socket.to(`user_${toUserId}`).emit("call-ended",    { fromUserId: user.id });
    });
 
    // ─────────────────────────────────────────────
    // 5. Group call: relay offer từ member mới join
    //    Dùng khi 1 member join muộn, cần gửi offer
    //    đến các member đang trong phòng
    // ─────────────────────────────────────────────
    socket.on("group-call-offer", async (data) => {
      const { toUserId, offer, roomId } = data;
      const targetRoom = `user_${toUserId}`;
      const targetSockets = await io.in(targetRoom).fetchSockets();
      if (targetSockets.length === 0) return;
 
      socket.to(targetRoom).emit("group-call-offer", {
        fromUserId: user.id,
        callerName: user.fullName,
        offer,
        roomId,
      });
      console.log(`[CALL] 📡 group-call-offer: ${user.fullName} → user_${toUserId}`);
    });
 
    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] ❌ Offline: ${user.fullName} | reason=${reason}`);
    });
  });
 
  return io;
}
 
async function isUserOnline(userId) {
  if (!io) return false;
  const sockets = await io.in(`user_${userId}`).fetchSockets();
  return sockets.length > 0;
}
 
function getIo() {
  if (!io) throw new Error("[SOCKET] io chưa được khởi tạo. Gọi initSocket(server) trước.");
  return io;
}
 
module.exports = { initSocket, getIo, isUserOnline };