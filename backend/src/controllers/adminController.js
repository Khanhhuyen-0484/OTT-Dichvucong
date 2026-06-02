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
const { getAdminStatistics } = require("../store/statisticsStore");
const { updateApplicationStatus } = require("./serviceController");
const { sendMessage } = require("../store/supportConversationsStore");
const { findById, listUsers, updateUserRole } = require("../store/userStore");
const { findByCode, updateByCode } = require("../store/serviceApplicationStore");
const { createNotification } = require("../store/notificationStore");
const { uploadBuffer, createPresignedGet } = require("../config/s3");
const { sendMail } = require("../config/mailer");
const { getIo } = require("../socket");

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
    const actionMap = { receive: "PENDING", processing: "PROCESSING", request_more: "NEED_MORE", approve: "APPROVED", reject: "REJECTED", complete: "COMPLETED" };
    if (!Object.prototype.hasOwnProperty.call(actionMap, action)) {
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
    return res.status(err.status || err.statusCode || 500).json({ message: err.message || "Lỗi xử lý quyết định hồ sơ" });
  }
};

exports.updateDossierStatus = async (req, res) => {
  try {
    return await updateApplicationStatus(req, res);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi cập nhật trạng thái hồ sơ" });
  }
};

function pushResultTimeline(dossier, item) {
  const current = Array.isArray(dossier?.timeline)
    ? dossier.timeline
    : Array.isArray(dossier?.history)
      ? dossier.history
      : [];
  return [...current, item];
}

