const { PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const tableName = process.env.DYNAMO_NOTIFICATIONS_TABLE || process.env.DYNAMODB_APPLICATIONS_TABLE || "Applications";

function normalizeNotification(item) {
  if (!item) return null;
  const notificationId = String(item.notificationId || item.id || item.applicationId || "").trim();
  if (!notificationId) return null;
  const applicationId = String(item.applicationId || item.dossierId || item.id || notificationId || "").trim();
  return {
    ...item,
    id: item.id || notificationId,
    notificationId,
    applicationId,
    userId: String(item.userId || "").trim(),
    title: String(item.title || "").trim(),
    message: String(item.message || "").trim(),
    type: String(item.type || "notification").trim(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

async function createNotification(item) {
  const client = getDynamoClient();
  const next = normalizeNotification(item);
  if (!next) throw new Error("Th?ng b?o kh?ng h?p l??");
  await client.send(new PutCommand({ TableName: tableName, Item: next }));
  return next;
}

async function getNotificationsByUser(userId) {
  const client = getDynamoClient();
  const uid = String(userId || "").trim();
  if (!uid) return [];
  try {
    const data = await client.send(new QueryCommand({
      TableName: tableName,
      IndexName: "userId-createdAt-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": uid },
      ScanIndexForward: false,
    }));
    return (data.Items || []).map(normalizeNotification).filter(Boolean);
  } catch (error) {
    console.warn("[notificationStore.getNotificationsByUser] query failed, fallback scan:", error?.message || error);
    const scan = await client.send(new ScanCommand({ TableName: tableName }));
    return (scan.Items || []).map(normalizeNotification).filter((item) => item.userId === uid);
  }
}

module.exports = { createNotification, getNotificationsByUser, normalizeNotification };
