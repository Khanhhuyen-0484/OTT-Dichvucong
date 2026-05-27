const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");
const { getIo } = require("../socket");
const multiChatStore = require("../store/multiChatStore");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { createPresignedPut, isS3Configured } = require("../config/s3");
const { getAiRules, appendAiHistory } = require("../store/adminStore");

// ---------------------------
// Socket helpers
// ---------------------------
async function emitToRoomMembers(room, payload) {
  try {
    const io = getIo();
    const members = room?.members || [];
    members.forEach((m) => {
      const memberId = typeof m === "object" ? m.id : m;
      if (!memberId) return;
      io.to(`user_${memberId}`).emit("new-message", payload);
    });
  } catch (e) {
    console.warn("[Socket] Cannot emit new-message:", e.message);
  }
}

async function emitToRoomAction(room, eventName, payload) {
  try {
    const io = getIo();
    const members = room?.members || [];
    members.forEach((m) => {
      const memberId = typeof m === "object" ? m.id : m;
      if (!memberId) return;
      io.to(`user_${memberId}`).emit(eventName, payload);
    });
  } catch (e) {
    console.warn(`[Socket] Cannot emit ${eventName}:`, e.message);
  }
}

// ---------------------------
// Staff chat
// ---------------------------
exports.staffHistory = async (req, res) => {
  try {
    const conversation = await getChatHistory(req.user.id);
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi hệ thống" });
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
    res.status(500).json({ message: err.message || "Lỗi gửi tin nhắn" });
  }
};

// ---------------------------
// AI helpers (clean rewrite)
// ---------------------------

