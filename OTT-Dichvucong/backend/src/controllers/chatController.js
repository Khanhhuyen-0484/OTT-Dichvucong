const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");
const { getIo } = require("../socket");
const multiChatStore = require("../store/multiChatStore");

// ─── FIX: emit "new-message" đến từng user_${memberId} ───────────────────────
// Vấn đề cũ: emit vào `chat_${roomId}` nhưng frontend không join room đó.
// Frontend chỉ join `user_${userId}` khi connect socket.
// Fix: lấy members của room → emit đến `user_${memberId}` từng người.
// Event name phải là "new-message" để khớp với ChatPage.jsx socket listener.
async function emitToRoomMembers(room, payload) {
  try {
    const io = getIo();
    const members = room?.members || [];
    members.forEach((m) => {
      const memberId = typeof m === "object" ? m.id : m;
      if (!memberId) return;
      io.to(`user_${memberId}`).emit("new-message", payload);
      console.log(`[SOCKET] 📤 new-message → user_${memberId}`);
    });
  } catch (e) {
    console.warn("[Socket] Không thể emit new-message:", e.message);
  }
}

// ─── Staff chat ───────────────────────────────────────────────────────────────
exports.staffHistory = async (req, res) => {
  try {
    const conversation = await getChatHistory(req.user.id);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi đọc hội thoại" });
  }
};

exports.staffSend = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "Nội dung không được trống" });
    if (text.length > 2000) return res.status(400).json({ message: "Tối đa 2000 ký tự" });

    const conversationId = req.user.id;
    const userData = await userStore.findById(req.user.id);
    const fullName = userData?.fullName || "Người dùng";
    const avatarUrl =
      userData?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
    const sender = { id: req.user.id, fullName, avatarUrl };

    await sendMessage({ userId: conversationId, from: "user", text, sender });

    const conversation = await getChatHistory(conversationId);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];

    try {
      const io = getIo();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        io.to("admin").emit("supportConversationMessage", {
          userId: conversationId,
          message: lastMessage,
        });
      }
    } catch (socketError) {
      console.warn("[Socket] supportConversationMessage:", socketError.message);
    }

    res.json({ ok: true, messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi gửi tin" });
  }
};

// ─── AI Chat ──────────────────────────────────────────────────────────────────
function fallbackAiReply(userText) {
  const t = userText.toLowerCase();
  if (/chào|xin chào|hello|hi\b/.test(t))
    return "Xin chào! Tôi là trợ lý AI hỗ trợ thủ tục hành chính trên Cổng dịch vụ công. Bạn cần tra cứu thủ tục, biểu mẫu hay hướng dẫn nộp hồ sơ?";
  if (/tạm trú|đăng ký cư trú/.test(t))
    return "Về tạm trú: thường cần CMND/CCCD, giấy tờ chỗ ở, phiếu báo tạm vắng (nếu có). Bạn nên chọn đúng cấp tiếp nhận (xã/phường) trên cổng và điền form trực tuyến.";
  if (/gplx|lái xe|giấy phép lái/.test(t))
    return "Đổi GPLX: chuẩn bị ảnh, giấy khám sức khỏe, GPLX cũ và làm theo hướng dẫn trên CSDL giao thông / cổng dịch vụ công — có thể nộp trực tuyến tùy địa phương.";
  if (/hộ chiếu|passport/.test(t))
    return "Cấp/đổi hộ chiếu: kiểm tra ảnh, CMND/CCCD, lịch hẹn (nếu có). Nhiều bước đã được điện tử hóa — xem mục Hộ chiếu trên cổng.";
  if (/thời gian|giờ làm|mấy giờ/.test(t))
    return "Thông thường bộ phận một cửa làm việc giờ hành chính (sáng 7h30-11h30, chiều 13h30-17h00), có thể khác theo địa phương.";
  return 'Cảm ơn bạn đã liên hệ. Hãy mô tả ngắn thủ tục (ví dụ: tạm trú, GPLX, hộ tịch) hoặc dùng ô tìm kiếm ở trên để tra cứu.';
}

async function openAiChat(messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: `Bạn là trợ lý AI thông minh và thân thiện của Cổng Dịch vụ công Việt Nam.
Trả lời bằng tiếng Việt tự nhiên, thân thiện, dễ hiểu.
Tư vấn thủ tục hành chính: tạm trú, GPLX, hộ chiếu, hộ tịch, v.v.
Không thay thế văn bản pháp luật chính thức.`,
      },
      ...messages,
    ],
    max_tokens: 900,
    temperature: 0.4,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText.slice(0, 300) || `OpenAI HTTP ${r.status}`);
  }

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : null;
}

