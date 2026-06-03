const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const multiChatStore = require("./store/multiChatStore");
const {
  AI_ASSISTANT_ID,
  buildAiMessage,
  generateAiReply,
} = require("./services/aiService");
 
let io = null;
const callSessions = new Map();
const activeGroupCallRooms = new Map();

function normalizeId(value) {
  return String(value || "").trim();
}

function parseChatRoomIdFromCallRoomId(callRoomId) {
  const match = String(callRoomId || "").match(/^call_(.+)_\d+$/);
  return match?.[1] || "";
}

function getCallSession(callRoomId) {
  const roomId = normalizeId(callRoomId);
  if (!roomId) return null;
  if (!callSessions.has(roomId)) {
    callSessions.set(roomId, {
      roomId,
      callerId: "",
      callerName: "",
      isGroupCall: false,
      startedAt: new Date().toISOString(),
      endedAt: null,
      activeParticipants: new Set(),
      invitedParticipants: new Set(),
      rejectedParticipants: new Set(),
      joinedParticipants: new Set(),
      hasJoinedMember: false,
      firstJoinTime: null,
      finalStatusLogged: false,
      createdAt: Date.now(),
    });
  }
  return callSessions.get(roomId);
}

function callStateSnapshot(callRoomId, status = "") {
  const session = getCallSession(callRoomId);
  if (!session) {
    return {
      roomId: normalizeId(callRoomId),
      participantCount: 0,
      joinedCount: 0,
      joinedParticipants: [],
      hasJoinedMember: false,
      firstJoinTime: null,
      status,
    };
  }
  return {
    roomId: session.roomId,
    callerId: session.callerId,
    callerName: session.callerName,
    isGroupCall: session.isGroupCall,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    participantCount: session.activeParticipants.size,
    activeParticipants: Array.from(session.activeParticipants),
    invitedParticipants: Array.from(session.invitedParticipants),
    joinedCount: session.joinedParticipants.size,
    joinedParticipants: Array.from(session.joinedParticipants),
    hasJoinedMember: session.hasJoinedMember,
    firstJoinTime: session.firstJoinTime,
    status,
  };
}

function logCallState(callRoomId, status) {
  console.log("[CALL_ROOM_STATE]", callStateSnapshot(callRoomId, status));
}

function logGroupCallDebug(callRoomId, action, extra = {}) {
  const snapshot = callStateSnapshot(callRoomId, action);
  console.log("[GROUP_CALL_DEBUG]", {
    action,
    roomId: snapshot.roomId,
    userId: extra.userId || "",
    participantCount: snapshot.participantCount,
    participants: snapshot.activeParticipants || [],
    joinedParticipants: snapshot.joinedParticipants || [],
    ...extra,
  });
}

function rememberCallInvite({ callRoomId, callerId, callerName, targetUserId, isGroupCall = false }) {
  const session = getCallSession(callRoomId);
  if (!session) return;
  const normalizedCallerId = normalizeId(callerId);
  const nextCallerName = String(callerName || "");
  if (!session.callerId && normalizedCallerId) {
    session.callerId = normalizedCallerId;
    session.callerName = nextCallerName;
  } else if (normalizedCallerId && session.callerId !== normalizedCallerId) {
    logGroupCallDebug(callRoomId, "ignore caller overwrite", {
      userId: normalizedCallerId,
      originalCallerId: session.callerId,
    });
  } else if (!session.callerName && nextCallerName) {
    session.callerName = nextCallerName;
  }
  if (isGroupCall) session.isGroupCall = true;
  if (session.callerId) session.activeParticipants.add(session.callerId);
  const targetId = normalizeId(targetUserId);
  if (targetId) session.invitedParticipants.add(targetId);
  logCallState(callRoomId, "ringing");
}

function rememberCallJoin(callRoomId, userId) {
  const session = getCallSession(callRoomId);
  if (!session) return;
  const joinedId = normalizeId(userId);
  if (!joinedId) return;
  session.activeParticipants.add(joinedId);
  session.joinedParticipants.add(joinedId);
  session.hasJoinedMember = true;
  if (!session.firstJoinTime) session.firstJoinTime = new Date().toISOString();
  logCallState(callRoomId, "joined");
  logGroupCallDebug(callRoomId, "join", { userId: joinedId });
}