const TOPIC_KB = {
  birth: {
    label: "Khai sinh",
    ask: "Bạn muốn đăng ký khai sinh cho mới sinh hay xin cấp lại giấy khai sinh?",
    documents:
      "Với đăng ký khai sinh/cấp lại giấy khai sinh và hạn: hồ sơ thường gồm: giấy chứng sinh hoặc giấy tờ thay thế; CCCD/căn cước của cha/mẹ hoặc người đi đăng ký; giấy tờ xác định nơi tiếp nhận. Nếu chưa có giấy chứng sinh, cơ quan thẩm quyền yêu cầu giấy xác nhận hoặc tài liệu thay thế theo từng trường hợp.",
    steps:
      "Bạn có thể làm theo các bước: 1) Chuẩn bị giấy tờ của cha/mẹ và giấy tờ liên quan; 2) Nộp hồ sơ tại UBND cấp xã nơi cư trú hoặc nộp trực tuyến (nếu địa phương có); 3) Theo dõi kết quả và nhận giấy khai sinh theo hướng dẫn.",
    ontime:
      "Nếu đăng ký đúng hạn, bạn nên chuẩn bị giấy chứng sinh hoặc giấy tờ thay thế, CCCD/căn cước của cha/mẹ hoặc người đi đăng ký và thông tin nơi cư trú để xác định UBND cấp xã có thẩm quyền. Sau đó nộp trực tiếp hoặc nộp trực tuyến nếu địa phương hỗ trợ.",
    reissue:
      "Nếu đăng ký lại khai sinh (cấp lại), bạn thường cần giấy tờ chứng minh thông tin khai sinh cũ, giấy tờ tùy thân của người yêu cầu và tài liệu liên quan; trường hợp cụ thể sẽ khác nhau theo nơi đã đăng ký trước đây.",
    online:
      "Nếu đăng ký khai sinh online, hãy chuẩn bị ảnh/scanh giấy tờ. Sau đó đăng nhập cổng dịch vụ công, chọn thủ tục đăng ký khai sinh, điền thông tin của trẻ và cha/mẹ, nộp hồ sơ và theo dõi trạng thái xử lý. Nếu cơ quan yêu cầu đối chiếu bản gốc, bạn cần mang giấy tờ theo hướng dẫn.",
    offline:
      "Nếu nộp trực tiếp đăng ký khai sinh, bạn mang hồ sơ đến UBND cấp xã có thẩm quyền, nộp giấy tờ cho bộ phận tiếp nhận, kiểm tra lại thông tin của cha/mẹ rồi chờ kết quả theo giấy hẹn hoặc hướng dẫn trên cổng dịch vụ.",
    authority:
      "Nơi tiếp nhận thường là UBND cấp xã nơi cư trú của cha hoặc mẹ. Nếu địa phương có lựa chọn trực tuyến, bạn vẫn có thể chọn đúng cơ quan tiếp nhận theo nơi thực tế.",
    fees:
      "Lệ phí đăng ký khai sinh trực tuyến hoặc trực tiếp thường thấp hoặc có thể không thu trong một số trường hợp; bạn nên kiểm tra biểu phí tại nơi tiếp nhận hoặc trên cổng dịch vụ công để biết chính xác.",
    tips: [
      "Kiểm tra kỹ giấy tờ, ngày sinh và thông tin của trẻ trước khi xác nhận hồ sơ.",
      "Nếu thiếu giấy chứng sinh, nên hỏi trước cơ quan có thẩm quyền để biết tài liệu thay thế được chấp nhận.",
      "Nếu làm online, hãy chuẩn bị ảnh scan rõ nét của giấy tờ."
    ],
  },

  residence: {
    label: "Đăng ký tạm trú",
    ask: "Bạn đang cần hướng dẫn đăng ký tạm trú theo đúng thủ tục và các bước nộp hồ sơ?",
    documents:
      "Với thủ tục tạm trú, bạn thường cần giấy tờ tùy thân, thông tin hoặc giấy tờ chứng minh chỗ ở hợp pháp, và biểu mẫu/khai báo theo hướng dẫn của địa phương.",
    steps:
      "Các bước thường là: 1) Chuẩn bị giấy tờ tùy thân và giấy tờ về nơi ở; 2) Nộp hồ sơ trực tuyến hoặc tại nơi tiếp nhận; 3) Theo dõi trạng thái xử lý và bổ sung nếu cơ quan tiếp nhận yêu cầu.",
    online:
      "Nếu nộp online, bạn nên chuẩn bị ảnh scan giấy tờ tùy thân và giấy tờ về chỗ ở hợp pháp để nộp hồ sơ trên cổng dịch vụ công.",
    authority:
      "Thủ tục tạm trú thường do cơ quan công an hoặc cơ quan quản lý cư trú tại địa phương tiếp nhận; tùy mô hình mà cách khai báo có thể khác nhau.",
    timeline:
      "Thời gian xử lý tạm trú có thể khác nhau theo địa phương và tình trạng hồ sơ. Bạn nên theo dõi kết quả trên cổng dịch vụ hoặc hỏi trực tiếp nơi tiếp nhận sau khi nộp."
    ,
    tips: [
      "Chuẩn bị đầy đủ giấy tờ và thông tin để tránh bị yêu cầu bổ sung.",
      "Nếu bị từ chối hoặc yêu cầu chỉnh sửa, hãy kiểm tra lại thông tin trước khi nộp lại."
    ]
  },

  license: {
    label: "Giấy phép lái xe",
    ask: "Bạn đang hỏi về cấp mới hoặc cấp lại giấy phép lái xe?",
    documents:
      "Thường cần giấy tờ như: GPLX hiện có hoặc thông tin GPLX cũ; giấy tờ tùy thân; ảnh chân dung và giấy khám sức khỏe (tùy trường hợp).",
    steps:
      "Bạn nên xác định rõ yêu cầu (cấp mới hoặc cấp lại). Sau đó chuẩn bị hồ sơ phù hợp, nộp tại kênh tiếp nhận thích hợp và theo dõi kết quả theo giấy hẹn hoặc trực tuyến.",
    online:
      "Nếu nộp online, bạn nên chuẩn bị ảnh chân dung, giấy tờ tùy thân, thông tin GPLX và các giấy tờ được yêu cầu để thực hiện thủ tục.",
    authority:
      "Thủ tục GPLX thường do cơ quan giao thông vận tải hoặc đơn vị được ủy quyền tiếp nhận; bạn nên kiểm tra đúng cơ quan theo địa phương/hồ sơ.",
    timeline:
      "Thời gian xử lý cấp mới/cấp lại GPLX tùy địa phương và loại thủ tục. Bạn nên theo dõi giấy hẹn hoặc trạng thái trên cổng dịch vụ.",
    tips: [
      "Kiểm tra thời hạn GPLX và tình trạng hồ sơ trước khi nộp.",
      "Ảnh chân dung và giấy tờ phải rõ ràng, đúng quy định về kích thước/định dạng."
    ]
  },

  passport: {
    label: "Hộ chiếu",
    ask: "Bạn đang cần hướng dẫn cấp mới hay cấp lại hộ chiếu?",
    documents:
      "Bạn nên chuẩn bị ảnh/ảnh chân dung, giấy tờ tùy thân và giấy tờ theo yêu cầu của cơ quan quản lý xuất nhập cảnh phù hợp với trường hợp của bạn.",
    steps:
      "Các bước thường là: chuẩn bị hồ sơ; chọn nơi tiếp nhận; kê khai thông tin chính xác và nộp hồ sơ; theo dõi lịch hẹn hoặc trạng thái xử lý.",
    authority:
      "Hộ chiếu thường do cơ quan quản lý xuất nhập cảnh tiếp nhận và xử lý. Bạn nên kiểm tra đúng nơi nộp theo địa phương hoặc theo điều kiện của mình.",
    tips: [
      "Chuẩn bị ảnh đúng chuẩn để tránh bị yêu cầu nộp lại.",
      "Kiểm tra kỹ thông tin cá nhân trước khi xác nhận hồ sơ."
    ]
  },

  identity: {
    label: "CCCD/Căn cước công dân",
    ask: "Bạn đang hỏi làm CCCD lần đầu, cấp đổi hoặc cấp lại?",
    documents:
      "Với CCCD/Căn cước, bạn nên chuẩn bị giấy tờ tùy thân hiện có, thông tin cư trú/giấy tờ liên quan và giấy tờ theo yêu cầu của cơ quan công an tại nơi tiếp nhận.",
    steps:
      "Bạn nên xác định đúng loại thủ tục (lần đầu/cấp đổi/cấp lại), sau đó chuẩn bị giấy tờ tương ứng rồi đến hoặc nộp theo kênh tiếp nhận của địa phương.",
    authority:
      "CCCD/Căn cước thường do cơ quan công an có thẩm quyền tiếp nhận và xử lý theo nơi cư trú hoặc theo hình thức được cấp phép.",
    tips: [
      "Nếu cấp đổi/cấp lại, mang theo giấy tờ hiện có và tài liệu chứng minh liên quan.",
      "Kiểm tra thông tin trước khi nộp để tránh sai hồ sơ."
    ]
  },
};

