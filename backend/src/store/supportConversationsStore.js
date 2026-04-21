const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");

const SUPPORT_CONVERSATIONS_TABLE =
  process.env.SUPPORT_CONVERSATIONS_TABLE ||
  process.env.DYNAMODB_SUPPORT_CONVERSATIONS_TABLE ||
  "SupportConversations";

function buildDefaultAvatar(fullName) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=128`;
}

function normalizeMessage(message, conversation) {
  const raw = message || {};
  const from = raw.from === "admin" ? "admin" : raw.from === "user" ? "user" : raw.from === "staff" ? "admin" : "user";
  const fallbackName = from === "admin" ? "Admin hỗ trợ" : conversation?.citizenName || "Người dùng";
  const sender = raw.sender && typeof raw.sender === "object" ? raw.sender : {};
  const fullName = sender.fullName || fallbackName;
  const avatarUrl = sender.avatarUrl || buildDefaultAvatar(fullName);

  return {
    id: raw.id || `msg-${Date.now()}`,
    from,
    text: String(raw.text || ""),
    createdAt: raw.createdAt || raw.at || new Date().toISOString(),
    sender: {
      id: sender.id || "",
      fullName,
      avatarUrl
    }
  };
}

async function sendMessage({ userId, from, text, sender }) {
  try {
    const uid = String(userId || "").trim();
    if (!uid) return null;

    const message = {
      id: `msg-${Date.now()}`,
      from: from === "admin" ? "admin" : "user",
      text: String(text || "").slice(0, 2000),
      createdAt: new Date().toISOString(),
      sender: sender || {
        id: "",
        fullName: from === "admin" ? "Admin hỗ trợ" : "Người dùng",
        avatarUrl: buildDefaultAvatar(from === "admin" ? "Admin hỗ trợ" : "Người dùng")
      }
    };

    const result = await dynamo.send(
      new UpdateCommand({
        TableName: SUPPORT_CONVERSATIONS_TABLE,
        Key: { id: uid },
        UpdateExpression:
          "SET #ms = list_append(if_not_exists(#ms, :empty), :msg), lastMessage = :last_message, updatedAt = :updated_at, #st = :status",
        ExpressionAttributeNames: {
          "#st": "status",
          "#ms": "messages"
        },
        ExpressionAttributeValues: {
          ":empty": [],
          ":msg": [message],
          ":last_message": message,
          ":updated_at": message.createdAt,
          ":status": "active"
        },
        ReturnValues: "ALL_NEW"
      })
    );

    return result.Attributes || null;
  } catch (error) {
    console.error(
      "[supportConversationsStore.sendMessage] DynamoDB error:",
      error?.name,
      error?.message,
      error
    );
    throw error;
  }
}

async function getChatHistory(userId) {
  try {
    const uid = String(userId || "").trim();
    if (!uid) return null;

    const result = await dynamo.send(
      new GetCommand({
        TableName: SUPPORT_CONVERSATIONS_TABLE,
        Key: { id: uid }
      })
    );
    const conversation = result.Item || null;
    if (!conversation) return null;
    const normalizedMessages = Array.isArray(conversation.messages)
      ? conversation.messages.map((msg) => normalizeMessage(msg, conversation))
      : [];
    return {
      ...conversation,
      messages: normalizedMessages
    };
  } catch (error) {
    console.error(
      "[supportConversationsStore.getChatHistory] DynamoDB error:",
      error?.name,
      error?.message,
      error
    );
    throw error;
  }
}

module.exports = {
  sendMessage,
  getChatHistory
};