function rememberCallLeave(callRoomId, userId) {
  const session = getCallSession(callRoomId);
  if (!session) return { shouldFinalize: false, status: "ended" };
  const leavingId = normalizeId(userId);
  if (leavingId) session.activeParticipants.delete(leavingId);
  const status = session.hasJoinedMember ? "ended" : "missed";
  const shouldFinalize = session.activeParticipants.size === 0;
  logCallState(callRoomId, leavingId === session.callerId ? "caller leave" : "participant leave");
  logGroupCallDebug(callRoomId, leavingId === session.callerId ? "caller leave" : "participant leave", { userId: leavingId });
  return { shouldFinalize, status };
}

function rememberCallRejected(callRoomId, userId) {
  const session = getCallSession(callRoomId);
  if (!session) return false;
  const rejectedId = normalizeId(userId);
  if (rejectedId) session.rejectedParticipants.add(rejectedId);
  logCallState(callRoomId, "rejected");
  return (
    session.joinedParticipants.size === 0 &&
    session.invitedParticipants.size > 0 &&
    session.rejectedParticipants.size >= session.invitedParticipants.size
  );
}

function clearActiveParticipants(callRoomId, status) {
  const session = getCallSession(callRoomId);
  if (!session) return;
  session.activeParticipants.clear();
  session.endedAt = new Date().toISOString();
  logCallState(callRoomId, status);
}

function resolveCallLogStatus(callRoomId, requestedStatus) {
  const session = getCallSession(callRoomId);
  const requested = String(requestedStatus || "").trim();
  if (!session) return requested || "ended";
  if (session.hasJoinedMember || session.joinedParticipants.size > 0) return "ended";
  if (requested === "rejected") return "missed";
  return requested || "ended";
}

function computeDurationSec(callRoomId, fallbackDurationSec = 0) {
  const session = getCallSession(callRoomId);
  if (!session) return Number(fallbackDurationSec || 0) || 0;
  const start = session.firstJoinTime || session.startedAt;
  const startedMs = Date.parse(start);
  if (!Number.isFinite(startedMs)) return Number(fallbackDurationSec || 0) || 0;
  return Math.max(0, Math.round((Date.now() - startedMs) / 1000));
}

function shouldSkipCallLog(callRoomId) {
  const session = getCallSession(callRoomId);
  return Boolean(session?.finalStatusLogged);
}

function markCallLogWritten(callRoomId, status) {
  const session = getCallSession(callRoomId);
  if (!session) return;
  session.endedAt = new Date().toISOString();
  session.finalStatusLogged = true;
  logCallState(callRoomId, `call log created:${status}`);
  clearActiveGroupCallRoom(callRoomId);
  windowCleanupCallSession(callRoomId);
}

function windowCleanupCallSession(callRoomId) {
  const roomId = normalizeId(callRoomId);
  if (!roomId) return;
  setTimeout(() => callSessions.delete(roomId), 2 * 60 * 60 * 1000);
}

function signalDebug(event, payload = {}) {
  console.log("[SIGNAL_DEBUG]", { event, ...payload });
}

function roomDebug(payload = {}) {
  console.log("[ROOM_DEBUG]", payload);
}

function getActiveGroupCallRoomId(callRoomId) {
  const chatRoomId = parseChatRoomIdFromCallRoomId(callRoomId);
  if (!chatRoomId) return "";
  const activeRoomId = activeGroupCallRooms.get(chatRoomId) || "";
  const activeSession = activeRoomId ? callSessions.get(activeRoomId) : null;
  if (!activeSession || activeSession.finalStatusLogged || activeSession.activeParticipants.size === 0) {
    activeGroupCallRooms.delete(chatRoomId);
    return "";
  }
  return activeRoomId;
}

function registerGroupCallRoom(callRoomId) {
  const chatRoomId = parseChatRoomIdFromCallRoomId(callRoomId);
  if (!chatRoomId) return normalizeId(callRoomId);
  const activeRoomId = getActiveGroupCallRoomId(callRoomId);
  if (activeRoomId) return activeRoomId;
  activeGroupCallRooms.set(chatRoomId, normalizeId(callRoomId));
  return normalizeId(callRoomId);
}

