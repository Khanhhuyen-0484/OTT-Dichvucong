const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");
const { getIo } = require("../socket");
const multiChatStore = require("../store/multiChatStore");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { createPresignedPut, isS3Configured } = require("../config/s3");

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
    if (!text) {
      return res.status(400).json({ message: "Nội dung không được trống" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ message: "Tối đa 2000 ký tự" });
    }

    const conversationId = req.user.id;
    const userData = await userStore.findById(req.user.id);
    const fullName = userData?.fullName || "Người dùng";
    const avatarUrl =
      userData?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
    const sender = {
      id: req.user.id,
      fullName,
      avatarUrl
    };

    await sendMessage({
      userId: conversationId,
      from: "user",
      text,
      sender
    });

    const conversation = await getChatHistory(conversationId);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];

    try {
      const io = getIo();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        io.to("admin").emit("supportConversationMessage", {
          userId: conversationId,
          message: lastMessage
        });
      }
    } catch (socketError) {
      console.warn("[Socket] Không thể gửi sự kiện supportConversationMessage:", socketError.message);
    }

    res.json({ ok: true, messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi gửi tin" });
  }
};

function fallbackAiReply(userText) {
  const t = userText.toLowerCase();
  if (/chào|xin chào|hello|hi\b/.test(t)) {
    return "Xin chào! Tôi là trợ lý AI hỗ trợ thủ tục hành chính trên Cổng dịch vụ công. Bạn cần tra cứu thủ tục, biểu mẫu hay hướng dẫn nộp hồ sơ?";
  }
  if (/tạm trú|đăng ký cư trú/.test(t)) {
    return "Về tạm trú: thường cần CMND/CCCD, giấy tờ chỗ ở, phiếu báo tạm vắng (nếu có). Bạn nên chọn đúng cấp tiếp nhận (xã/phường) trên cổng và điền form trực tuyến.";
  }
  if (/gplx|lái xe|giấy phép lái/.test(t)) {
    return "Đổi GPLX: chuẩn bị ảnh, giấy khám sức khỏe, GPLX cũ và làm theo hướng dẫn trên CSDL giao thông / cổng dịch vụ công — có thể nộp trực tuyến tùy địa phương.";
  }
  if (/hộ chiếu|passport/.test(t)) {
    return "Cấp/đổi hộ chiếu: kiểm tra ảnh, CMND/CCCD, lịch hẹn (nếu có). Nhiều bước đã được điện tử hóa — xem mục Hộ chiếu trên cổng.";
  }
  if (/thời gian|giờ làm|mấy giờ/.test(t)) {
    return "Thông thường bộ phận một cửa làm việc giờ hành chính (sáng 7h30–11h30, chiều 13h30–17h00), có thể khác theo địa phương.";
  }
  return "Cảm ơn bạn đã liên hệ. Hãy mô tả ngắn thủ tục (ví dụ: tạm trú, GPLX, hộ tịch) hoặc dùng ô tìm kiếm ở trên để tra cứu. Nếu cần trao đổi với cán bộ, hãy chọn tab “Chat cán bộ”.";
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
        content: `Bạn là trợ lý AI thông minh và thân thiện của Cổng Dịch vụ công Việt Nam, giống như một chatbot AI hiện đại như Zalo AI.

Hướng dẫn chung:
- Trả lời bằng tiếng Việt tự nhiên, thân thiện, dễ hiểu
- Có thể đùa vui nhẹ nhàng khi phù hợp, nhưng vẫn chuyên nghiệp
- Hỏi lại nếu cần thêm thông tin để hỗ trợ tốt hơn
- Luôn hướng dẫn người dùng đến các bước tiếp theo hoặc liên hệ cơ quan nếu cần

Chức năng chính:
- Tư vấn thủ tục hành chính: tạm trú, GPLX, hộ chiếu, hộ tịch, v.v.
- Hướng dẫn chuẩn bị giấy tờ cần thiết
- Giải thích quy trình nộp hồ sơ
- Trả lời câu hỏi chung về dịch vụ công

Phong cách trả lời:
- Bắt đầu bằng lời chào thân thiện nếu là tin nhắn đầu
- Sử dụng emoji phù hợp để làm cho cuộc trò chuyện vui vẻ hơn
- Cung cấp thông tin chính xác, ngắn gọn
- Kết thúc bằng câu hỏi để tiếp tục cuộc trò chuyện

Quan trọng: Không thay thế văn bản pháp luật chính thức. Luôn khuyên người dùng xác nhận tại cơ quan có thẩm quyền.`
      },
      ...messages
    ],
    max_tokens: 900,
    temperature: 0.4
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(body)
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
      if (last && last.role === "user" && typeof last.content === "string") {
        userText = last.content.trim();
      }
    }

    if (!userText) {
      return res.status(400).json({ message: "Vui lòng nhập nội dung câu hỏi." });
    }
    if (userText.length > 4000) {
      return res.status(400).json({ message: "Nội dung quá dài." });
    }

    const msgs = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [{ role: "user", content: userText }];

    let reply = null;
    try {
      reply = await openAiChat(msgs);
    } catch (e) {
      console.error("OpenAI error:", e.message);
    }

    if (!reply) {
      reply = fallbackAiReply(userText);
    }

    res.json({
      reply,
      mode: process.env.OPENAI_API_KEY ? "openai" : "fallback"
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi trợ lý AI" });
  }
};