function normalizeVietnameseChatText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bko\b|\bkhông\b/g, "không")
    .replace(/\bokela\b|\boki\b|\boke\b/g, "ok")
    .replace(/\bcccđ\b/g, "cccd")
    .trim();
}

function buildBulletList(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return items.map((item) => `- ${item}`).join("\n");
}

function detectFallbackTopic(text) {
  const t = normalizeVietnameseChatText(text);
  if (/khai sinh|đăng ký khai sinh|giấy khai sinh/.test(t)) return "birth";
  if (/tạm trú|đăng ký tạm trú|giữ chỗ tạm|lưu trú/.test(t)) return "residence";
  if (/gplx|lái xe|giấy phép lái xe|giấy ph5p l5i/.test(t)) return "license";
  if (/hộ chiếu|passport|xuất nhập cảnh/.test(t)) return "passport";
  if (/cccd|chứng minh thư|căn cước/.test(t)) return "identity";
  if (/phí|lệ phí|bao nhiêu tiền|giá/.test(t)) return "fees";
  if (/thời gian|giờ làm|mấy giờ/.test(t)) return "hours";
  return "";
}

function detectFollowUpIntent(text) {
  const t = normalizeVietnameseChatText(text);

  if (/hướng dẫn|nộp ở đâu|nộp đâu|chi tiết|cần chi tiết/.test(t)) return "detail";
  if (/cần giấy tờ|hồ sơ gồm|chuẩn bị|mang gì/.test(t)) return "documents";
  if (/thủ tục|quy trình|các bước/.test(t)) return "steps";
  if (/cấp lại|cấp đổi|làm lại/.test(t)) return "reissue";
  if (/đúng hạn/.test(t)) return "ontime";
  if (/nộp online|trực tuyến|online/.test(t)) return "online";
  if (/nộp trực tiếp|đến trực tiếp/.test(t)) return "offline";
  if (/nơi nào|cơ quan nào|ubnd|địa chỉ nộp|nộp ở đâu/.test(t)) return "authority";
  if (/lưu ý|cần lưu|mẹo|note/.test(t)) return "tips";
  if (/bao lâu|mất bao lâu|thời hạn|mấy ngày/.test(t)) return "timeline";
  if (/đúng rồi|vâng|ok/.test(t)) return "confirm_yes";
  if (/không|chưa|sai rồi/.test(t)) return "confirm_no";

  return "";
}

function isShortFollowUpAnswer(text) {
  const t = normalizeVietnameseChatText(text);
  if (!t) return false;
  if (t.length <= 30) return true;
  return /^(đúng hạn|cấp lại|nộp online|trực tuyến|nộp trực tiếp|cần giấy tờ|các bước|hướng dẫn chi tiết)$/i.test(t);
}

function inferTopicFromAssistantPrompt(text) {
  const t = normalizeVietnameseChatText(text);
  if (/khai sinh|giấy khai sinh/.test(t)) return "birth";
  if (/tạm trú|lưu trú/.test(t)) return "residence";
  if (/gplx|giấy phép lái xe|lái xe/.test(t)) return "license";
  if (/hộ chiếu|passport/.test(t)) return "passport";
  if (/cccd|chứng minh thư|căn cước/.test(t)) return "identity";
  return "";
}

function inferPendingQuestion(lastAssistantMessage) {
  const t = normalizeVietnameseChatText(lastAssistantMessage);
  if (/đúng hạn|cấp lại|cấp đổi/.test(t)) return "birth_branch";
  if (/cấp mới|cấp lại|cấp đổi/.test(t)) return "variant_branch";
  if (/giấy tờ|hồ sơ|mang|chuẩn bị/.test(t)) return "documents";
  if (/các bước|quy trình|thủ tục/.test(t)) return "steps";
  if (/online|trực tuyến|trực tiếp/.test(t)) return "channel_branch";
  if (/nộp ở đâu|cơ quan|ubnd/.test(t)) return "authority";
  return "";
}

function findLastAssistantMessage(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "assistant" && typeof list[i]?.content === "string") return list[i].content;
  }
  return "";
}

function findTopicFromMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const content = String(list[i]?.content || "");
    const topic = detectFallbackTopic(content);
    if (topic) return topic;
  }
  return "";
}