function isCanonicalGroupCallRoom(callRoomId) {
  const chatRoomId = parseChatRoomIdFromCallRoomId(callRoomId);
  if (!chatRoomId) return true;
  const activeRoomId = getActiveGroupCallRoomId(callRoomId);
  return !activeRoomId || activeRoomId === normalizeId(callRoomId);
}

function clearActiveGroupCallRoom(callRoomId) {
  const chatRoomId = parseChatRoomIdFromCallRoomId(callRoomId);
  if (!chatRoomId) return;
  if (activeGroupCallRooms.get(chatRoomId) === normalizeId(callRoomId)) {
    activeGroupCallRooms.delete(chatRoomId);
  }
}

async function getOnlineActiveParticipantIds(callRoomId) {
  const session = callSessions.get(normalizeId(callRoomId));
  if (!session) return [];
  const participantIds = Array.from(session.activeParticipants).filter(Boolean);
  const onlineIds = [];
  for (const participantId of participantIds) {
    // eslint-disable-next-line no-await-in-loop
    const sockets = await io.in(`user_${participantId}`).fetchSockets();
    if (sockets.length > 0) onlineIds.push(participantId);
  }
  return onlineIds;
}

async function cleanupStaleActiveGroupCall(requestedRoomId) {
  const chatRoomId = parseChatRoomIdFromCallRoomId(requestedRoomId);
  if (!chatRoomId) return "";
  const activeRoomId = activeGroupCallRooms.get(chatRoomId) || "";
  if (!activeRoomId || activeRoomId === normalizeId(requestedRoomId)) return activeRoomId;
  const onlineActiveIds = await getOnlineActiveParticipantIds(activeRoomId);
  if (onlineActiveIds.length > 0) return activeRoomId;
  const session = callSessions.get(activeRoomId);
  if (session) {
    session.activeParticipants.clear();
    session.endedAt = new Date().toISOString();
    logGroupCallDebug(activeRoomId, "clear stale active room", {
      userId: "",
      requestedRoomId: normalizeId(requestedRoomId),
    });
  }
  clearActiveGroupCallRoom(activeRoomId);
  return "";
}
 
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
    const emitToChatMembers = async (chatRoomId, payload) => {
      try {
        const room = await multiChatStore.getRoomById(chatRoomId);
        const members = room?.members || [];
        members.forEach((m) => {
          if (!m?.id) return;
          io.to(`user_${m.id}`).emit("new-message", { roomId: chatRoomId, message: payload });
        });
      } catch (e) {
        console.warn("[CALL_LOG] emit lỗi:", e.message);
      }
    };

    const createCallLogMessage = async ({
      callRoomId,
      actorUserId,
      status,
      durationSec = 0,
      callerId = "",
      callerName = "",
      endedBy = ""
    }) => {
      const chatRoomId = parseChatRoomIdFromCallRoomId(callRoomId);
      if (!chatRoomId) return;
      const resolvedStatus = resolveCallLogStatus(callRoomId, status);
      const sessionSnapshot = callStateSnapshot(callRoomId, resolvedStatus);
      const isGroupEndedLog = Boolean(sessionSnapshot.isGroupCall && resolvedStatus === "ended");
      const resolvedCallerId = isGroupEndedLog
        ? (sessionSnapshot.callerId || callerId)
        : (callerId || sessionSnapshot.callerId);
      const resolvedCallerName = isGroupEndedLog
        ? (sessionSnapshot.callerName || callerName)
        : (callerName || sessionSnapshot.callerName);
      const resolvedActorUserId = isGroupEndedLog
        ? (resolvedCallerId || actorUserId)
        : actorUserId;
      const resolvedEndedBy = isGroupEndedLog
        ? (resolvedCallerId || endedBy || actorUserId)
        : (endedBy || actorUserId);
      if (!resolvedActorUserId) return;
      const resolvedDurationSec = resolvedStatus === "ended"
        ? computeDurationSec(callRoomId, durationSec)
        : Number(durationSec || 0) || 0;
      if (shouldSkipCallLog(callRoomId)) {
        logCallState(callRoomId, `skip:${resolvedStatus}`);
        return;
      }
      try {
        const room = await multiChatStore.appendCallLogMessage({
          roomId: chatRoomId,
          actorUserId: resolvedActorUserId,
          status: resolvedStatus,
          durationSec: resolvedDurationSec,
          callRoomId,
          callerId: resolvedCallerId,
          callerName: resolvedCallerName,
          endedBy: resolvedEndedBy,
          participantCount: sessionSnapshot.participantCount,
          joinedParticipants: sessionSnapshot.joinedParticipants,
          startedAt: sessionSnapshot.startedAt,
          endedAt: new Date().toISOString(),
          hasJoinedMember: sessionSnapshot.hasJoinedMember
        });
        const full = await multiChatStore.hydrateRoomForUser(room, resolvedActorUserId);
        const message = full.messages[full.messages.length - 1];
        if (message) await emitToChatMembers(chatRoomId, message);
        markCallLogWritten(callRoomId, resolvedStatus);
      } catch (e) {
        console.warn("[CALL_LOG] Không lưu được call_log:", e.message);
      }
    };

    const user = socket.data.user;
    if (!user || !user.id) return;
 
    const userRoom = `user_${user.id}`;
    socket.join(userRoom);
    socket.emit("socket-ready", { userId: user.id, room: userRoom, socketId: socket.id });
    console.log(`[SOCKET] ✅ Online: ${user.fullName || user.id} | room=${userRoom} | socketId=${socket.id}`);

    socket.on("send-message", async (data = {}) => {
      const isAiChat =
        data.receiverId === AI_ASSISTANT_ID ||
        data.chatType === "AI" ||
        data.roomId === AI_ASSISTANT_ID;
      if (!isAiChat) return;

      try {
        const text = String(data.text || data.message || "").trim();
        const result = await generateAiReply({
          userId: user.id,
          message: text,
          messages: data.messages || [],
        });
        io.to(userRoom).emit("new-message", {
          roomId: AI_ASSISTANT_ID,
          chatType: "AI",
          message: buildAiMessage(result.reply, {
            mode: result.mode,
            action: result.action || "",
          }),
        });
      } catch (error) {
        io.to(userRoom).emit("new-message", {
          roomId: AI_ASSISTANT_ID,
          chatType: "AI",
          message: buildAiMessage("Trợ lý AI hiện đang bận, vui lòng thử lại sau.", {
            mode: "error",
          }),
        });
      }
    });
 
    io.in(userRoom).fetchSockets().then((sockets) => {
      console.log(`[SOCKET] 📋 Room ${userRoom} hiện có ${sockets.length} socket(s)`);
    });
 
    // ─────────────────────────────────────────────
    // 1. Người gọi gửi Offer
    // ─────────────────────────────────────────────
    socket.on("call-user", async (data) => {
      const { targetUserId, offer, signalData, callerName, isGroupCall, groupName } = data;
      const requestedRoomId = normalizeId(data.roomId);
      if (isGroupCall) {
        await cleanupStaleActiveGroupCall(requestedRoomId);
      }
      const roomId = isGroupCall ? registerGroupCallRoom(requestedRoomId) : requestedRoomId;
      const resolvedOffer = signalData || offer;
      const targetRoom = `user_${targetUserId}`;
      if (isGroupCall && requestedRoomId && requestedRoomId !== roomId) {
        const activeParticipants = await getOnlineActiveParticipantIds(roomId);
        roomDebug({
          event: "reject-duplicate-group-call",
          userId: user.id,
          roomId: requestedRoomId,
          activeRoomId: roomId,
          targetUserId,
          activeParticipants,
        });
        socket.emit("call-unavailable", {
          reason: "active-call",
          targetUserId,
          isGroupCall: true,
          roomId: requestedRoomId,
          activeRoomId: roomId,
          activeParticipants,
        });
        return;
      }
      roomDebug({ event: "call-user", userId: user.id, roomId, activeRoomId: getActiveGroupCallRoomId(roomId) || roomId });
      signalDebug("recv:call-user", {
        fromUserId: user.id,
        toUserId: targetUserId,
        roomId,
        socketId: socket.id,
      });
      if (!targetUserId || !resolvedOffer) {
        console.warn(`[CALL] ⚠️ call-user thiếu targetUserId hoặc signalData từ ${user.fullName}`);
        return;
      }
      rememberCallInvite({
        callRoomId: roomId,
        callerId: user.id,
        callerName: callerName || user.fullName,
        targetUserId,
        isGroupCall,
      });
 
      const targetSockets = await io.in(targetRoom).fetchSockets();
      console.log(`[CALL] 📞 ${user.fullName} (${user.id}) → target=${targetUserId} | isGroup=${!!isGroupCall} | target sockets=${targetSockets.length}`);
 
      if (targetSockets.length === 0) {
        socket.emit("call-unavailable", { reason: "offline", targetUserId, isGroupCall: !!isGroupCall, roomId });
        signalDebug("emit:call-unavailable", {
          fromUserId: user.id,
          toUserId: targetUserId,
          roomId,
          socketId: socket.id,
        });
        console.log(`[CALL] ❌ Target ${targetUserId} không online!`);
        return;
      }

      let groupMemberIds = [];
      if (isGroupCall) {
        const chatRoomId = parseChatRoomIdFromCallRoomId(roomId);
        try {
          const room = chatRoomId ? await multiChatStore.getRoomById(chatRoomId) : null;
          groupMemberIds = Array.from(new Set((room?.members || [])
            .map((member) => String(member?.id || member?.userId || member || "").trim())
            .filter(Boolean)));
        } catch (err) {
          console.warn("[CALL] Không lấy được danh sách thành viên nhóm:", err?.message || err);
        }
      }
 
      io.to(targetRoom).emit("incoming-call", {
        fromUserId:  user.id,
        callerName:  callerName || user.fullName,
        offer: resolvedOffer,
        roomId,
        // ✅ FIX: truyền thông tin nhóm để IncomingCallModal hiển thị đúng
        isGroupCall: !!isGroupCall,
        groupName:   groupName || null,
        groupMemberIds,
      });
      signalDebug("emit:incoming-call", {
        fromUserId: user.id,
        toUserId: targetUserId,
        roomId,
        socketId: socket.id,
        targetSocketCount: targetSockets.length,
        groupMemberIds,
      });
      console.log(`[CALL] ✅ Đã gửi incoming-call tới room ${targetRoom} | isGroup=${!!isGroupCall}`);
    });
 
    // ─────────────────────────────────────────────
    // 2. Người nhận gửi Answer
    // ─────────────────────────────────────────────
    socket.on("call-accepted", (data) => {
      const { toUserId, answer, roomId } = data;
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-call-accepted-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
        });
        return;
      }
      roomDebug({ event: "receive answer", userId: user.id, roomId, activeRoomId: getActiveGroupCallRoomId(roomId) || roomId });
      rememberCallJoin(roomId, user.id);
      signalDebug("recv:call-accepted", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      console.log(`[CALL] ✔️  ${user.fullName} chấp nhận → gửi answer tới user_${toUserId}`);
 
      io.to(`user_${toUserId}`).emit("call-accepted", {
        fromUserId: user.id,
        answer,
        roomId,
      });
      signalDebug("emit:call-accepted", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
    });
 
    // ─────────────────────────────────────────────
    // 3. ICE Candidate relay
    // ─────────────────────────────────────────────
    socket.on("ice-candidate", (data) => {
      const { toUserId, candidate, roomId } = data;
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-ice-candidate-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
        });
        return;
      }
      roomDebug({ event: "receive ice candidate", userId: user.id, roomId, activeRoomId: getActiveGroupCallRoomId(roomId) || roomId });
      signalDebug("recv:ice-candidate", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      if (!toUserId || !candidate) {
        console.warn(`[ICE] ⚠️ Thiếu toUserId hoặc candidate từ ${user.fullName}`);
        return;
      }
      console.log(`[ICE] 🧊 ${user.fullName} (${user.id}) → user_${toUserId}`);
      io.to(`user_${toUserId}`).emit("ice-candidate", {
        fromUserId: user.id,
        candidate,
        roomId,
      });
      signalDebug("emit:ice-candidate", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
    });
 
    // ─────────────────────────────────────────────
    // 4. Kết thúc / Từ chối cuộc gọi
    // ─────────────────────────────────────────────
    socket.on("end-call", async (data) => {
      const { toUserId, roomId, durationSec = 0, callerId = "", callerName = "" } = data || {};
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-end-call-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
        });
        return;
      }
      const leaveResult = rememberCallLeave(roomId, user.id);
      signalDebug("recv:end-call", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      console.log(`[CALL] 📵 ${user.fullName} kết thúc → user_${toUserId}`);
      // FIX: truyền fromUserId để client nhóm chỉ xóa peer này
      io.to(`user_${toUserId}`).emit("call-ended", { fromUserId: user.id, roomId });
      signalDebug("emit:call-ended", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      const session = getCallSession(roomId);
      if (!session?.isGroupCall || leaveResult.shouldFinalize) {
        logCallState(roomId, "room destroyed");
        await createCallLogMessage({
          callRoomId: roomId,
          actorUserId: user.id,
          status: leaveResult.status,
          durationSec,
          callerId,
          callerName: callerName || user.fullName,
          endedBy: user.id
        });
      }
    });

    socket.on("leave-group-call", async (data) => {
      const { roomId, durationSec = 0, callerName = "" } = data || {};
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-leave-group-call-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
        });
        return;
      }

      const session = getCallSession(roomId);
      const isCreatorLeaving = normalizeId(session?.callerId) === normalizeId(user.id);
      const leaveResult = rememberCallLeave(roomId, user.id);
      signalDebug("recv:leave-group-call", {
        fromUserId: user.id,
        roomId,
        socketId: socket.id,
        isCreatorLeaving,
      });

      const chatRoomId = parseChatRoomIdFromCallRoomId(roomId);
      let memberIds = [];
      try {
        const room = chatRoomId ? await multiChatStore.getRoomById(chatRoomId) : null;
        memberIds = Array.from(new Set((room?.members || [])
          .map((member) => String(member?.id || member?.userId || member || "").trim())
          .filter(Boolean)));
        const groupSnapshot = callStateSnapshot(roomId, "participant leave");

        memberIds
          .filter((memberId) => memberId && memberId !== String(user.id))
          .forEach((memberId) => {
            io.to(`user_${memberId}`).emit("user-left-group-call", {
              leftUserId: user.id,
              roomId,
              participantCount: groupSnapshot.participantCount,
              participants: groupSnapshot.activeParticipants || [],
            });
          });

        signalDebug("emit:user-left-group-call", {
          fromUserId: user.id,
          toUserId: memberIds.filter((memberId) => memberId !== String(user.id)),
          roomId,
          socketId: socket.id,
          isCreatorLeaving,
          participantCount: groupSnapshot.participantCount,
          participants: groupSnapshot.activeParticipants || [],
        });
      } catch (err) {
        console.warn("[CALL] Không broadcast được user-left-group-call:", err?.message || err);
      }

      if (leaveResult.shouldFinalize) {
        logCallState(roomId, "room destroyed");
        logGroupCallDebug(roomId, "call ended", { userId: user.id, isCreatorLeaving });
        await createCallLogMessage({
          callRoomId: roomId,
          actorUserId: user.id,
          status: leaveResult.status,
          durationSec,
          callerId: session?.callerId,
          callerName: callerName || user.fullName,
          endedBy: user.id,
        });
      }
    });
 
    socket.on("call-rejected", async (data) => {
      const { toUserId, roomId, callerId = "", callerName = "" } = data || {};
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-call-rejected-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
        });
        return;
      }
      const shouldWriteMissed = rememberCallRejected(roomId, user.id);
      signalDebug("recv:call-rejected", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      console.log(`[CALL] 🚫 ${user.fullName} từ chối → user_${toUserId}`);
      // FIX: truyền fromUserId để client nhóm chỉ xóa peer này, không đóng hết
      io.to(`user_${toUserId}`).emit("call-rejected", { fromUserId: user.id, roomId });
      signalDebug("emit:call-rejected", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      if (shouldWriteMissed) {
        clearActiveParticipants(roomId, "all rejected");
        await createCallLogMessage({
          callRoomId: roomId,
          actorUserId: user.id,
          status: "missed",
          durationSec: 0,
          callerId: callerId || toUserId,
          callerName: callerName || user.fullName,
          endedBy: user.id
        });
      }
    });

    socket.on("call-missed", async (data) => {
      const { toUserIds = [], toUserId, roomId, callerName = "" } = data || {};
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-call-missed-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
        });
        return;
      }
      const targetIds = Array.from(new Set([...(Array.isArray(toUserIds) ? toUserIds : []), toUserId].filter(Boolean)));
      signalDebug("recv:call-missed", {
        fromUserId: user.id,
        toUserId: targetIds,
        roomId,
        socketId: socket.id,
      });
      console.log(`[CALL] ⏱️ ${user.fullName || user.id} gọi nhỡ | targets=${targetIds.join(",")}`);
      const session = getCallSession(roomId);
      if (session?.hasJoinedMember) {
        logCallState(roomId, "skip missed:has joined member");
        return;
      }
      clearActiveParticipants(roomId, "timeout/no answer");
      targetIds.forEach((targetId) => {
        io.to(`user_${targetId}`).emit("call-ended", { fromUserId: user.id, roomId });
        signalDebug("emit:call-ended:missed", {
          fromUserId: user.id,
          toUserId: targetId,
          roomId,
          socketId: socket.id,
        });
      });
      await createCallLogMessage({
        callRoomId: roomId,
        actorUserId: user.id,
        status: "missed",
        durationSec: 0,
        callerId: user.id,
        callerName: callerName || user.fullName,
        endedBy: user.id
      });
    });
 
    // ─────────────────────────────────────────────
    // 5. Group call: relay offer từ member mới join
    //    Dùng khi 1 member join muộn, cần gửi offer
    //    đến các member đang trong phòng
    // ─────────────────────────────────────────────
    socket.on("group-call-offer", async (data) => {
      const { toUserId, offer, roomId } = data;
      const targetRoom = `user_${toUserId}`;
      if (!isCanonicalGroupCallRoom(roomId)) {
        roomDebug({
          event: "drop-group-call-offer-non-canonical",
          userId: user.id,
          roomId,
          activeRoomId: getActiveGroupCallRoomId(roomId),
          targetUserId: toUserId,
        });
        return;
      }
      roomDebug({ event: "receive offer", userId: user.id, roomId, activeRoomId: getActiveGroupCallRoomId(roomId) || roomId });
      signalDebug("recv:group-call-offer", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
      });
      const targetSockets = await io.in(targetRoom).fetchSockets();
      if (targetSockets.length === 0) {
        signalDebug("drop:group-call-offer:offline", {
          fromUserId: user.id,
          toUserId,
          roomId,
          socketId: socket.id,
        });
        return;
      }
 
      io.to(targetRoom).emit("group-call-offer", {
        fromUserId: user.id,
        callerName: user.fullName,
        offer,
        roomId,
      });
      signalDebug("emit:group-call-offer", {
        fromUserId: user.id,
        toUserId,
        roomId,
        socketId: socket.id,
        targetSocketCount: targetSockets.length,
      });
      console.log(`[CALL] 📡 group-call-offer: ${user.fullName} → user_${toUserId}`);
    });
 
    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] ❌ Offline: ${user.fullName} | reason=${reason}`);
      Array.from(callSessions.entries()).forEach(([roomId, session]) => {
        if (!session?.activeParticipants?.has(user.id)) return;
        session.activeParticipants.delete(user.id);
        logGroupCallDebug(roomId, "disconnect leave", {
          userId: user.id,
          reason,
        });
        if (session.activeParticipants.size === 0) {
          session.endedAt = new Date().toISOString();
          clearActiveGroupCallRoom(roomId);
          logGroupCallDebug(roomId, "clear empty room on disconnect", {
            userId: user.id,
            reason,
          });
        }
      });
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
