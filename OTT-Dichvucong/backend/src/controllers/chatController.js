const { getChatHistory, sendMessage } = require("../store/supportConversationsStore");
const userStore = require("../store/userStore");
const { getIo } = require("../socket");
const multiChatStore = require("../store/multiChatStore");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { createPresignedPut, isS3Configured } = require("../config/s3");
const { getAiRules, appendAiHistory } = require("../store/adminStore");

const TOPIC_KB = {
  birth: {
    label: "đăng ký khai sinh",
    ask: "Đây là đăng ký khai sinh đúng hạn cho trẻ mới sinh hay đăng ký lại giấy khai sinh đã mất/thất lạc?",
    documents:
      "Với đăng ký khai sinh đúng hạn, hồ sơ thường gồm: giấy chứng sinh hoặc giấy tờ thay thế, CCCD/căn cước của cha mẹ hoặc người đi đăng ký, và thông tin cư trú để xác định nơi tiếp nhận. Nếu trẻ chưa có giấy chứng sinh, cơ quan hộ tịch thường sẽ yêu cầu giấy xác nhận hoặc tài liệu thay thế theo trường hợp thực tế.",
    steps:
      "Bạn có thể làm theo 3 bước: 1. Chuẩn bị giấy chứng sinh hoặc giấy tờ thay thế cùng giấy tờ tùy thân của người đi đăng ký. 2. Nộp hồ sơ tại UBND cấp xã nơi cư trú của cha hoặc mẹ, hoặc thực hiện trên cổng dịch vụ công nếu địa phương hỗ trợ. 3. Theo dõi kết quả và đối chiếu thông tin của trẻ, cha mẹ trước khi nhận giấy khai sinh.",
    ontime:
      "Nếu là đăng ký khai sinh đúng hạn, bạn nên chuẩn bị giấy chứng sinh hoặc giấy tờ thay thế, CCCD/căn cước của cha, mẹ hoặc người đi đăng ký, và thông tin nơi cư trú để xác định UBND cấp xã có thẩm quyền tiếp nhận. Sau đó bạn có thể nộp trực tiếp hoặc nộp trực tuyến nếu địa phương hỗ trợ.",
    reissue:
      "Nếu là đăng ký lại khai sinh, bạn thường cần bản cam kết hoặc giấy tờ chứng minh thông tin khai sinh cũ, giấy tờ tùy thân của người yêu cầu và tài liệu liên quan để cơ quan hộ tịch đối chiếu. Trường hợp này dễ khác nhau theo nơi đăng ký trước đây, nên bạn nên chuẩn bị thêm thông tin nơi đã đăng ký khai sinh lần đầu.",
    online:
      "Nếu bạn muốn nộp đăng ký khai sinh online, hãy chuẩn bị ảnh hoặc bản scan giấy chứng sinh, giấy tờ tùy thân của người đi đăng ký và thông tin cư trú. Sau đó đăng nhập cổng dịch vụ công của địa phương, chọn thủ tục đăng ký khai sinh, điền thông tin của trẻ và cha mẹ, tải hồ sơ lên rồi theo dõi trạng thái xử lý. Khi cơ quan hộ tịch yêu cầu đối chiếu bản gốc, bạn cần mang giấy tờ thật đến theo hướng dẫn.",
    offline:
      "Nếu nộp trực tiếp đăng ký khai sinh, bạn mang hồ sơ đến UBND cấp xã có thẩm quyền, nộp giấy tờ cho bộ phận tiếp nhận, kiểm tra lại thông tin của trẻ và cha mẹ rồi chờ trả kết quả theo giấy hẹn hoặc hướng dẫn tại chỗ.",
    authority:
      "Nơi tiếp nhận thường là UBND cấp xã nơi cư trú của cha hoặc mẹ. Nếu địa phương có hỗ trợ trực tuyến, bạn vẫn cần chọn đúng cơ quan tiếp nhận theo nơi cư trú thực tế.",
    fees:
      "Nhiều địa phương xử lý đăng ký khai sinh đúng hạn với mức phí rất thấp hoặc không thu phí trong một số trường hợp, nhưng bạn vẫn nên kiểm tra biểu phí tại nơi tiếp nhận để có thông tin chính xác nhất.",
    tips: [
      "Kiểm tra kỹ họ tên, ngày sinh, quê quán của trẻ trước khi xác nhận hồ sơ.",
      "Nếu thiếu giấy chứng sinh, nên hỏi trước cơ quan hộ tịch về giấy tờ thay thế được chấp nhận.",
      "Nếu làm online, hãy chuẩn bị ảnh chụp hoặc bản scan giấy tờ rõ nét."
    ]
  },
  residence: {
    label: "đăng ký tạm trú",
    ask: "Bạn đang cần hướng dẫn phần hồ sơ cần chuẩn bị hay các bước nộp tạm trú?",
    documents:
      "Với thủ tục tạm trú, bạn thường cần giấy tờ tùy thân, thông tin hoặc giấy tờ chứng minh chỗ ở hợp pháp, và biểu mẫu/khai báo theo hướng dẫn của địa phương.",
    steps:
      "Các bước thường là: 1. Chuẩn bị giấy tờ tùy thân và giấy tờ về nơi ở. 2. Kê khai thông tin tạm trú trực tuyến hoặc tại nơi tiếp nhận. 3. Theo dõi trạng thái xử lý và bổ sung nếu cơ quan tiếp nhận yêu cầu.",
    online:
      "Nếu nộp online, bạn nên chuẩn bị bản scan giấy tờ tùy thân và giấy tờ về chỗ ở hợp pháp để tải lên cổng dịch vụ công.",
    authority:
      "Thủ tục tạm trú thường do cơ quan công an hoặc cơ quan quản lý cư trú tại địa phương tiếp nhận, tùy mô hình triển khai của nơi bạn cư trú.",
    timeline:
      "Thời gian xử lý tạm trú có thể khác nhau theo địa phương và tình trạng hồ sơ. Bạn nên theo dõi kết quả trên cổng hoặc hỏi trực tiếp nơi tiếp nhận sau khi nộp.",
    tips: [
      "Chuẩn bị đầy đủ giấy tờ về chỗ ở hợp pháp để tránh bị yêu cầu bổ sung.",
      "Nếu bạn thuê trọ, nên kiểm tra trước giấy tờ mà chủ nhà cần cung cấp."
    ]
  },
  license: {
    label: "đổi/cấp lại giấy phép lái xe",
    ask: "Bạn đang hỏi về cấp đổi hay cấp lại giấy phép lái xe?",
    documents:
      "Thường sẽ có nhóm giấy tờ như GPLX hiện có hoặc thông tin GPLX cũ, giấy tờ tùy thân, ảnh chân dung và đôi khi là giấy khám sức khỏe tùy trường hợp.",
    steps:
      "Bạn nên xác định rõ là cấp đổi hay cấp lại, sau đó chuẩn bị hồ sơ, nộp tại kênh tiếp nhận phù hợp và theo dõi kết quả xử lý theo giấy hẹn hoặc hệ thống trực tuyến.",
    online:
      "Nếu nộp online đổi GPLX, bạn nên chuẩn bị ảnh chân dung, giấy tờ tùy thân, thông tin GPLX và các giấy tờ được yêu cầu ở dạng số hóa rõ nét.",
    authority:
      "Thủ tục GPLX thường do cơ quan giao thông hoặc đơn vị được ủy quyền tiếp nhận. Bạn nên kiểm tra cổng dịch vụ công hoặc nơi tiếp nhận tại địa phương.",
    timeline:
      "Thời gian xử lý đổi hoặc cấp lại GPLX tùy từng địa phương và loại thủ tục. Bạn nên theo dõi giấy hẹn hoặc trạng thái hồ sơ trực tuyến.",
    tips: [
      "Kiểm tra thời hạn GPLX hiện tại trước khi chọn thủ tục cấp đổi hay cấp lại.",
      "Ảnh chân dung và giấy tờ tải lên nên rõ, đủ sáng, không cắt mất góc."
    ]
  },
  passport: {
    label: "cấp/đổi hộ chiếu",
    ask: "Bạn đang cần hướng dẫn cấp mới hay cấp lại hộ chiếu?",
    documents:
      "Bạn nên chuẩn bị ảnh đúng chuẩn, giấy tờ tùy thân và kiểm tra yêu cầu hồ sơ của cơ quan quản lý xuất nhập cảnh đối với trường hợp của bạn.",
    steps:
      "Các bước thường là chuẩn bị hồ sơ, chọn nơi tiếp nhận, kê khai thông tin chính xác và theo dõi lịch hẹn hoặc trạng thái xử lý.",
    authority:
      "Hộ chiếu thường do cơ quan quản lý xuất nhập cảnh tiếp nhận và xử lý. Bạn nên kiểm tra đúng nơi tiếp nhận theo địa phương hoặc diện thủ tục của mình.",
    tips: [
      "Ảnh dùng cho hộ chiếu nên đúng chuẩn để tránh bị yêu cầu nộp lại.",
      "Kiểm tra kỹ thông tin nhân thân trước khi xác nhận hồ sơ."
    ]
  },
  identity: {
    label: "cấp/cấp đổi/cấp lại CCCD",
    ask: "Bạn đang làm CCCD lần đầu, cấp đổi hay cấp lại?",
    documents:
      "Với CCCD/Căn cước, bạn nên chuẩn bị giấy tờ tùy thân hiện có, thông tin cư trú và kiểm tra cơ quan công an nơi tiếp nhận.",
    steps:
      "Bạn nên xác định đúng loại thủ tục trước, sau đó chuẩn bị giấy tờ theo trường hợp cấp mới, cấp đổi hoặc cấp lại rồi đến đúng nơi tiếp nhận.",
    authority:
      "CCCD/Căn cước thường do cơ quan công an có thẩm quyền tiếp nhận và xử lý theo nơi cư trú hoặc theo điểm tiếp nhận được bố trí.",
    tips: [
      "Nếu là cấp đổi, bạn nên mang theo giấy tờ hiện có để đối chiếu.",
      "Nên kiểm tra trước nơi tiếp nhận để tránh đi sai điểm làm thủ tục."
    ]
  }
};