function buildConversationState(messages, userText) {
  const lastAssistantMessage = findLastAssistantMessage(messages.slice(0, -1));
  const assistantTopic = inferTopicFromAssistantPrompt(lastAssistantMessage);
  const previousTopic = findTopicFromMessages(messages.slice(0, -1));
  const currentTopic = detectFallbackTopic(userText);

  const topic = currentTopic || assistantTopic || previousTopic;
  const followUpIntent = detectFollowUpIntent(userText);
  const pendingQuestion = inferPendingQuestion(lastAssistantMessage);

  return { topic, followUpIntent, pendingQuestion, lastAssistantMessage };
}

function replyForTopic(topic, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return "";
  if (intent === "detail") return kb.steps || kb.documents || kb.ask || "";
  if (intent === "tips") {
    if (kb.tips?.length) return `Lưu ý khi làm ${kb.label}:\n${buildBulletList(kb.tips)}`;
    return kb.documents || kb.ask || "";
  }
  if (intent === "timeline") {
    // default timeline (soft, not guaranteed)
    return `Thời gian xử lý của ${kb.label} có thể khác nhau theo từng địa phương. Bạn nên kiểm tra thông báo tại nơi tiếp nhận hoặc trên cổng dịch vụ để biết mốc thời gian chính xác.`;
  }
  if (intent === "fees") return kb.fees || `Lệ phí cho ${kb.label} có thể thay đổi theo từng địa phương. Bạn nên kiểm tra biểu phí tại nơi tiếp nhận hoặc trên cổng dịch vụ công.`;

  return kb[intent] || kb.ask || "";
}

function composeSmartReply(topic, primaryAnswer, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return primaryAnswer;

  const nextStepByIntent = {
    documents: "Nếu bạn muốn, tôi có thể nói tiếp phần các giấy tờ cần chuẩn bị hoặc cách nộp hồ sơ.",
    steps: "Nếu bạn muốn, tôi có thể nói tiếp phần giấy tờ cần chuẩn bị hoặc cách nộp online.",
    ontime: "Nếu bạn muốn, tôi có thể nói tiếp phần hồ sơ cần chuẩn bị hoặc nơi nộp.",
    reissue: "Nếu bạn muốn, tôi có thể nói tiếp phần giấy tờ cần đổi/cấp lại hoặc nơi tiếp nhận.",
    online: "Nếu bạn muốn, tôi có thể nói tiếp phần giấy tờ cần scan/chụp và các lưu ý khi nộp online.",
    offline: "Nếu bạn muốn, tôi có thể nói tiếp phần hồ sơ cần mang theo hoặc thời gian xử lý thường gặp.",
    authority: "Nếu bạn muốn, tôi có thể nói tiếp nơi nộp hồ sơ và các bước nộp.",
    timeline: "Nếu bạn muốn, tôi có thể nói tiếp mốc thời gian và cách theo dõi kết quả."
  };

  const nextStep = nextStepByIntent[intent] || "Nếu bạn muốn, tôi có thể nói tiếp phần các bước, nơi nộp hoặc lưu ý quan trọng.";
  return `${primaryAnswer}\n\n${nextStep}`;
}

function buildAiSuggestions(topic, intent = "") {
  const suggestionMap = {
    birth: ["Cần giấy tờ gì?", "Nộp online thế nào?", "Nộp ở đâu?", "Có lưu ý gì khi nộp hồ sơ?"],
    residence: ["Hồ sơ cần chuẩn bị gồm?", "Các bước đăng ký tạm trú?", "Nộp online được không?", "Thời gian xử lý bao lâu?"],
    license: ["Đổi/cấp lại GPLX cần giấy tờ gì?", "Nộp online ra sao?", "Thời gian xử lý bao lâu?", "Lưu ý khi làm hồ sơ"],
    passport: ["Cấp hộ chiếu cần giấy tờ gì?", "Nộp ở đâu?", "Các bước thực hiện?", "Lưu ý"],
    identity: ["Làm CCCD cần giấy tờ gì?", "Nộp ở đâu?", "Thời gian xử lý bao lâu?", "Lưu ý"],
  };

  const generic = ["Cần giấy tờ gì?", "Các bước thực hiện ra sao?", "Nộp ở đâu?", "Lưu ý quan trọng" ];
  const suggestions = suggestionMap[topic] || generic;

  if (!intent) return suggestions.slice(0, 4);

  return suggestions
    .filter((item) => {
      const normalized = normalizeVietnameseChatText(item);
      if (intent === "documents") return !normalized.includes("giấy tờ");
      if (intent === "steps") return !normalized.includes("bước");
      if (intent === "authority") return !normalized.includes("nộp ở đâu");
      if (intent === "tips") return !normalized.includes("lưu ý");
      return true;
    })
    .slice(0, 4);
}

function replyForPendingQuestion(topic, pendingQuestion, userText, intent) {
  if (!topic) return "";

  if (pendingQuestion === "birth_branch") {
    if (intent === "ontime") return replyForTopic(topic, "ontime");
    if (intent === "reissue") return replyForTopic(topic, "reissue");
  }

  if (pendingQuestion === "channel_branch") {
    if (intent === "online") return replyForTopic(topic, "online");
    if (intent === "offline") return replyForTopic(topic, "offline");
  }

  if (pendingQuestion === "documents" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "documents");
  }

  if (pendingQuestion === "steps" && (intent === "confirm_yes" || isShortFollowUpAnswer(userText))) {
    return replyForTopic(topic, "steps");
  }

  return "";
}

