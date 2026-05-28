const { listServices } = require("../store/serviceCatalogStore");
const { listCategories } = require("../store/serviceCategoryStore");
const { findByUserId } = require("../store/serviceApplicationStore");
const { getAiRules } = require("../store/adminStore");

const AI_ASSISTANT_ID = "AI_ASSISTANT";
const AI_ASSISTANT_NAME = "Trợ lý AI";
const OPEN_STAFF_PHRASES = [
  "toi muon gap can bo",
  "toi can gap can bo",
  "gap can bo",
  "chat voi can bo",
  "can bo ho tro",
  "nhan vien ho tro",
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function wantsStaff(text) {
  const normalized = normalizeText(text);
  return OPEN_STAFF_PHRASES.some((phrase) => normalized.includes(phrase));
}

function compact(value, max = 600) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function buildContext({ userId, message }) {
  const [services, categories, dossiers, rulesText] = await Promise.all([
    listServices().catch(() => []),
    listCategories().catch(() => []),
    userId ? findByUserId(userId).catch(() => []) : Promise.resolve([]),
    getAiRules().catch(() => ""),
  ]);

  const serviceLines = services.slice(0, 12).map((service) => {
    const name = service.name || service.title || service.serviceName || service.id;
    const category = service.categoryName || service.categoryId || "";
    const fee = service.fee != null ? `, lệ phí: ${service.fee}` : "";
    return `- ${compact(name, 120)}${category ? ` (${compact(category, 80)})` : ""}${fee}`;
  });

  const categoryLines = categories.slice(0, 10).map((category) => (
    `- ${compact(category.name || category.title || category.id, 120)}`
  ));

  const dossierLines = dossiers.slice(0, 8).map((dossier) => {
    const code = dossier.applicationCode || dossier.dossierId || dossier.id || "";
    const serviceName = dossier.serviceName || dossier.serviceId || "Hồ sơ";
    const status = dossier.status || dossier.applicationStatus || "Chưa rõ";
    const paymentStatus = dossier.paymentStatus || dossier.payment?.status || "";
    return `- ${compact(serviceName, 120)}${code ? ` (${code})` : ""}: trạng thái ${status}${paymentStatus ? `, thanh toán ${paymentStatus}` : ""}`;
  });

  return {
    rulesText,
    contextText: [
      rulesText ? `Knowledge Base/Admin rules:\n${rulesText}` : "",
      serviceLines.length ? `Dịch vụ công đang có:\n${serviceLines.join("\n")}` : "",
      categoryLines.length ? `Nhóm dịch vụ:\n${categoryLines.join("\n")}` : "",
      dossierLines.length ? `Hồ sơ của người dùng:\n${dossierLines.join("\n")}` : "",
      `Câu hỏi hiện tại: ${compact(message, 1000)}`,
    ].filter(Boolean).join("\n\n"),
  };
}

function buildSystemPrompt(contextText) {
  return `Bạn là trợ lý AI cho hệ thống dịch vụ công trực tuyến.
Nhiệm vụ:
- Hướng dẫn thủ tục hành chính
- Giải thích hồ sơ cần chuẩn bị
- Hướng dẫn thanh toán
- Giải thích trạng thái hồ sơ
- Hướng dẫn người dân sử dụng hệ thống
- Trả lời bằng tiếng Việt lịch sự, ngắn gọn

Ưu tiên dùng dữ liệu dịch vụ công, hồ sơ người dùng và Knowledge Base nếu có.
Nếu không đủ dữ liệu, hãy nói rõ thông tin chỉ mang tính hướng dẫn và đề nghị người dân chat với cán bộ hỗ trợ.

Dữ liệu tham khảo:
${contextText || "Không có dữ liệu tham khảo."}`;
}

function mockReply(message, contextText = "") {
  const text = normalizeText(message);
  if (wantsStaff(message)) {
    return "Bạn có thể chat trực tiếp với cán bộ hỗ trợ.";
  }
  if (/thanh toan|le phi|phi|qr|chuyen khoan/.test(text)) {
    return "Bạn có thể thanh toán lệ phí trong bước thanh toán của hồ sơ. Hãy kiểm tra mã hồ sơ, số tiền, nội dung chuyển khoản hoặc mã QR trước khi xác nhận. Nếu đã thanh toán nhưng hệ thống chưa cập nhật, bạn nên chờ vài phút hoặc chat với cán bộ hỗ trợ.";
  }
  if (/ho so.*(o dau|dang o dau|trang thai)|trang thai|xu ly/.test(text)) {
    return "Bạn có thể xem trạng thái hồ sơ trong mục hồ sơ của tôi hoặc tra cứu bằng mã hồ sơ. Nếu trạng thái là cần bổ sung, hãy mở chi tiết hồ sơ để xem ghi chú và tải tài liệu bổ sung.";
  }
  if (/giay to|ho so|chuan bi|can gi/.test(text)) {
    return "Bạn cần chọn đúng thủ tục để xem danh sách giấy tờ. Thông thường hồ sơ gồm giấy tờ tùy thân, biểu mẫu theo thủ tục và tài liệu chứng minh liên quan. Nếu bạn cho biết tên thủ tục cụ thể, tôi sẽ hướng dẫn sát hơn.";
  }
  if (/dang ky|nop ho so|thu tuc|dich vu/.test(text)) {
    return "Bạn có thể vào danh sách dịch vụ công, chọn thủ tục cần làm, đọc hướng dẫn, điền thông tin, tải giấy tờ lên và gửi hồ sơ. Sau khi gửi, hãy theo dõi trạng thái xử lý trong mục hồ sơ của tôi.";
  }
  return contextText
    ? "Tôi đã ghi nhận câu hỏi của bạn. Bạn vui lòng nêu rõ tên thủ tục hoặc mã hồ sơ để tôi hướng dẫn chính xác hơn. Nếu cần xử lý trường hợp cụ thể, bạn có thể chat trực tiếp với cán bộ hỗ trợ."
    : "Trợ lý AI hiện đang dùng chế độ mô phỏng vì chưa cấu hình OPENAI_API_KEY. Bạn có thể hỏi về thủ tục, hồ sơ, thanh toán hoặc trạng thái hồ sơ.";
}

async function callOpenAi({ messages, contextText }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: buildSystemPrompt(contextText) },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 300) || `OpenAI HTTP ${response.status}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || "").trim() || null;
}

function buildAiMessage(text, meta = {}) {
  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId: AI_ASSISTANT_ID,
    senderType: "AI",
    senderName: AI_ASSISTANT_NAME,
    messageType: "text",
    text,
    createdAt: nowIso(),
    meta,
  };
}

async function generateAiReply({ userId = "", message = "", messages = [] }) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return {
      reply: "Bạn vui lòng nhập nội dung cần hỗ trợ.",
      mode: "validation",
      action: "",
    };
  }

  if (wantsStaff(trimmed)) {
    return {
      reply: "Bạn có thể chat trực tiếp với cán bộ hỗ trợ.",
      mode: "handoff",
      action: "OPEN_STAFF_CHAT",
    };
  }

  const { contextText } = await buildContext({ userId, message: trimmed });
  const chatMessages = (Array.isArray(messages) ? messages : [])
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .slice(-10)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));

  if (!chatMessages.length || chatMessages[chatMessages.length - 1]?.role !== "user") {
    chatMessages.push({ role: "user", content: trimmed });
  }

  try {
    const openAiReply = await callOpenAi({ messages: chatMessages, contextText });
    if (openAiReply) {
      return { reply: openAiReply, mode: "openai", action: "" };
    }
  } catch (error) {
    console.error("[aiService] OpenAI error:", error.message);
  }

  return {
    reply: mockReply(trimmed, contextText),
    mode: process.env.OPENAI_API_KEY ? "fallback" : "mock",
    action: "",
  };
}

module.exports = {
  AI_ASSISTANT_ID,
  AI_ASSISTANT_NAME,
  buildAiMessage,
  generateAiReply,
  wantsStaff,
};