function normalizeVietnameseChatText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bko\b|\bkhong\b/g, "không")
    .replace(/\bokela\b|\boki\b|\boke\b/g, "ok")
    .replace(/\bcccđ\b/g, "cccd")
    .trim();
}

function buildBulletList(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return items.map((item) => `- ${item}`).join("\n");
}

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

function detectFallbackTopic(text) {
  const t = normalizeVietnameseChatText(text);
  if (/khai sinh|hộ tịch|giấy khai sinh/.test(t)) return "birth";
  if (/tạm trú|đăng ký cư trú|lưu trú/.test(t)) return "residence";
  if (/gplx|lái xe|giấy phép lái/.test(t)) return "license";
  if (/hộ chiếu|passport|xuất nhập cảnh/.test(t)) return "passport";
  if (/căn cước|cccd|chứng minh thư/.test(t)) return "identity";
  if (/lệ phí|phí|bao nhiêu tiền/.test(t)) return "fees";
  if (/thời gian|giờ làm|mấy giờ/.test(t)) return "hours";
  return "";
}

function detectFollowUpIntent(text) {
  const t = normalizeVietnameseChatText(text);
  if (/hướng dẫn đúng hơn|nói rõ hơn|chi tiết hơn|cụ thể hơn|hướng dẫn tiếp|giải thích thêm/.test(t)) {
    return "detail";
  }
  if (/cần giấy tờ gì|hồ sơ gồm gì|chuẩn bị gì/.test(t)) {
    return "documents";
  }
  if (/thủ tục thế nào|các bước|quy trình/.test(t)) {
    return "steps";
  }
  if (/đăng ký lại|làm lại/.test(t)) {
    return "reissue";
  }
  if (/đúng hạn/.test(t)) {
    return "ontime";
  }
  if (/nộp online|trực tuyến|online/.test(t)) {
    return "online";
  }
  if (/nộp trực tiếp|đến trực tiếp|trực tiếp/.test(t)) {
    return "offline";
  }
  if (/ở đâu|nơi nào|cơ quan nào|ubnd nào|nộp ở đâu/.test(t)) {
    return "authority";
  }
  if (/lưu ý|cần chú ý|cần lưu ý|mẹo/.test(t)) {
    return "tips";
  }
  if (/bao lâu|mất bao lâu|thời hạn|mấy ngày/.test(t)) {
    return "timeline";
  }
  if (/đúng rồi|đúng vậy|phải|vâng|ừ|ok|oke/.test(t)) {
    return "confirm_yes";
  }
  if (/không phải|không|chưa|sai rồi/.test(t)) {
    return "confirm_no";
  }
  return "";
}

