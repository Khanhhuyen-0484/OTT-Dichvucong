const { PutCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const tableName = process.env.DYNAMO_PAYMENTS_TABLE || "Payments";

function client() { return getDynamoClient(); }

function parseCreatedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt));
}

async function createPayment(item) {
  await client().send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function queryByDossierId(dossierId) {
  const db = client();
  const scan = await db.send(new ScanCommand({ TableName: tableName }));
  return sortByCreatedAtDesc((scan.Items || []).filter((item) => String(item.dossierId || "") === String(dossierId || "")));
}

async function getPaymentByDossierId(dossierId) {
  const items = await queryByDossierId(dossierId);
  return items[0] || null;
}

async function findPendingByTransferContent(content) {
  const db = client();
  const q = String(content || "").toUpperCase();
  console.log("Searching transferContent:", q);
  const scan = await db.send(new ScanCommand({ TableName: tableName }));
  (scan.Items || []).forEach((item) => {
    console.log(
      "Payment:",
      item.paymentId,
      "transferContent:",
      item.transferContent,
      "status:",
      item.status
    );
  });
  return (scan.Items || []).find((p) => String(p.status || p.paymentStatus || "").toUpperCase() === "PENDING" && q.includes(String(p.transferContent || "").toUpperCase())) || null;
}

async function hasTransactionId(transactionId) {
  if (!transactionId) return false;
  const db = client();
  const scan = await db.send(new ScanCommand({ TableName: tableName }));
  return (scan.Items || []).some((x) => String(x.transactionId || "") === String(transactionId));
}

async function getPaymentById(paymentId) {
  const db = client();
  const current = await db.send(new GetCommand({ TableName: tableName, Key: { paymentId } }));
  return current.Item || null;
}

async function updatePayment(paymentId, updates) {
  const db = client();
  const current = await getPaymentById(paymentId);
  if (!current) return null;
  const next = { ...current, paymentId, ...updates, updatedAt: new Date().toISOString() };
  await db.send(new PutCommand({ TableName: tableName, Item: next }));
  return next;
}

module.exports = { createPayment, getPaymentByDossierId, getPaymentById, findPendingByTransferContent, hasTransactionId, updatePayment };
