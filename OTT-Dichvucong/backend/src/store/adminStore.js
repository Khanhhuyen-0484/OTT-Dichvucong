const {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");
const { sendMessage, getChatHistory } = require("./supportConversationsStore");
const { findById } = require("./userStore");

const DOSSIERS_TABLE = process.env.DYNAMODB_DOSSIERS_TABLE || "Dossiers";
const SUPPORT_CONVERSATIONS_TABLE =
  process.env.SUPPORT_CONVERSATIONS_TABLE ||
  process.env.DYNAMODB_SUPPORT_CONVERSATIONS_TABLE ||
  "SupportConversations";
const ADMIN_AI_TABLE = process.env.DYNAMODB_ADMIN_AI_TABLE || "AdminAi";

function nowIso() {
  return new Date().toISOString();
}

function normalizeDossierStatus(status) {
  const allowed = new Set(["new", "overdue", "processing", "completed", "need_more", "rejected"]);
  return allowed.has(status) ? status : "new";
}

async function getDashboardStats() {
  try {
    const [dossiersRs, conversationsRs] = await Promise.all([
      dynamo.send(new ScanCommand({ TableName: DOSSIERS_TABLE })),
      dynamo.send(new ScanCommand({ TableName: SUPPORT_CONVERSATIONS_TABLE }))
    ]);
    const dossiers = dossiersRs.Items || [];
    const conversations = conversationsRs.Items || [];
    const totalNew = dossiers.filter((x) => x.status === "new").length;
    const totalOverdue = dossiers.filter((x) => x.status === "overdue").length;
    const waitingMessages = conversations.filter(
      (x) => x.status === "active" || x.status === "waiting"
    ).length;
    return { totalNew, totalOverdue, waitingMessages };
  } catch (error) {
    console.error("[adminStore.getDashboardStats] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function listDossiers(query = "") {
  const result = await dynamo.send(new ScanCommand({ TableName: DOSSIERS_TABLE }));
  const dossiers = result.Items || [];
  const q = String(query || "").trim().toLowerCase();
  if (!q) return dossiers;
  return dossiers.filter(
    (d) => d.id.toLowerCase().includes(q) || String(d.phone || "").toLowerCase().includes(q)
  );
}

async function getDossierById(id) {
  const result = await dynamo.send(
    new GetCommand({
      TableName: DOSSIERS_TABLE,
      Key: { id }
    })
  );
  return result.Item || null;
}

async function decideDossier({ dossierId, action, note, adminEmail }) {
  const current = await getDossierById(dossierId);
  if (!current) return null;
  let nextStatus = current.status;
  if (action === "approve") {
    nextStatus = current.status === "processing" ? "completed" : "processing";
  } else if (action === "request_more") {
    nextStatus = "need_more";
  } else if (action === "reject") {
    nextStatus = "rejected";
  }

  const timelineItem = {
    at: nowIso(),
    by: adminEmail || "admin",
    action,
    note: String(note || "")
  };
  const result = await dynamo.send(
    new UpdateCommand({
      TableName: DOSSIERS_TABLE,
      Key: { id: dossierId },
      UpdateExpression:
        "SET #status = :status, timeline = list_append(if_not_exists(timeline, :empty_list), :new_timeline), updatedAt = :updated_at",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": normalizeDossierStatus(nextStatus),
        ":empty_list": [],
        ":new_timeline": [timelineItem],
        ":updated_at": timelineItem.at
      },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW"
    })
  );
  return result.Attributes || null;
}

async function getOrCreateConversationByDossier(dossierId) {
  try {
    const found = await dynamo.send(
      new ScanCommand({
        TableName: SUPPORT_CONVERSATIONS_TABLE,
        FilterExpression: "dossierId = :dossierId",
        ExpressionAttributeValues: {
          ":dossierId": dossierId
        },
        Limit: 1
      })
    );
    let conv = found.Items?.[0] || null;
    if (!conv) {
      const dossier = await getDossierById(dossierId);
      conv = {
        id: `sup-${Date.now()}`,
        dossierId,
        citizenName: dossier?.citizenName || "Người dân",
        status: "active",
        messages: [],
        lastMessage: null,
        updatedAt: nowIso()
      };
      await dynamo.send(
        new PutCommand({
          TableName: SUPPORT_CONVERSATIONS_TABLE,
          Item: conv
        })
      );
    }
    return conv;
  } catch (error) {
    console.error("[adminStore.getOrCreateConversationByDossier] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function upsertConversationFromCitizen({ citizenUserId, citizenName, text }) {
  try {
    const uid = String(citizenUserId || "").trim();
    if (!uid) return null;

    await sendMessage({
      userId: uid,
      from: "citizen",
      text
    });

    await dynamo.send(
      new UpdateCommand({
        TableName: SUPPORT_CONVERSATIONS_TABLE,
        Key: { id: uid },
        UpdateExpression:
          "SET citizenUserId = if_not_exists(citizenUserId, :citizen_user_id), dossierId = if_not_exists(dossierId, :dossier_id), citizenName = if_not_exists(citizenName, :citizen_name), updatedAt = :updated_at",
        ExpressionAttributeValues: {
          ":citizen_user_id": uid,
          ":dossier_id": `CHAT-${uid}`,
          ":citizen_name": citizenName || "Người dân",
          ":updated_at": nowIso()
        },
        ReturnValues: "ALL_NEW"
      })
    );
    return getChatHistory(uid);
  } catch (error) {
    console.error("[adminStore.upsertConversationFromCitizen] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

// ── FIX: join với Users table để lấy fullName + avatarUrl thật ──
async function listConversations() {
  try {
    const result = await dynamo.send(new ScanCommand({ TableName: SUPPORT_CONVERSATIONS_TABLE }));
    const conversations = result.Items || [];

    // Gom tất cả citizenUserId duy nhất cần lookup
    const userIds = [...new Set(
      conversations
        .map((c) => c.citizenUserId || c.id)
        .filter(Boolean)
    )];

    // Fetch song song tất cả user records
    const userRecords = await Promise.all(
      userIds.map((uid) => findById(uid).catch(() => null))
    );

    // Map userId -> user record
    const userMap = {};
    userIds.forEach((uid, i) => {
      if (userRecords[i]) userMap[uid] = userRecords[i];
    });

    return conversations.map((conv) => {
      const uid = conv.citizenUserId || conv.id;
      const userRecord = userMap[uid] || null;

      // Ưu tiên: tên thật từ Users table > citizenName trong conversation > fallback
      const citizenName =
        (userRecord?.fullName && userRecord.fullName.trim())
          ? userRecord.fullName.trim()
          : (conv.citizenName && conv.citizenName !== "Người dân" && conv.citizenName.trim())
            ? conv.citizenName.trim()
            : conv.citizenName || "Người dân";

      // Avatar: ưu tiên Users table (có thể do user tự upload)
      const avatarUrl =
        userRecord?.avatarUrl && userRecord.avatarUrl.trim()
          ? userRecord.avatarUrl.trim()
          : null;

      return {
        ...conv,
        citizenName,
        avatarUrl,
        latestMessage: conv.messages?.[conv.messages.length - 1] || null,
        unreadCount: conv.status === "active" || conv.status === "waiting" ? 1 : 0
      };
    });
  } catch (error) {
    console.error("[adminStore.listConversations] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function getConversationById(id) {
  try {
    return await getChatHistory(id);
  } catch (error) {
    console.error("[adminStore.getConversationById] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function addConversationMessage({ conversationId, from, text, sender }) {
  try {
    const current = await getChatHistory(conversationId);
    if (!current) return null;
    return await sendMessage({
      userId: conversationId,
      from,
      text,
      sender
    });
  } catch (error) {
    console.error("[adminStore.addConversationMessage] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function resolveConversation(conversationId) {
  try {
    const result = await dynamo.send(
      new UpdateCommand({
        TableName: SUPPORT_CONVERSATIONS_TABLE,
        Key: { id: conversationId },
        UpdateExpression: "SET #status = :status, updatedAt = :updated_at",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":status": "resolved",
          ":updated_at": nowIso()
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[adminStore.resolveConversation] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function getAiHistory() {
  const result = await dynamo.send(
    new GetCommand({
      TableName: ADMIN_AI_TABLE,
      Key: { id: "default" }
    })
  );
  return Array.isArray(result.Item?.history) ? result.Item.history : [];
}

async function getAiRules() {
  const result = await dynamo.send(
    new GetCommand({
      TableName: ADMIN_AI_TABLE,
      Key: { id: "default" }
    })
  );
  return String(result.Item?.rulesText || "");
}

async function updateAiRules(rulesText, adminEmail) {
  const historyItem = {
    id: `ai-${Date.now()}`,
    question: "Cập nhật bộ quy tắc trả lời",
    answer: `Admin ${adminEmail || "unknown"} đã cập nhật rules`,
    at: nowIso()
  };
  const result = await dynamo.send(
    new UpdateCommand({
      TableName: ADMIN_AI_TABLE,
      Key: { id: "default" },
      UpdateExpression:
        "SET rulesText = :rules_text, history = list_append(:new_history, if_not_exists(history, :empty_list)), updatedAt = :updated_at",
      ExpressionAttributeValues: {
        ":rules_text": String(rulesText || ""),
        ":empty_list": [],
        ":new_history": [historyItem],
        ":updated_at": historyItem.at
      },
      ReturnValues: "ALL_NEW"
    })
  );
  return result.Attributes?.rulesText || "";
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