function buildConversationSummary(messages, userText) {
  const state = buildConversationState(messages, userText);
  const recentUserMessages = messages
    .filter((m) => m?.role === "user" && typeof m?.content === "string")
    .slice(-3)
    .map((m) => `- ${m.content}`)
    .join("\n");

  return [
    state.topic ? `Chủ đề suy ra: ${state.topic}` : "Chưa suy ra chủ đề",
    state.followUpIntent ? `Ý định gần nhất của người dùng: ${state.followUpIntent}` : "Ý định gần nhất chưa rõ",
    state.pendingQuestion ? `Câu hỏi nhánh gần nhất: ${state.pendingQuestion}` : "Không có câu hỏi nhánh",
    state.lastAssistantMessage ? `Tin nhắn trợ lý gần nhất: ${state.lastAssistantMessage}` : "Chưa có tin nhắn trợ lý gần nhất",
    recentUserMessages ? `Ba tin nhắn người dùng gần nhất:\n${recentUserMessages}` : "Chưa có tin nhắn người dùng" 
  ].join("\n");
}

function fallbackAiReply(userText, messages = []) {
  const t = normalizeVietnameseChatText(userText);
  const state = buildConversationState(messages, userText);
  const { topic, followUpIntent, pendingQuestion } = state;

  const pendingReply = replyForPendingQuestion(topic, pendingQuestion, userText, followUpIntent);
  if (pendingReply) return composeSmartReply(topic, pendingReply, followUpIntent);

  if (topic && isShortFollowUpAnswer(userText) && followUpIntent) {
    const intentReply = replyForTopic(topic, followUpIntent);
    if (intentReply) return composeSmartReply(topic, intentReply, followUpIntent);
  }

  if (topic && followUpIntent) {
    const followUpReply = replyForTopic(topic, followUpIntent);
    if (followUpReply) return composeSmartReply(topic, followUpReply, followUpIntent);
  }

  if (/chào|xin chào|hello|hi\b/.test(t)) {
    return "Xin chào! Tôi là trợ lý AI hỗ trợ tra cứu thủ tục hành chính trên Cổng dịch vụ công. Bạn cần tra cứu thủ tục, biểu mẫu hay hướng dẫn nộp hồ sơ?";
  }

  if (/chứng minh thư|cccd|căn cước/.test(t)) {
    return "Với thủ tục liên quan CCCD/Căn cước công dân, bạn nên chuẩn bị giấy tờ tùy thân hiện có và thông tin cư trú, sau đó thực hiện theo hướng dẫn của cơ quan công an tại nơi tiếp nhận. Nếu bạn nói rõ bạn đang làm lần đầu/cấp đổi/cấp lại, tôi sẽ hướng dẫn sát hơn.";
  }

  if (/khai sinh/.test(t)) {
    return "Đăng ký khai sinh thường cần thông tin của cha mẹ/người đi đăng ký và giấy tờ theo từng trường hợp (giấy chứng sinh hoặc giấy tờ thay thế, giấy tờ tùy thân). Bạn cho tôi biết bạn đăng ký đúng hạn hay đăng ký lại/cấp lại để tôi hướng dẫn đúng quy trình.";
  }

  if (/tạm trú|lưu trú/.test(t)) {
    return "Về tạm trú/lưu trú: thường cần giấy tờ tùy thân, giấy tờ chứng minh chỗ ở hợp pháp (nếu có), và hồ sơ/biểu mẫu theo hướng dẫn. Bạn cho tôi biết bạn muốn nộp trực tuyến hay trực tiếp để tôi hướng dẫn chính xác.";
  }

  if (/gplx|giấy phép lái xe|lái xe/.test(t)) {
    return "Về GPLX: chuẩn bị ảnh, giấy khám sức khỏe, GPLX cũ (nếu cấp lại/đổi) và thực hiện theo hướng dẫn tại cổng dịch vụ công/đơn vị tiếp nhận. Bạn cho tôi biết cấp mới hay cấp lại để tôi hướng dẫn sát hơn.";
  }

  if (/hộ chiếu|passport/.test(t)) {
    return "Cấp hộ chiếu: thường cần ảnh chân dung, CCCD/giấy tờ tùy thân và các giấy tờ theo yêu cầu. Bạn cho tôi biết bạn muốn cấp mới hay cấp lại để tôi hướng dẫn chi tiết.";
  }

  if (topic) {
    const topicReply = replyForTopic(topic, "");
    if (topicReply) return composeSmartReply(topic, topicReply, "");
  }

  return "Cảm ơn bạn đã liên hệ. Hãy mô tả ngắn thủ tục bạn cần (ví dụ: tạm trú, GPLX, hộ chiếu, khai sinh) hoặc cho tôi biết bạn muốn nộp online hay trực tiếp.";
}