function isShortFollowUpAnswer(text) {
  const t = normalizeVietnameseChatText(text);
  if (!t) return false;
  if (t.length <= 30) return true;
  return /^(đúng hạn|đăng ký lại|nộp online|online|trực tiếp|cần giấy tờ gì|các bước|hướng dẫn tiếp)$/i.test(t);
}

function inferTopicFromAssistantPrompt(text) {
  const t = normalizeVietnameseChatText(text);
  if (/khai sinh|giấy khai sinh/.test(t)) return "birth";
  if (/tạm trú|cư trú/.test(t)) return "residence";
  if (/gplx|giấy phép lái|lái xe/.test(t)) return "license";
  if (/hộ chiếu|passport/.test(t)) return "passport";
  if (/cccd|căn cước|chứng minh thư/.test(t)) return "identity";
  return "";
}

function inferPendingQuestion(text) {
  const t = normalizeVietnameseChatText(text);
  if (/đúng hạn|đăng ký lại/.test(t)) return "birth_branch";
  if (/cấp mới|cấp lại|cấp đổi/.test(t)) return "variant_branch";
  if (/hồ sơ|giấy tờ|chuẩn bị/.test(t)) return "documents";
  if (/các bước|quy trình|thủ tục/.test(t)) return "steps";
  if (/online|trực tuyến|trực tiếp/.test(t)) return "channel_branch";
  if (/ở đâu|cơ quan nào|ubnd/.test(t)) return "authority";
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

function findLastAssistantMessage(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === "assistant" && typeof list[i]?.content === "string") {
      return list[i].content;
    }
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

  return {
    topic,
    followUpIntent,
    pendingQuestion,
    lastAssistantMessage
  };
}

