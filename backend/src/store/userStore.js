const { GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const USERS_TABLE = process.env.USERS_TABLE || process.env.DYNAMODB_USERS_TABLE || "Users";

function getClient() {
  try {
    return getDynamoClient();
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function findByEmail(email) {
  try {
    console.log("[DEBUG] Email nhận vào:", email);
    const norm = String(email || "").trim().toLowerCase();
    if (!norm) return null;

    const params = {
      TableName: USERS_TABLE,
      FilterExpression: "#emailLower = :email",
      ExpressionAttributeNames: {
        "#emailLower": "email"
      },
      ExpressionAttributeValues: {
        ":email": norm
      },
      Limit: 1
    };

    console.log("Params scan:", params);
    const client = getClient();
    if (!client) return null;
    const result = await client.send(new ScanCommand(params));
    console.log("[LOGIN DEBUG] User tìm thấy trong DB:", result.Items?.[0]);
    console.log("Items tìm thấy:", result.Items);

    if (result.Items?.[0]) return result.Items[0];

    const fallbackResult = await client.send(
      new ScanCommand({
        TableName: USERS_TABLE
      })
    );
    const fallbackItem = (fallbackResult.Items || []).find((item) => {
      const emailLower = String(item?.email || "").trim().toLowerCase();
      const emailUpper = String(item?.Email || "").trim().toLowerCase();
      return emailLower === norm || emailUpper === norm;
    });
    console.log("[LOGIN DEBUG] User fallback scan:", fallbackItem);
    return fallbackItem || null;
  } catch (error) {
    console.error("[userStore.findByEmail] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

async function findById(id) {
  try {
    if (!id) return null;
    const client = getClient();
    if (!client) return null;
    const result = await client.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id }
      })
    );
    return result.Item || null;
  } catch (error) {
    console.error("[userStore.findById] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

function uniqueIds(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean)));
}

function withFriendFields(user) {
  if (!user) return null;
  return {
    ...user,
    friendIds: uniqueIds(user.friendIds),
    incomingFriendRequestIds: uniqueIds(user.incomingFriendRequestIds),
    outgoingFriendRequestIds: uniqueIds(user.outgoingFriendRequestIds),
    blockedUserIds: uniqueIds(user.blockedUserIds)
  };
}

function sanitizePublicUser(user) {
  const safe = withFriendFields(user);
  if (!safe) return null;
  return {
    id: safe.id,
    fullName: safe.fullName || "Người dùng",
    email: safe.email || "",
    phone: safe.phone || "",
    avatarUrl:
      safe.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(safe.fullName || "Nguoi dung")}&size=128`,
    friendIds: safe.friendIds,
    incomingFriendRequestIds: safe.incomingFriendRequestIds,
    outgoingFriendRequestIds: safe.outgoingFriendRequestIds,
    blockedUserIds: safe.blockedUserIds
  };
}

function normalizePhoneQuery(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function detectFriendLookupMode(keyword = "") {
  const raw = String(keyword || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) return "email";
  const digits = normalizePhoneQuery(raw);
  if (digits.length >= 8) return "phone";
  return null;
}

async function listUsers() {
  try {
    const client = getClient();
    if (!client) return [];
    const result = await client.send(new ScanCommand({ TableName: USERS_TABLE }));
    return (result.Items || []).map(withFriendFields);
  } catch (error) {
    console.error("[userStore.listUsers] DynamoDB error:", error?.name, error?.message, error);
    return [];
  }
}

async function updateUserAvatar(userId, avatarUrl) {
  try {
    if (!userId) return null;
    const client = getClient();
    if (!client) return null;
    const result = await client.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id: userId },
        UpdateExpression: "SET avatarUrl = :avatarUrl, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":avatarUrl": avatarUrl,
          ":updatedAt": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updateUserAvatar] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

async function updateUserRole(userId, role) {
  try {
    if (!userId) return null;
    const client = getClient();
    if (!client) return null;
    const result = await client.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id: userId },
        UpdateExpression: "SET #role = :role, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#role": "role"
        },
        ExpressionAttributeValues: {
          ":role": role,
          ":updatedAt": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updateUserRole] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

module.exports = {
  findByEmail,
  findById,
  listUsers,
  updateUserAvatar,
  updateUserRole,
  sanitizePublicUser,
  detectFriendLookupMode
};