function buildKnowledgeSnippets(userText) {
  const t = String(userText || "").toLowerCase();
  const snippets = [];

  if (/tạm trú|lưu trú/.test(t)) {
    snippets.push("Tạm trú/lưu trú: ưu tiên hướng dẫn theo nhóm thông tin (giấy tờ tùy thân, giấy tờ chỗ ở hợp pháp, quy trình nộp trực tuyến và theo dõi xác nhận)." );
  }
  if (/gplx|giấy phép lái xe|lái xe/.test(t)) {
    snippets.push("GPLX: nhắc kiểm tra sự khác nhau giữa cấp mới/cấp lại/đổi; chuẩn bị ảnh chân dung, giấy khám sức khỏe, và kênh nộp theo địa phương." );
  }
  if (/hộ chiếu|passport|xuất nhập cảnh/.test(t)) {
    snippets.push("Hộ chiếu: chuẩn bị ảnh đúng chuẩn, CCCD/giấy tờ tùy thân và theo yêu cầu của cơ quan quản lý xuất nhập cảnh tại nơi tiếp nhận." );
  }
  if (/khai sinh/.test(t)) {
    snippets.push("Khai sinh: nhắc theo trường hợp đúng hạn/cấp lại; giấy tờ của cha mẹ/người đi đăng ký; nơi nộp và thời gian xử lý theo hướng dẫn." );
  }
  if (/căn cước|cccd|chứng minh thư|giấy tờ tùy thân/.test(t)) {
    snippets.push("CCCD/Căn cước: nhấn mạnh xác định đúng loại thủ tục và kiểm tra giấy tờ trước khi nộp." );
  }

  return snippets;
}

function buildSystemPrompt(rulesText, conversationSummary, snippets = []) {
  const knowledgeBlock = snippets.length
    ? `\nNgữ cảnh liên quan:\n- ${snippets.join("\n- ")}`
    : "";

  return `Bạn là GOV Assistant, trợ lý AI của Cổng Dịch vụ công Việt Nam.\n\nMục tiêu:\n- Hỗ trợ người dân tra cứu thủ tục hành chính, giấy tờ, quy trình nộp hồ sơ và lưu ý thực hiện.\n- Trả lời giống kiểu chat hiện đại: thân thiện, mạch lạc, gọn và có chỉ dẫn bước tiếp theo.\n- Tuyệt đối không bịa thông tin pháp lý/không cam kết kết quả xử lý.\n\nQuy tắc trả lời hiện hành do admin cấu hình:\n${rulesText || ""}${knowledgeBlock}\n\nTóm tắt hội thoại hiện tại:\n${conversationSummary}\n\nCách trả lời:\n- Luôn trả lời bằng tiếng Việt.\n- Ưu tiên câu trả lời trực tiếp, rồi liệt kê 2-5 ý quan trọng nếu cần.\n- Nếu câu hỏi chưa đủ dữ kiện, hỏi lại 1-2 thông tin quan trọng nhất.\n- Nếu người dùng đã trả lời cho câu hỏi nhánh, trả lời tiếp ngay vào phần tương ứng.\n- Nếu có rủi ro sai khác theo địa phương/quy định mới, nêu rõ đây là tham khảo và khuyến nghị kiểm tra tại cơ quan có thẩm quyền.\n- Không dùng emoji nếu không thật sự cần.\n- Nếu ngoài phạm vi thủ tục hành chính, lịch sự từ chối và hướng người sang kênh hỗ trợ phù hợp.`;
}

async function openAiChat(messages, rulesText, userText) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const snippets = buildKnowledgeSnippets(userText);
  const conversationSummary = buildConversationSummary(messages, userText);

  const body = {
    model,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(rulesText, conversationSummary, snippets),
      },
      ...messages,
    ],
    max_tokens: 900,
    temperature: 0.4,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
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
    const sessionId = String(req.body?.sessionId || "").trim() || `guest-${Date.now()}`;

    let userText = "";
    if (typeof raw === "string") {
      userText = raw.trim();
    } else if (Array.isArray(history) && history.length) {
      const last = history[history.length - 1];
      if (last?.role === "user" && typeof last.content === "string") userText = last.content.trim();
    }

    if (!userText) return res.status(400).json({ message: "Vui lòng nhập nội dung câu hỏi." });
    if (userText.length > 4000) return res.status(400).json({ message: "Nội dung quá dài." });

    const msgs = Array.isArray(history)
      ? history
          .filter(
            (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
          )
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [{ role: "user", content: userText }];

    const rulesText = await getAiRules().catch(() => "");
    const state = buildConversationState(msgs, userText);

    let reply = null;
    let mode = process.env.OPENAI_API_KEY ? "openai" : "fallback";

    try {
      reply = await openAiChat(msgs, rulesText, userText);
    } catch (e) {
      console.error("OpenAI error:", e.message);
      mode = "fallback";
    }

    if (!reply) {
      reply = fallbackAiReply(userText, msgs);
      mode = "fallback";
    }

    const detectedTopic = state.topic || detectFallbackTopic(reply) || "";
    const suggestions = buildAiSuggestions(detectedTopic, state.followUpIntent);

    const actorName =
      req.user?.fullName ||
      req.user?.name ||
      req.user?.email ||
      req.body?.visitorName ||
      "Khách";

    await appendAiHistory({
      sessionId,
      question: userText,
      answer: reply,
      source: "home_chat",
      mode,
      userId: req.user?.id || "",
      userName: actorName,
      turnIndex: msgs.filter((m) => m.role === "user").length,
      confidenceLabel: mode === "openai" ? "assisted" : "fallback",
      note:
        mode === "fallback"
          ? "Trả lời bằng bộ quy tắc nội bộ/fallback"
          : "Trả lời bằng mô hình AI",
      meta: {
        turns: msgs.length,
        detectedTopic,
        suggestions,
        hasAuthenticatedUser: Boolean(req.user?.id),
        ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
      },
    }).catch((error) => {
      console.error("appendAiHistory error:", error.message);
    });

    res.json({ reply, mode, sessionId, detectedTopic, suggestions });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi trả lời AI" });
  }
};