function replyForTopic(topic, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return "";
  if (intent === "detail") return kb.steps || kb.documents || kb.ask || "";
  if (intent === "tips") {
    return kb.tips?.length
      ? `Một số lưu ý khi làm ${kb.label}:\n${buildBulletList(kb.tips)}`
      : kb.documents || kb.ask || "";
  }
  if (intent === "fees") {
    return kb.fees || `Lệ phí của ${kb.label} có thể thay đổi theo địa phương và loại hồ sơ. Bạn nên kiểm tra biểu phí tại nơi tiếp nhận hoặc trên cổng dịch vụ công để biết chính xác.`;
  }
  if (intent === "timeline") {
    return `Thời hạn xử lý của ${kb.label} có thể khác theo từng địa phương và từng trường hợp hồ sơ. Bạn nên kiểm tra thông báo tại nơi tiếp nhận hoặc trên cổng dịch vụ công sau khi nộp hồ sơ để biết mốc thời gian chính xác.`;
  }
  return kb[intent] || kb.ask || "";
}

function composeSmartReply(topic, primaryAnswer, intent) {
  const kb = TOPIC_KB[topic];
  if (!kb) return primaryAnswer;

  const nextStepByIntent = {
    documents: "Nếu bạn muốn, tôi có thể nói tiếp phần các bước nộp hồ sơ hoặc nơi tiếp nhận.",
    steps: "Nếu bạn muốn, tôi có thể nói tiếp phần giấy tờ cần chuẩn bị hoặc cách nộp online.",
    ontime: "Nếu bạn muốn, tôi có thể tách tiếp phần hồ sơ cần chuẩn bị hoặc nơi nộp cụ thể.",
    reissue: "Nếu bạn muốn, tôi có thể nói tiếp phần giấy tờ cần đối chiếu hoặc nơi tiếp nhận.",
    online: "Nếu bạn muốn, tôi có thể nói tiếp phần giấy tờ cần scan hoặc các lỗi thường gặp khi nộp online.",
    offline: "Nếu bạn muốn, tôi có thể nói tiếp phần hồ sơ cần mang theo hoặc thời gian xử lý thường gặp.",
    authority: "Nếu bạn muốn, tôi có thể nói tiếp phần hồ sơ hoặc các bước nộp.",
    timeline: "Nếu bạn muốn, tôi có thể nói tiếp phần hồ sơ hoặc nơi tiếp nhận."
  };

  const nextStep = nextStepByIntent[intent] || "Nếu bạn muốn, tôi có thể nói tiếp phần hồ sơ, các bước, nơi nộp hoặc lưu ý quan trọng.";
  return `${primaryAnswer}\n\n${nextStep}`;
}