async function emitRoomUpdate(roomId, eventName, payload) {
  try {
    const io = getIo();
    io.to(`chat_${roomId}`).emit(eventName, payload);
  } catch (e) {
    console.warn(`[Socket] Không thể phát sự kiện ${eventName}:`, e.message);
  }
}

exports.chatContacts = async (req, res) => {
  try {
    const q = req.query?.q || "";
    const contacts = await multiChatStore.searchContacts({
      keyword: q,
      currentUserId: req.user.id
    });
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
      memberIds: req.body?.memberIds
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể tạo nhóm chat" });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const media = req.body?.media || null;
    const replyToMessageId = String(req.body?.replyToMessageId || "").trim();
    if (!text && !media) return res.status(400).json({ message: "Tin nhắn không được để trống" });
    const room = await multiChatStore.appendMessage({
      roomId: req.params.roomId,
      senderId: req.user.id,
      text,
      media,
      replyToMessageId
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];
    await emitRoomUpdate(req.params.roomId, "multiChatMessage", {
      roomId: req.params.roomId,
      message: lastMessage
    });
    return res.json({ room: hydrated, message: lastMessage });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gửi tin nhắn" });
  }
};

exports.presignChatMediaUpload = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Chưa cấu hình S3. Đặt S3_BUCKET (hoặc AWS_S3_BUCKET), AWS_REGION và AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env."
    });
  }
  try {
    const contentType = String(req.body?.contentType || "")
      .trim()
      .toLowerCase();
    let fileName = String(req.body?.fileName || "file").trim();
    // Accept images, videos, and common document formats (PDF, DOC, DOCX)
    const isAllowedType = 
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType === "application/pdf" ||
      contentType === "application/msword" ||
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.toLowerCase().endsWith(".pdf") ||
      fileName.toLowerCase().endsWith(".doc") ||
      fileName.toLowerCase().endsWith(".docx");
    
    if (!contentType || !isAllowedType) {
      return res.status(400).json({
        message: "Chỉ chấp nhận media ảnh/video hoặc file PDF/DOC/DOCX"
      });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ext) {
      const inferred = contentType.startsWith("video/") ? ".mp4" : ".jpg";
      fileName += inferred;
    }
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const { uploadUrl, publicUrl } = await createPresignedPut({
      key,
      contentType,
      expiresSec: 300
    });

    return res.json({
      uploadUrl,
      publicUrl,
      key,
      method: "PUT",
      headers: { "Content-Type": contentType }
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Không tạo được link upload media chat"
    });
  }
};

exports.uploadChatMedia = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message: "Chưa cấu hình S3."
    });
  }
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Không có file được upload" });
    }

    const contentType = file.mimetype;
    const allowedDocs = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (
      !contentType ||
      (!contentType.startsWith("image/") &&
        !contentType.startsWith("video/") &&
        !allowedDocs.includes(contentType))
    ) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video, file .doc/.docx/.pdf"
      });
    }

    const fileName = file.originalname || "file";
    const ext = path.extname(fileName).toLowerCase();
    let safeName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100);
    if (!ext) {
      const inferred = contentType.startsWith("video/") ? ".mp4" : ".jpg";
      safeName += inferred;
    } else {
      safeName += ext;
    }
    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    // Upload to S3
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const cfg = require("../config/s3").getConfig();
    const client = new S3Client({
      region: cfg.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: contentType
    });

    await client.send(command);

    // Generate GET URL
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const getCommand = new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key
    });
    const publicUrl = await getSignedUrl(client, getCommand, { expiresIn: 3600 * 24 * 7 });

    return res.json({
      url: publicUrl,
      key,
      contentType
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Không upload được media chat"
    });
  }
};

exports.unsendRoomMessage = async (req, res) => {
  try {
    const room = await multiChatStore.unsendMessage({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      requesterId: req.user.id
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitRoomUpdate(req.params.roomId, "multiChatRoomUpdated", {
      roomId: req.params.roomId
    });
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
      userId: req.user.id
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
      senderId: req.user.id
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];
    await emitRoomUpdate(targetRoomId, "multiChatMessage", {
      roomId: targetRoomId,
      message: lastMessage
    });
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
      memberId: req.body?.memberId
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
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
      memberId: req.params.memberId
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
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
      enabled: true
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
      enabled: false
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
      requesterId: req.user.id
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể giải tán nhóm" });
  }
};

exports.updateGroupInfo = async (req, res) => {
  try {
    const room = await multiChatStore.updateGroupInfo({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      name: req.body?.name,
      avatarUrl: req.body?.avatarUrl
    });
    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitRoomUpdate(req.params.roomId, "multiChatRoomUpdated", { roomId: req.params.roomId });
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể cập nhật thông tin nhóm" });
  }
};