function resultEmailHtml({ fullName, dossierId, serviceName, downloadUrl, note }) {
  const safeNote = String(note || "").trim();
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <p>Chào ${fullName || "Quý công dân"},</p>
      <p>Hồ sơ <strong>${dossierId}</strong> đã có kết quả.</p>
      <p><strong>Tên dịch vụ:</strong> ${serviceName || "Dịch vụ công"}</p>
      <p><strong>Trạng thái:</strong> Đã trả kết quả</p>
      <p><a href="${downloadUrl}" target="_blank" rel="noopener">Tải file PDF kết quả</a></p>
      ${safeNote ? `<p><strong>Ghi chú:</strong> ${safeNote}</p>` : ""}
    </div>
  `;
}

exports.deliverDossierResult = async (req, res) => {
  try {
    const dossierId = String(req.params.dossierId || req.params.id || "").trim();
    if (!dossierId) return res.status(400).json({ message: "Thiếu mã hồ sơ" });
    if (!req.file) return res.status(400).json({ message: "Vui lòng chọn file PDF kết quả" });
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Chỉ chấp nhận file PDF" });
    }
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "File PDF tối đa 10MB" });
    }

    const dossier = await findByCode(dossierId);
    if (!dossier) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    if (String(dossier.status || "").trim().toUpperCase() !== "APPROVED") {
      return res.status(400).json({ message: "Phải duyệt hồ sơ trước khi trả kết quả." });
    }

    const now = new Date().toISOString();
    const key = `results/${dossierId}/result-${Date.now()}.pdf`;
    const uploaded = await uploadBuffer({ key, buffer: req.file.buffer, contentType: "application/pdf" });

    let resultFileUrl = uploaded.publicUrl || uploaded.url || "";
    try {
      resultFileUrl = await createPresignedGet(key, 7 * 24 * 60 * 60);
    } catch (err) {
      console.warn("[deliverDossierResult] presign email URL failed:", err?.message || err);
    }

    const note = String(req.body?.note || "").trim();
    const actor = req.user?.id || req.user?.email || "admin";
    const timeline = pushResultTimeline(dossier, {
      status: "RESULT_DELIVERED",
      action: "deliver_result",
      note: note || "Đã trả kết quả hồ sơ",
      actor,
      createdAt: now
    });

    const updated = await updateByCode(dossier.dossierId || dossierId, {
      ...dossier,
      status: "RESULT_DELIVERED",
      resultFileUrl,
      resultFileKey: key,
      resultDeliveredAt: now,
      resultNote: note,
      timeline,
      history: timeline,
      updatedAt: now
    });

    let emailFailed = false;
    try {
      const fullName = updated.citizenName || updated.formData?.fullName || "Quý công dân";
      const to = updated.email || updated.formData?.email;
      if (to) {
        await sendMail({
          to,
          subject: `Kết quả xử lý hồ sơ ${updated.dossierId || dossierId}`,
          html: resultEmailHtml({ fullName, dossierId: updated.dossierId || dossierId, serviceName: updated.serviceName, downloadUrl: resultFileUrl, note }),
          text: [
            `Chào ${fullName}`,
            `Hồ sơ ${updated.dossierId || dossierId} đã có kết quả`,
            `Tên dịch vụ: ${updated.serviceName || "Dịch vụ công"}`,
            "Trạng thái: Đã trả kết quả",
            `Link tải file PDF: ${resultFileUrl}`,
            note ? `Ghi chú: ${note}` : ""
          ].filter(Boolean).join("\n")
        });
      }
    } catch (err) {
      emailFailed = true;
      console.warn("[deliverDossierResult] email failed:", err?.message || err);
    }

    let notification = null;
    try {
      if (updated.userId) {
        notification = await createNotification({
          notificationId: `NTF-${Date.now()}`,
          userId: updated.userId,
          dossierId: updated.dossierId || dossierId,
          title: "Hồ sơ đã có kết quả",
          message: "Bạn có thể tải kết quả hồ sơ.",
          type: "RESULT_DELIVERED",
          status: "RESULT_DELIVERED",
          actionUrl: `/my-applications/${updated.dossierId || dossierId}`,
          createdAt: now
        });
        const io = getIo();
        io?.to?.(`user_${updated.userId}`)?.emit?.("service-application-updated", {
          dossierId: updated.dossierId || dossierId,
          status: "RESULT_DELIVERED",
          timeline,
          resultFileUrl,
          resultFileKey: key,
          notification
        });
      }
    } catch (err) {
      console.warn("[deliverDossierResult] notification/socket failed:", err?.message || err);
    }

    return res.json({
      message: emailFailed ? "Đã trả kết quả hồ sơ, nhưng gửi email thất bại" : "Đã trả kết quả hồ sơ",
      dossier: updated,
      notification,
      emailFailed
    });
  } catch (err) {
    console.error("[deliverDossierResult] error:", err);
    return res.status(500).json({ message: err.message || "Lỗi trả kết quả hồ sơ" });
  }
};

exports.openDossierChat = async (req, res) => {
  try {
    const conversation = await getOrCreateConversationByDossier(req.params.id);
    const normalizedMessages = Array.isArray(conversation?.messages) ? conversation.messages : [];
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
    return res.json({
      conversation: {
        ...conversation,
        messages: normalizedMessages
      }
    });
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

    try {
      const io = getIo();
      const lastMessage = Array.isArray(conversation.messages)
        ? conversation.messages[conversation.messages.length - 1]
        : null;
      if (lastMessage) {
        io.to(`user_${req.params.id}`).emit("supportConversationMessage", {
          userId: req.params.id,
          message: lastMessage
        });
      }
    } catch (socketError) {
      console.warn("[Socket] Không thể gửi sự kiện supportConversationMessage:", socketError.message);
    }

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

exports.getStatistics = async (req, res) => {
  try {
    const stats = await getAdminStatistics({ fromDate: req.query.fromDate, toDate: req.query.toDate });
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy thống kê" });
  }
};

function toAdminUser(user) {
  return {
    id: user?.id || "",
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    role: user?.role || "citizen",
    avatarUrl: user?.avatarUrl || "",
    createdAt: user?.createdAt || "",
    updatedAt: user?.updatedAt || "",
    friendCount: Array.isArray(user?.friendIds) ? user.friendIds.length : 0,
    blockedCount: Array.isArray(user?.blockedUserIds) ? user.blockedUserIds.length : 0,
  };
}

exports.userList = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const role = String(req.query.role || "all").trim().toLowerCase();
    const users = await listUsers();
    const filtered = users
      .map(toAdminUser)
      .filter((item) => {
        const matchesRole = role === "all" || !role || String(item.role || "").toLowerCase() === role;
        const matchesQuery =
          !q ||
          [item.fullName, item.email, item.phone, item.id]
            .map((value) => String(value || "").toLowerCase())
            .some((value) => value.includes(q));
        return matchesRole && matchesQuery;
      })
      .sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")));

    return res.json({
      users: filtered,
      summary: {
        total: users.length,
        admins: users.filter((item) => String(item.role || "").toLowerCase() === "admin").length,
        citizens: users.filter((item) => String(item.role || "citizen").toLowerCase() !== "admin").length,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Lỗi lấy danh sách người dùng" });
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
