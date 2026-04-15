const fs = require("fs/promises");
const path = require("path");

const FILE = path.join(__dirname, "..", "..", "data", "admin_data.json");

function nowIso() {
  return new Date().toISOString();
}

function makeSeed() {
  return {
    dossiers: [
      {
        id: "HS-2026-001",
        procedureName: "Cấp đổi giấy phép lái xe",
        citizenName: "Nguyễn Văn A",
        phone: "0912345678",
        submittedAt: "2026-04-10T08:00:00.000Z",
        dueAt: "2026-04-15T08:00:00.000Z",
        status: "new",
        eform: {
          fullName: "Nguyễn Văn A",
          citizenId: "079123456789",
          email: "vana@example.com",
          address: "Quận 1, TP.HCM"
        },
        attachments: [
          {
            id: "att-1",
            name: "cccd-mat-truoc.jpg",
            type: "image",
            url: "https://picsum.photos/seed/cccd1/1200/800"
          },
          {
            id: "att-2",
            name: "bang-lai-cu.jpg",
            type: "image",
            url: "https://picsum.photos/seed/gplx1/1200/800"
          }
        ],
        timeline: [{ at: "2026-04-10T08:00:00.000Z", by: "system", action: "Tiep nhan ho so" }]
      },
      {
        id: "HS-2026-002",
        procedureName: "Đăng ký tạm trú",
        citizenName: "Trần Thị B",
        phone: "0987123456",
        submittedAt: "2026-04-09T09:30:00.000Z",
        dueAt: "2026-04-12T09:30:00.000Z",
        status: "overdue",
        eform: {
          fullName: "Trần Thị B",
          citizenId: "079222233334",
          email: "thib@example.com",
          address: "Thủ Đức, TP.HCM"
        },
        attachments: [
          {
            id: "att-3",
            name: "cccd.jpg",
            type: "image",
            url: "https://picsum.photos/seed/cccd2/1200/800"
          }
        ],
        timeline: [{ at: "2026-04-09T09:30:00.000Z", by: "system", action: "Tiep nhan ho so" }]
      },
      {
        id: "HS-2026-003",
        procedureName: "Cấp hộ chiếu phổ thông",
        citizenName: "Lê Văn C",
        phone: "0933123987",
        submittedAt: "2026-04-13T10:30:00.000Z",
        dueAt: "2026-04-20T10:30:00.000Z",
        status: "processing",
        eform: {
          fullName: "Lê Văn C",
          citizenId: "079111122223",
          email: "vanc@example.com",
          address: "Gò Vấp, TP.HCM"
        },
        attachments: [
          {
            id: "att-4",
            name: "chan-dung.jpg",
            type: "image",
            url: "https://picsum.photos/seed/passport1/1200/800"
          }
        ],
        timeline: [{ at: "2026-04-13T10:30:00.000Z", by: "system", action: "Tiep nhan ho so" }]
      }
    ],
    supportConversations: [
      {
        id: "sup-1",
        dossierId: "HS-2026-001",
        citizenName: "Nguyễn Văn A",
        status: "waiting",
        messages: [
          { id: "msg-1", from: "citizen", text: "Em đã nộp hồ sơ rồi ạ.", at: "2026-04-10T08:20:00.000Z" }
        ]
      },
      {
        id: "sup-2",
        dossierId: "HS-2026-002",
        citizenName: "Trần Thị B",
        status: "resolved",
        messages: [
          { id: "msg-2", from: "citizen", text: "Nhờ kiểm tra hồ sơ giúp tôi.", at: "2026-04-11T09:20:00.000Z" },
          { id: "msg-3", from: "admin", text: "Hồ sơ đã đủ, vui lòng chờ xử lý.", at: "2026-04-11T09:25:00.000Z" }
        ]
      }
    ],
    ai: {
      rulesText:
        "1) Trả lời ngắn gọn, bám đúng quy định hiện hành.\n2) Nếu thiếu thông tin, yêu cầu bổ sung rõ ràng.\n3) Không suy diễn khi chưa có căn cứ pháp lý.",
      history: [
        {
          id: "ai-1",
          question: "Lệ phí đổi GPLX là bao nhiêu?",
          answer: "Mức lệ phí hiện hành là 135.000đ/hồ sơ.",
          at: "2026-04-13T09:10:00.000Z"
        },
        {
          id: "ai-2",
          question: "Đăng ký tạm trú cần giấy tờ gì?",
          answer: "CCCD, biểu mẫu cư trú và giấy tờ chỗ ở hợp pháp.",
          at: "2026-04-13T10:15:00.000Z"
        }
      ]
    }
  };
}

async function load() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  const seed = makeSeed();
  await save(seed);
  return seed;
}

