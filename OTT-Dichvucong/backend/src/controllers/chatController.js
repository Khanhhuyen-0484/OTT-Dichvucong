const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");

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
        content:
          "Bạn là trợ lý AI tiếng Việt của Cổng Dịch vụ công. Trả lời ngắn gọn, lịch sự, hướng dẫn thủ tục hành chính (không thay thế văn bản pháp luật; khuyên người dùng xác nhận tại cơ quan có thẩm quyền)."
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