exports.aiChat = async (req, res) => {
  try {
    const raw = req.body?.message;
    const history = req.body?.messages;

    let userText = "";
    if (typeof raw === "string") {
      userText = raw.trim();
    } else if (Array.isArray(history) && history.length) {
      const last = history[history.length - 1];
      if (last?.role === "user" && typeof last.content === "string") {
        userText = last.content.trim();
      }
    }

    if (!userText) return res.status(400).json({ message: "Vui lòng nhập nội dung câu hỏi." });
    if (userText.length > 4000) return res.status(400).json({ message: "Nội dung quá dài." });

    const msgs = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [{ role: "user", content: userText }];

    let reply = null;
    try { reply = await openAiChat(msgs); } catch (e) { console.error("OpenAI error:", e.message); }
    if (!reply) reply = fallbackAiReply(userText);

    res.json({ reply, mode: process.env.OPENAI_API_KEY ? "openai" : "fallback" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi trợ lý AI" });
  }
};

// ─── Room/Contact queries ─────────────────────────────────────────────────────
exports.chatContacts = async (req, res) => {
  try {
    const q = req.query?.q || "";
    const contacts = await multiChatStore.searchContacts({ keyword: q, currentUserId: req.user.id });
    return res.json({ contacts });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải danh bạ" });
  }
};

exports.chatRooms = async (req, res) => {
  try {
    const rooms = await multiChatStore.listRoomsForUser(req.user.id);
    const hydrated = await Promise.all(rooms.map((r) => multiChatStore.hydrateRoomForUser(r, req.user.id)));
    return res.json({ rooms: hydrated });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải phòng chat" });
  }
};

exports.chatRoomDetail = async (req, res) => {
  try {
    const room = await multiChatStore.getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng chat" });
    const isMember = room.members?.some((m) => m.id === req.user.id);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền truy cập phòng này" });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải chi tiết phòng chat" });
  }
};

exports.ensureDirectChat = async (req, res) => {
  try {
    const targetUserId = String(req.body?.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu ID người dùng" });
    const room = await multiChatStore.ensureDirectRoom(req.user.id, targetUserId);
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể khởi tạo hội thoại" });
  }
};

exports.createGroupChat = async (req, res) => {
  try {
    const room = await multiChatStore.createGroupRoom({
      ownerId: req.user.id,
      name: req.body?.name,
      avatarUrl: req.body?.avatarUrl,
      memberIds: req.body?.memberIds,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể tạo nhóm chat" });
  }
};

// ─── Message actions ──────────────────────────────────────────────────────────
exports.sendRoomMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const media = req.body?.media || null;
    const replyToId = req.body?.replyToId || null;
    if (!text && !media) return res.status(400).json({ message: "Tin nhắn không được để trống" });

    const room = await multiChatStore.appendMessage({
      roomId: req.params.roomId,
      senderId: req.user.id,
      text,
      media,
      replyToId,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];

    // ✅ Emit đúng event name + đúng room
    await emitToRoomMembers(room, { roomId: req.params.roomId, message: lastMessage });

    return res.json({ room: hydrated, message: lastMessage });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gửi tin nhắn" });
  }
};

exports.unsendRoomMessage = async (req, res) => {
  try {
    const room = await multiChatStore.unsendMessage({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      requesterId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể thu hồi tin nhắn" });
  }
};

exports.deleteRoomMessageForMe = async (req, res) => {
  try {
    const room = await multiChatStore.deleteMessageForUser({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      userId: req.user.id,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể xóa tin nhắn" });
  }
};

exports.forwardRoomMessage = async (req, res) => {
  try {
    const targetRoomId = String(req.body?.targetRoomId || "").trim();
    if (!targetRoomId) return res.status(400).json({ message: "Thiếu phòng chuyển tiếp" });

    const room = await multiChatStore.forwardMessage({
      sourceRoomId: req.params.roomId,
      messageId: req.params.messageId,
      targetRoomId,
      senderId: req.user.id,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];
    await emitToRoomMembers(room, { roomId: targetRoomId, message: lastMessage });

    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể chuyển tiếp tin nhắn" });
  }
};

exports.addGroupMember = async (req, res) => {
  try {
    const room = await multiChatStore.addGroupMember({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.body?.memberId,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể thêm thành viên" });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const room = await multiChatStore.removeGroupMember({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể xóa thành viên" });
  }
};

exports.assignDeputy = async (req, res) => {
  try {
    const room = await multiChatStore.assignDeputy({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
      enabled: true,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gán quyền phó nhóm" });
  }
};

exports.removeDeputy = async (req, res) => {
  try {
    const room = await multiChatStore.assignDeputy({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberId: req.params.memberId,
      enabled: false,
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gỡ quyền phó nhóm" });
  }
};

exports.dissolveGroup = async (req, res) => {
  try {
    await multiChatStore.dissolveGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể giải tán nhóm" });
  }
};