async function save(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

function normalizeDossierStatus(status) {
  const allowed = new Set(["new", "overdue", "processing", "completed", "need_more", "rejected"]);
  return allowed.has(status) ? status : "new";
}

async function getDashboardStats() {
  const data = await load();
  const totalNew = data.dossiers.filter((x) => x.status === "new").length;
  const totalOverdue = data.dossiers.filter((x) => x.status === "overdue").length;
  const waitingMessages = data.supportConversations.filter((x) => x.status === "waiting").length;
  return { totalNew, totalOverdue, waitingMessages };
}

async function listDossiers(query = "") {
  const data = await load();
  const q = String(query || "").trim().toLowerCase();
  if (!q) return data.dossiers;
  return data.dossiers.filter(
    (d) => d.id.toLowerCase().includes(q) || String(d.phone || "").toLowerCase().includes(q)
  );
}

async function getDossierById(id) {
  const data = await load();
  return data.dossiers.find((d) => d.id === id) || null;
}

async function decideDossier({ dossierId, action, note, adminEmail }) {
  const data = await load();
  const index = data.dossiers.findIndex((d) => d.id === dossierId);
  if (index < 0) return null;

  let nextStatus = data.dossiers[index].status;
  if (action === "approve") {
    nextStatus = data.dossiers[index].status === "processing" ? "completed" : "processing";
  } else if (action === "request_more") {
    nextStatus = "need_more";
  } else if (action === "reject") {
    nextStatus = "rejected";
  }
  data.dossiers[index].status = normalizeDossierStatus(nextStatus);
  data.dossiers[index].timeline = Array.isArray(data.dossiers[index].timeline)
    ? data.dossiers[index].timeline
    : [];
  data.dossiers[index].timeline.push({
    at: nowIso(),
    by: adminEmail || "admin",
    action,
    note: String(note || "")
  });

  await save(data);
  return data.dossiers[index];
}

async function getOrCreateConversationByDossier(dossierId) {
  const data = await load();
  let conv = data.supportConversations.find((x) => x.dossierId === dossierId);
  if (!conv) {
    const dossier = data.dossiers.find((d) => d.id === dossierId);
    conv = {
      id: `sup-${Date.now()}`,
      dossierId,
      citizenName: dossier?.citizenName || "Người dân",
      status: "waiting",
      messages: []
    };
    data.supportConversations.unshift(conv);
    await save(data);
  }
  return conv;
}

async function upsertConversationFromCitizen({ citizenUserId, citizenName, text }) {
  const data = await load();
  const uid = String(citizenUserId || "").trim();
  if (!uid) return null;

  let conv = data.supportConversations.find((x) => String(x.citizenUserId || "") === uid);
  if (!conv) {
    conv = {
      id: `sup-${Date.now()}`,
      dossierId: `CHAT-${uid}`,
      citizenUserId: uid,
      citizenName: citizenName || "Người dân",
      status: "waiting",
      messages: []
    };
    data.supportConversations.unshift(conv);
  }

  conv.messages = Array.isArray(conv.messages) ? conv.messages : [];
  conv.messages.push({
    id: `msg-${Date.now()}`,
    from: "citizen",
    text: String(text || "").slice(0, 2000),
    at: nowIso()
  });
  conv.status = "waiting";

  await save(data);
  return conv;
}

async function listConversations() {
  const data = await load();
  return data.supportConversations.map((conv) => ({
    ...conv,
    latestMessage: conv.messages?.[conv.messages.length - 1] || null,
    unreadCount: conv.status === "waiting" ? 1 : 0
  }));
}

async function getConversationById(id) {
  const data = await load();
  return data.supportConversations.find((x) => x.id === id) || null;
}

async function addConversationMessage({ conversationId, from, text }) {
  const data = await load();
  const index = data.supportConversations.findIndex((x) => x.id === conversationId);
  if (index < 0) return null;
  data.supportConversations[index].messages = Array.isArray(data.supportConversations[index].messages)
    ? data.supportConversations[index].messages
    : [];
  data.supportConversations[index].messages.push({
    id: `msg-${Date.now()}`,
    from,
    text: String(text).slice(0, 2000),
    at: nowIso()
  });
  if (from === "citizen") {
    data.supportConversations[index].status = "waiting";
  }
  await save(data);
  return data.supportConversations[index];
}

async function resolveConversation(conversationId) {
  const data = await load();
  const index = data.supportConversations.findIndex((x) => x.id === conversationId);
  if (index < 0) return null;
  data.supportConversations[index].status = "resolved";
  await save(data);
  return data.supportConversations[index];
}

async function getAiHistory() {
  const data = await load();
  return Array.isArray(data.ai?.history) ? data.ai.history : [];
}

async function getAiRules() {
  const data = await load();
  return String(data.ai?.rulesText || "");
}

async function updateAiRules(rulesText, adminEmail) {
  const data = await load();
  data.ai = data.ai || {};
  data.ai.rulesText = String(rulesText || "");
  data.ai.history = Array.isArray(data.ai.history) ? data.ai.history : [];
  data.ai.history.unshift({
    id: `ai-${Date.now()}`,
    question: "Cập nhật bộ quy tắc trả lời",
    answer: `Admin ${adminEmail || "unknown"} đã cập nhật rules`,
    at: nowIso()
  });
  await save(data);
  return data.ai.rulesText;
}

module.exports = {
  getDashboardStats,
  listDossiers,
  getDossierById,
  decideDossier,
  getOrCreateConversationByDossier,
  upsertConversationFromCitizen,
  listConversations,
  getConversationById,
  addConversationMessage,
  resolveConversation,
  getAiHistory,
  getAiRules,
  updateAiRules
};
