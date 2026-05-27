const { PutCommand, QueryCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const tableName = process.env.DYNAMO_PAYMENTS_TABLE || "Payments";

function parseCreatedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt));
}

async function savePayment(item) {
  const client = getDynamoClient();
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function getPaymentById(paymentId) {
  const client = getDynamoClient();
  const res = await client.send(new GetCommand({ TableName: tableName, Key: { paymentId } }));
  return res.Item || null;
}

async function updatePayment(paymentId, updates) {
  const current = await getPaymentById(paymentId);
  if (!current) return null;
  const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
  await savePayment(next);
  return next;
}

async function getPaymentsByDossierId(dossierId) {
  const client = getDynamoClient();
  try {
    const data = await client.send(new QueryCommand({
      TableName: tableName,
      IndexName: "dossierId-createdAt-index",
      KeyConditionExpression: "dossierId = :dossierId",
      ExpressionAttributeValues: { ":dossierId": dossierId },
      ScanIndexForward: false,
    }));
    return sortByCreatedAtDesc(data.Items || []);
  } catch (error) {
    console.warn("[paymentStore.getPaymentsByDossierId] query failed, fallback to scan:", error?.message || error);
    const scan = await client.send(new ScanCommand({ TableName: tableName }));
    const items = (scan.Items || []).filter((item) => String(item.dossierId || "") === String(dossierId || ""));
    return sortByCreatedAtDesc(items);
  }
}

module.exports = { savePayment, updatePayment, getPaymentById, getPaymentsByDossierId, getPaymentsByApplicationId: getPaymentsByDossierId };