// ---------------------------
// Room / Contact APIs
// (kept as in existing controller)
// ---------------------------
exports.chatContacts = async (req, res) => {
  try {
    const q = req.query?.q ?? req.query?.query ?? "";
    const contacts = await multiChatStore.searchContacts({
      keyword: q,
      currentUserId: req.user.id,
    });
    return res.json({ contacts });
  } catch (err) {
    console.error("[chatContacts]", err);
    return res.status(500).json({ message: err.message || "Lỗi tải danh bạ" });
  }
};

exports.friendDiscovery = async (req, res) => {
  try {
    const q = req.query?.q ?? req.query?.query ?? "";
    const users = await userStore.searchUsersForFriendAdd(req.user.id, q);
    return res.json({ users });
  } catch (err) {
    console.error("[friendDiscovery]", err);
    return res.status(500).json({ message: err.message || "Lỗi tìm người dùng" });
  }
};

exports.friendSuggestions = async (req, res) => {
  try {
    const limit = Number(req.query?.limit || 5);
    const users = await userStore.listSuggestedFriends(req.user.id, limit);
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải gợi ý kết bạn" });
  }
};

exports.friendRequests = async (req, res) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      userStore.listIncomingFriendRequests(req.user.id),
      userStore.listOutgoingFriendRequests(req.user.id),
    ]);

    return res.json({
      requests: incoming,
      incoming,
      outgoing,
      counts: {
        incoming: incoming.length,
        outgoing: outgoing.length,
      },
    });
  } catch (err) {
    console.error("[friendRequests]", err);
    return res.status(500).json({ message: err.message || "Lỗi tải lời mời kết bạn" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.body?.targetUserId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng cần kết bạn" });
    const result = await userStore.sendFriendRequest(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gửi lời mời kết bạn" });
  }
};

exports.respondFriendRequest = async (req, res) => {
  try {
    const requesterId = String(req.params.userId || "").trim();
    const action = String(req.body?.action || "accept").trim().toLowerCase();
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Phản hồi không hợp lệ" });
    }
    const result = await userStore.respondToFriendRequest(req.user.id, requesterId, action);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể phản hồi lời mời kết bạn" });
  }
};

exports.revokeFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng cần thu hồi" });
    const result = await userStore.revokeFriendRequest(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể thu hồi lời mời kết bạn" });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng" });
    const result = await userStore.removeFriend(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể xóa bạn" });
  }
};

exports.blockFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng" });
    const result = await userStore.blockUser(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể chặn người dùng" });
  }
};

exports.blockedFriends = async (req, res) => {
  try {
    const users = await userStore.listBlockedUsers(req.user.id);
    return res.json({ users });
  } catch (err) {
    console.error("[blockedFriends]", err);
    return res.status(500).json({ message: err.message || "Không thể tải danh sách bị chặn" });
  }
};

