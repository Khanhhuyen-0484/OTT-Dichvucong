const {
  getDashboardStats,
  listDossiers,
  getDossierById,
  decideDossier,
  getOrCreateConversationByDossier,
  listConversations,
  getConversationById,
  resolveConversation,
  getAiHistory,
  getAiRules,
  updateAiRules
} = require("../store/adminStore");
const { sendMessage } = require("../store/supportConversationsStore");
const { findById, updateUserRole } = require("../store/userStore");

exports.dashboard = async (req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy dashboard" });
  }
};

exports.dossierList = async (req, res) => {
  try {
    const q = req.query.q || "";
    const dossiers = await listDossiers(q);
    return res.json({ dossiers });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy danh sách hồ sơ" });
  }
};

exports.dossierDetail = async (req, res) => {
  try {
    const dossier = await getDossierById(req.params.id);
    if (!dossier) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    return res.json({ dossier });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy chi tiết hồ sơ" });
  }
};

exports.dossierDecision = async (req, res) => {
  try {
    const action = String(req.body?.action || "");
    const note = String(req.body?.note || "").trim();
    if (!["approve", "request_more", "reject"].includes(action)) {
      return res.status(400).json({ message: "Hành động không hợp lệ" });
    }
    if ((action === "request_more" || action === "reject") && note.length < 5) {
      return res.status(400).json({ message: "Vui lòng nhập nội dung tối thiểu 5 ký tự" });
    }

    const dossier = await decideDossier({
      dossierId: req.params.id,
      action,
      note,
      adminEmail: req.user?.email
    });
    if (!dossier) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    return res.json({ message: "Đã cập nhật quyết định", dossier });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi xử lý quyết định hồ sơ" });
  }
};

exports.openDossierChat = async (req, res) => {
  try {
    const conversation = await getOrCreateConversationByDossier(req.params.id);
    return res.json({
      conversation: {
        ...conversation,
        messages: normalizedMessages
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi mở hội thoại hồ sơ" });
  }
};

exports.supportConversations = async (req, res) => {
  try {
    const conversations = await listConversations();
    return res.json({ conversations });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy danh sách hội thoại" });
  }
};

exports.supportConversationDetail = async (req, res) => {
  try {
    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy hội thoại" });
    const normalizedMessages = Array.isArray(conversation.messages)
      ? conversation.messages.map((msg) => {
          const fullName =
            msg?.sender?.fullName ||
            (msg?.from === "admin" || msg?.from === "staff"
              ? "Admin hỗ trợ"
              : conversation.citizenName || "Người dùng");
          return {
            id: msg?.id || `msg-${Date.now()}`,
            from:
              msg?.from === "admin" || msg?.from === "staff" ? "admin" : "user",
            text: String(msg?.text || ""),
            createdAt: msg?.createdAt || msg?.at || new Date().toISOString(),
            sender: {
              id: msg?.sender?.id || "",
              fullName,
              avatarUrl:
                msg?.sender?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`
            }
          };
        })
      : [];
    return res.json({ conversation });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy chi tiết hội thoại" });
  }
};

exports.supportSendMessage = async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "Nội dung không được để trống" });

    const adminUser = await findById(req.user.id);
    const fullName = adminUser?.fullName || "Admin hỗ trợ";
    const avatarUrl = adminUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
    const sender = {
      id: req.user.id,
      fullName,
      avatarUrl
    };

    await sendMessage({
      userId: req.params.id,
      from: "admin",
      text,
      sender
    });
    const conversation = await getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy hội thoại" });
    return res.json({ message: "Đã gửi tin nhắn", conversation });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi gửi tin nhắn hỗ trợ" });
  }
};

exports.supportResolve = async (req, res) => {
  try {
    const conversation = await resolveConversation(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy hội thoại" });
    return res.json({ message: "Đã đánh dấu đã giải quyết", conversation });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi cập nhật trạng thái hội thoại" });
  }
};

exports.aiHistory = async (req, res) => {
  try {
    const history = await getAiHistory();
    return res.json({ history });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy lịch sử AI" });
  }
};

exports.aiRulesGet = async (req, res) => {
  try {
    const rulesText = await getAiRules();
    return res.json({ rulesText });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy bộ quy tắc AI" });
  }
};

exports.aiRulesUpdate = async (req, res) => {
  try {
    const rulesText = String(req.body?.rulesText || "").trim();
    if (rulesText.length < 10) {
      return res.status(400).json({ message: "Bộ quy tắc cần tối thiểu 10 ký tự" });
    }
    const saved = await updateAiRules(rulesText, req.user?.email);
    return res.json({ message: "Cập nhật bộ quy tắc thành công", rulesText: saved });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi cập nhật bộ quy tắc AI" });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const userId = req.params.userId;
    const role = String(req.body?.role || "").trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }

    if (!["citizen", "admin"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ. Phải là 'citizen' hoặc 'admin'" });
    }

    const user = await findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const updatedUser = await updateUserRole(userId, role);
    return res.json({ message: `Cập nhật vai trò người dùng thành công`, user: updatedUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi cập nhật vai trò người dùng" });
  }
};