function buildAiSuggestions(topic, intent = "") {
  const suggestionMap = {
    birth: [
      "Cần giấy tờ gì?",
      "Nộp online thế nào?",
      "Nộp ở đâu?",
      "Có lưu ý gì quan trọng?"
    ],
    residence: [
      "Hồ sơ cần chuẩn bị gì?",
      "Các bước nộp tạm trú là gì?",
      "Nộp online được không?",
      "Thời gian xử lý bao lâu?"
    ],
    license: [
      "Đổi GPLX cần giấy tờ gì?",
      "Nộp online ra sao?",
      "Thời gian xử lý bao lâu?",
      "Có lưu ý gì?"
    ],
    passport: [
      "Cấp hộ chiếu cần giấy tờ gì?",
      "Nộp ở đâu?",
      "Các bước thực hiện thế nào?",
      "Có lưu ý gì?"
    ],
    identity: [
      "Làm CCCD cần giấy tờ gì?",
      "Nộp ở đâu?",
      "Thời gian xử lý bao lâu?",
      "Có lưu ý gì?"
    ]
  };

  const generic = [
    "Cần giấy tờ gì?",
    "Các bước thực hiện thế nào?",
    "Nộp ở đâu?",
    "Có lưu ý gì quan trọng?"
  ];

  const suggestions = suggestionMap[topic] || generic;
  if (!intent) return suggestions.slice(0, 4);

  return suggestions
    .filter((item) => {
      const normalized = normalizeVietnameseChatText(item);
      if (intent === "documents") return !normalized.includes("giấy tờ");
      if (intent === "steps") return !normalized.includes("bước");
      if (intent === "authority") return !normalized.includes("ở đâu");
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
    .filter((message) => message?.role === "user" && typeof message?.content === "string")
    .slice(-3)
    .map((message) => `- ${message.content}`)
    .join("\n");

  return [
    state.topic ? `Chủ đề hiện tại suy ra: ${state.topic}` : "Chưa suy ra rõ chủ đề hiện tại",
    state.followUpIntent ? `Ý định gần nhất của người dùng: ${state.followUpIntent}` : "Ý định gần nhất chưa rõ",
    state.pendingQuestion ? `Câu hỏi nhánh gần nhất của trợ lý: ${state.pendingQuestion}` : "Không có câu hỏi nhánh đang chờ",
    state.lastAssistantMessage ? `Tin nhắn gần nhất của trợ lý: ${state.lastAssistantMessage}` : "Chưa có tin nhắn trợ lý gần trước đó",
    recentUserMessages ? `Ba tin nhắn người dùng gần nhất:\n${recentUserMessages}` : "Chưa có đủ lịch sử người dùng"
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
    return "Xin chào! Tôi là trợ lý AI hỗ trợ thủ tục hành chính trên Cổng dịch vụ công. Bạn cần tra cứu thủ tục, biểu mẫu hay hướng dẫn nộp hồ sơ?";
  }
  if (/căn cước|cccd|chứng minh thư/.test(t)) {
    return "Với thủ tục liên quan CCCD/Căn cước, bạn nên chuẩn bị giấy tờ tùy thân hiện có, thông tin cư trú và kiểm tra cơ quan công an nơi tiếp nhận. Nếu bạn nói rõ là cấp mới, cấp đổi hay cấp lại, tôi sẽ hướng dẫn sát hơn.";
  }
  if (/khai sinh|hộ tịch|giấy khai sinh/.test(t)) {
    return "Đăng ký khai sinh thường cần thông tin cha mẹ, giấy chứng sinh hoặc giấy tờ thay thế, cùng giấy tờ tùy thân của người đi đăng ký. Bạn cho tôi biết là đăng ký đúng hạn hay đăng ký lại để tôi hướng dẫn đúng hơn.";
  }
  if (/tạm trú|đăng ký cư trú/.test(t)) {
    return "Về tạm trú: thường cần CMND/CCCD, giấy tờ chỗ ở, phiếu báo tạm vắng (nếu có). Bạn nên chọn đúng cấp tiếp nhận (xã/phường) trên cổng và điền form trực tuyến.";
  if (/gplx|lái xe|giấy phép lái/.test(t))
    return "Đổi GPLX: chuẩn bị ảnh, giấy khám sức khỏe, GPLX cũ và làm theo hướng dẫn trên CSDL giao thông / cổng dịch vụ công — có thể nộp trực tuyến tùy địa phương.";
  if (/hộ chiếu|passport/.test(t))
    return "Cấp/đổi hộ chiếu: kiểm tra ảnh, CMND/CCCD, lịch hẹn (nếu có). Nhiều bước đã được điện tử hóa — xem mục Hộ chiếu trên cổng.";
  }
  if (/thời gian|giờ làm|mấy giờ/.test(t)) {
    return "Thông thường bộ phận một cửa làm việc giờ hành chính (sáng 7h30–11h30, chiều 13h30–17h00), có thể khác theo địa phương.";
  }
  if (/lệ phí|phí|bao nhiêu tiền/.test(t)) {
    return "Lệ phí phụ thuộc từng thủ tục và từng địa phương. Bạn hãy cho tôi biết tên thủ tục và nơi nộp hồ sơ để tôi hướng dẫn cách kiểm tra chính xác hơn trên cổng hoặc tại cơ quan tiếp nhận.";
  }
  if (topic) {
    const topicReply = replyForTopic(topic, "");
    if (topicReply) return composeSmartReply(topic, topicReply, "");
  }

  return "Cảm ơn bạn đã liên hệ. Hãy mô tả ngắn thủ tục (ví dụ: tạm trú, GPLX, hộ tịch) hoặc dùng ô tìm kiếm ở trên để tra cứu. Nếu cần trao đổi với cán bộ, hãy chọn tab “Chat cán bộ”.";
}

function buildKnowledgeSnippets(userText) {
  const t = String(userText || "").toLowerCase();
  const snippets = [];

  if (/tạm trú|đăng ký cư trú|lưu trú/.test(t)) {
    snippets.push(
      "Chủ đề cư trú/tạm trú: ưu tiên hướng dẫn theo nhóm thông tin gồm giấy tờ tùy thân, giấy tờ chỗ ở hợp pháp, bước kê khai trực tuyến và lưu ý xác nhận tại công an/cơ quan cư trú địa phương."
    );
  }
  if (/gplx|giấy phép lái|lái xe/.test(t)) {
    snippets.push(
      "Chủ đề GPLX: nêu rõ khác biệt giữa cấp đổi, cấp lại, đổi do sắp hết hạn; nhắc kiểm tra ảnh chân dung, giấy khám sức khỏe và kênh nộp hồ sơ trực tuyến của địa phương."
    );
  }
  if (/hộ chiếu|passport|xuất nhập cảnh/.test(t)) {
    snippets.push(
      "Chủ đề hộ chiếu: gợi ý người dùng chuẩn bị ảnh đúng chuẩn, CCCD/căn cước, thông tin nhân thân và kiểm tra nơi tiếp nhận hồ sơ thuộc cơ quan quản lý xuất nhập cảnh."
    );
  }
  if (/khai sinh|hộ tịch|kết hôn|khai tử/.test(t)) {
    snippets.push(
      "Chủ đề hộ tịch: trả lời theo cấu trúc giấy tờ cần có, đối tượng đi nộp, nơi đăng ký, thời hạn xử lý và trường hợp phải đối chiếu bản gốc."
    );
  }
  if (/đất đai|sổ đỏ|quyền sử dụng đất/.test(t)) {
    snippets.push(
      "Chủ đề đất đai: nhấn mạnh hồ sơ thường nhiều biến thể theo loại thủ tục, cần hỏi thêm địa phương và loại biến động trước khi kết luận."
    );
  }

  return snippets;
}

function buildSystemPrompt(rulesText, conversationSummary, snippets = []) {
  const knowledgeBlock = snippets.length
    ? `\nNgữ cảnh chủ đề liên quan:\n- ${snippets.join("\n- ")}`
    : "";

  return `Bạn là GOV Assistant, trợ lý AI của Cổng Dịch vụ công Việt Nam.

Mục tiêu:
- Hỗ trợ người dân tra cứu thủ tục hành chính, giấy tờ, quy trình và lưu ý thực hiện.
- Trả lời giống trợ lý chat hiện đại: thân thiện, mạch lạc, gọn, có định hướng bước tiếp theo.
- Tuyệt đối không bịa thông tin pháp lý hoặc cam kết kết quả xử lý hồ sơ.

Quy tắc trả lời hiện hành do admin cấu hình:
${rulesText}${knowledgeBlock}

Tóm tắt hội thoại hiện có:
${conversationSummary}

Cách trả lời:
- Luôn trả lời bằng tiếng Việt.
- Ưu tiên cấu trúc ngắn: trả lời trực tiếp, rồi liệt kê 2-5 ý quan trọng nếu cần.
- Nếu câu hỏi chưa đủ dữ kiện, hỏi lại tối đa 1-2 ý quan trọng nhất.
- Nếu người dùng đang trả lời cho câu hỏi phân nhánh trước đó của trợ lý, hãy nối tiếp đúng nhánh thay vì hỏi lại từ đầu.
- Nếu có rủi ro sai khác theo địa phương/quy định mới, nói rõ đây là thông tin tham khảo và khuyên xác nhận tại cơ quan có thẩm quyền.
- Không dùng emoji nếu không thật sự cần.
- Nếu ngoài phạm vi thủ tục hành chính, lịch sự từ chối và hướng sang kênh hỗ trợ phù hợp.`;
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
        content: buildSystemPrompt(rulesText, conversationSummary, snippets)
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
    const sessionId = String(req.body?.sessionId || "").trim() || `guest-${Date.now()}`;

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
      turnIndex: msgs.filter((message) => message.role === "user").length,
      confidenceLabel: mode === "openai" ? "assisted" : "fallback",
      note: mode === "fallback" ? "Tra loi bang bo quy tac noi bo/fallback" : "Tra loi bang mo hinh AI",
      meta: {
        turns: msgs.length,
        detectedTopic,
        suggestions,
        hasAuthenticatedUser: Boolean(req.user?.id),
        ip:
          req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "",
        userAgent: req.headers["user-agent"] || ""
      }
    }).catch((error) => {
      console.error("appendAiHistory error:", error.message);
    });

    res.json({
      reply,
      mode,
      sessionId,
      detectedTopic,
      suggestions
    });
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

exports.friendDiscovery = async (req, res) => {
  try {
    const q = req.query?.q || "";
    const users = await userStore.searchUsersForFriendAdd(req.user.id, q);
    return res.json({ users });
  } catch (err) {
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
      userStore.listOutgoingFriendRequests(req.user.id)
    ]);
    return res.json({
      requests: incoming,
      incoming,
      outgoing,
      counts: {
        incoming: incoming.length,
        outgoing: outgoing.length
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải lời mời kết bạn" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const targetUserId = String(req.body?.targetUserId || "").trim();
    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu người dùng cần kết bạn" });
    }
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
    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu người dùng cần thu hồi lời mời" });
    }
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
    return res.status(500).json({ message: err.message || "Không thể tải danh sách đã chặn" });
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

exports.groupInvites = async (req, res) => {
  try {
    const rooms = await multiChatStore.listGroupInvitesForUser(req.user.id);
    const invites = await Promise.all(rooms.map((room) => multiChatStore.hydrateRoomForUser(room, req.user.id)));
    return res.json({ invites });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi tải lời mời nhóm" });
  }
};

exports.inviteGroupMembers = async (req, res) => {
  try {
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const room = await multiChatStore.inviteMembersToGroup({
      roomId: req.params.roomId,
      requesterId: req.user.id,
      memberIds
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
      action
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

    // ✅ Emit đúng event name + đúng room
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
        "Chưa cấu hình S3. Đặt S3_BUCKET (hoặc AWS_S3_BUCKET), AWS_REGION và AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env."
    });
  }
  try {
    const contentType = String(req.body?.contentType || "")
      .trim()
      .toLowerCase();
    let fileName = String(req.body?.fileName || "file").trim();
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(contentType);
    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video hoặc tài liệu (.pdf/.doc/.docx)"
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
    const isImageOrVideo = contentType.startsWith("image/") || contentType.startsWith("video/");
    const isDocument = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(contentType);
    if (!contentType || (!isImageOrVideo && !isDocument)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh, video hoặc tài liệu (.pdf/.doc/.docx)"
      });
    }

    const fileName = file.originalname || "file";
    const ext = path.extname(fileName).toLowerCase();
    let safeName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100);
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