exports.unblockFriend = async (req, res) => {
  try {
    const targetUserId = String(req.params.userId || "").trim();
    if (!targetUserId) return res.status(400).json({ message: "Thiếu người dùng" });
    const result = await userStore.unblockUser(req.user.id, targetUserId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể bỏ chặn người dùng" });
  }
};

exports.chatRooms = async (req, res) => {
  try {
    const rooms = await multiChatStore.listRoomsForUser(req.user.id);
    const hydrated = await Promise.all(
      rooms.map((r) => multiChatStore.hydrateRoomForUser(r, req.user.id))
    );
    return res.json({ rooms: hydrated });
  } catch (err) {
    console.error("[chatRooms]", err);
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

exports.groupInvites = async (req, res) => {
  try {
    const rooms = await multiChatStore.listGroupInvitesForUser(req.user.id);
    const invites = await Promise.all(
      rooms.map((room) => multiChatStore.hydrateRoomForUser(room, req.user.id))
    );
    return res.json({ invites });
  } catch (err) {
    console.error("[groupInvites]", err);
    return res.status(500).json({ message: err.message || "Lỗi tải lời mời nhóm" });
  }
};

exports.inviteGroupMembers = async (req, res) => {
  try {
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

    const room = await multiChatStore.inviteMembersToGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberIds,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể mời bạn vào nhóm" });
  }
};

exports.respondGroupInvite = async (req, res) => {
  try {
    const action = String(req.body?.action || "accept").trim().toLowerCase();
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Phản hồi không hợp lệ" });
    }

    const room = await multiChatStore.respondToGroupInvite({
      roomId: req.params.roomId,
      userId: req.user.id,
      action,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể phản hồi lời mời nhóm" });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const media = req.body?.media || null;
    const location = req.body?.location || null;
    const replyToMessageId = String(req.body?.replyToMessageId || "").trim();

    if (!text && !media && !location) {
      return res.status(400).json({ message: "Tin nhắn không được để trống" });
    }

    const room = await multiChatStore.appendMessage({
      roomId: req.params.roomId,
      senderId: req.user.id,
      text,
      media,
      location,
      replyToMessageId,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const lastMessage = hydrated.messages[hydrated.messages.length - 1];

    await emitToRoomMembers(room, { roomId: req.params.roomId, message: lastMessage });

    return res.json({ room: hydrated, message: lastMessage });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể gửi tin nhắn" });
  }
};

exports.presignChatMediaUpload = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Chưa cấu hình S3. Đặt S3_BUCKET (hoặc AWS_S3_BUCKET), AWS_REGION và AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env.",
    });
  }

  try {
    const contentType = String(req.body?.contentType || "").trim().toLowerCase();
    let fileName = String(req.body?.fileName || "file").trim();

    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(contentType);

    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video hoặc tài liệu (.pdf/.doc/.docx)",
      });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ext) {
      const inferred = contentType.startsWith("video/")
        ? ".mp4"
        : contentType === "application/pdf"
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";
      fileName += inferred;
    }

    const safeName = path
      .basename(fileName)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 120);

    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const { uploadUrl, publicUrl } = await createPresignedPut({
      key,
      contentType,
      expiresSec: 300,
    });

    return res.json({
      uploadUrl,
      publicUrl,
      key,
      method: "PUT",
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Không tạo được link upload media chat" });
  }
};

exports.uploadChatMedia = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({ message: "Chưa cấu hình S3." });
  }

  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Không có file được upload" });

    const contentType = file.mimetype;
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(contentType);

    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video hoặc tài liệu (.pdf/.doc/.docx)",
      });
    }

    const fileName = file.originalname || "file";
    const ext = path.extname(fileName).toLowerCase();

    let safeName = path
      .basename(fileName, ext)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 100);

    if (!ext) {
      const inferred = contentType.startsWith("video/")
        ? ".mp4"
        : contentType === "application/pdf"
          ? ".pdf"
          : contentType.includes("word")
            ? ".docx"
            : ".jpg";
      safeName += inferred;
    } else {
      safeName += ext;
    }

    const key = `chat-media/${req.user.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;

    const { uploadBuffer } = require("../config/s3");
    const uploaded = await uploadBuffer({
      key,
      buffer: file.buffer,
      contentType,
    });

    return res.json({
      url: uploaded.publicUrl,
      publicUrl: uploaded.publicUrl,
      key: uploaded.key,
      contentType: uploaded.contentType,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Không upload được media chat" });
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

exports.togglePinRoomMessage = async (req, res) => {
  try {
    const room = await multiChatStore.togglePinMessage({
      roomId: req.params.roomId,
      messageId: req.params.messageId,
      requesterId: req.user.id,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    const message = hydrated.messages.find((m) => m.id === req.params.messageId) || null;

    if (message?.isPinned || message?.pinned) {
      await emitToRoomAction(room, "message:pinned", { roomId: req.params.roomId, message });
    } else {
      await emitToRoomAction(room, "message:unpinned", { roomId: req.params.roomId, message });
    }

    await emitToRoomMembers(room, { roomId: req.params.roomId, message, action: "pin-updated" });
    return res.json({ room: hydrated, message });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể ghim tin nhắn" });
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
    return res.status(400).json({ message: err.message || "Không thể mời thành viên" });
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
    return res.status(400).json({ message: err.message || "Không thể gán quyền phó" });
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
    return res.status(400).json({ message: err.message || "Không thể gỡ quyền phó" });
  }
};

exports.updateGroupChat = async (req, res) => {
  try {
    const name = req.body?.name;
    const avatarUrl = req.body?.avatarUrl;

    const hasName = typeof name === "string";
    const hasAvatar = typeof avatarUrl === "string";

    if (!hasName && !hasAvatar) {
      return res.status(400).json({ message: "Không có thông tin cần cập nhật" });
    }

    const room = await multiChatStore.updateGroupRoom({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      name: hasName ? name : undefined,
      avatarUrl: hasAvatar ? avatarUrl : undefined,
    });

    const hydrated = await multiChatStore.hydrateRoomForUser(room, req.user.id);
    await emitToRoomMembers(room, { roomId: req.params.roomId, action: "group-updated" });

    return res.json({ room: hydrated });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Không thể cập nhật nhóm" });
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

// keep multer import used by routes if needed in other files
exports._multer = multer;

