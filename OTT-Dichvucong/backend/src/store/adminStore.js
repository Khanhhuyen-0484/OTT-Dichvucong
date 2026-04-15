const {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");

const DOSSIERS_TABLE = process.env.DYNAMODB_DOSSIERS_TABLE || "Dossiers";
const SUPPORT_CONVERSATIONS_TABLE =
  process.env.DYNAMODB_SUPPORT_CONVERSATIONS_TABLE || "SupportConversations";
const ADMIN_AI_TABLE = process.env.DYNAMODB_ADMIN_AI_TABLE || "AdminAi";

function nowIso() {
  return new Date().toISOString();
}

function normalizeDossierStatus(status) {
  const allowed = new Set(["new", "overdue", "processing", "completed", "need_more", "rejected"]);
  return allowed.has(status) ? status : "new";
}

async function getDashboardStats() {
  const [dossiersRs, conversationsRs] = await Promise.all([
    dynamo.send(new ScanCommand({ TableName: DOSSIERS_TABLE })),
    dynamo.send(new ScanCommand({ TableName: SUPPORT_CONVERSATIONS_TABLE }))
  ]);
  const dossiers = dossiersRs.Items || [];
  const conversations = conversationsRs.Items || [];
  const totalNew = dossiers.filter((x) => x.status === "new").length;
  const totalOverdue = dossiers.filter((x) => x.status === "overdue").length;
  const waitingMessages = conversations.filter((x) => x.status === "waiting").length;
  return { totalNew, totalOverdue, waitingMessages };
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
      status: "waiting",
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
}

async function upsertConversationFromCitizen({ citizenUserId, citizenName, text }) {
  const uid = String(citizenUserId || "").trim();
  if (!uid) return null;
  const message = {
    id: `msg-${Date.now()}`,
    from: "citizen",
    text: String(text || "").slice(0, 2000),
    at: nowIso()
  };
  await dynamo.send(
    new UpdateCommand({
      TableName: SUPPORT_CONVERSATIONS_TABLE,
      Key: { id: uid },
      UpdateExpression:
        "SET citizenUserId = if_not_exists(citizenUserId, :citizen_user_id), dossierId = if_not_exists(dossierId, :dossier_id), citizenName = if_not_exists(citizenName, :citizen_name), #status = :status, messages = list_append(if_not_exists(messages, :empty_list), :new_message), lastMessage = :last_message, updatedAt = :updated_at",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":citizen_user_id": uid,
        ":dossier_id": `CHAT-${uid}`,
        ":citizen_name": citizenName || "Người dân",
        ":status": "waiting",
        ":empty_list": [],
        ":new_message": [message],
        ":last_message": message,
        ":updated_at": message.at
      }
    })
  );
  return getConversationById(uid);
}

async function listConversations() {
  const result = await dynamo.send(new ScanCommand({ TableName: SUPPORT_CONVERSATIONS_TABLE }));
  const conversations = result.Items || [];
  return conversations.map((conv) => ({
    ...conv,
    latestMessage: conv.messages?.[conv.messages.length - 1] || null,
    unreadCount: conv.status === "waiting" ? 1 : 0
  }));
}

async function getConversationById(id) {
  const result = await dynamo.send(
    new GetCommand({
      TableName: SUPPORT_CONVERSATIONS_TABLE,
      Key: { id }
    })
  );
  return result.Item || null;
}

async function addConversationMessage({ conversationId, from, text }) {
  const current = await getConversationById(conversationId);
  if (!current) return null;
  const message = {
    id: `msg-${Date.now()}`,
    from,
    text: String(text).slice(0, 2000),
    at: nowIso()
  };
  const shouldWaiting = from === "citizen";
  const result = await dynamo.send(
    new UpdateCommand({
      TableName: SUPPORT_CONVERSATIONS_TABLE,
      Key: { id: conversationId },
      UpdateExpression: shouldWaiting
        ? "SET #status = :status, messages = list_append(if_not_exists(messages, :empty_list), :new_message), lastMessage = :last_message, updatedAt = :updated_at"
        : "SET messages = list_append(if_not_exists(messages, :empty_list), :new_message), lastMessage = :last_message, updatedAt = :updated_at",
      ExpressionAttributeNames: shouldWaiting
        ? {
            "#status": "status"
          }
        : undefined,
      ExpressionAttributeValues: shouldWaiting
        ? {
            ":status": "waiting",
            ":empty_list": [],
            ":new_message": [message],
            ":last_message": message,
            ":updated_at": message.at
          }
        : {
            ":empty_list": [],
            ":new_message": [message],
            ":last_message": message,
            ":updated_at": message.at
          },
      ConditionExpression: "attribute_exists(id)",
      ReturnValues: "ALL_NEW"
    })
  );
  return result.Attributes || null;
}

async function resolveConversation(conversationId) {
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
