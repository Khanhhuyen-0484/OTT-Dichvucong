const { GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const TABLE_NAME = process.env.DYNAMODB_SERVICE_APPLICATIONS_TABLE || "Applications";

function getClient() { return getDynamoClient(); }

function normalizeApplication(application) {
  if (!application) return null;
  const applicationCode = String(application.applicationCode || application.applicationId || application.id || "").trim();
  if (!applicationCode) return null;
  return {
    ...application,
    applicationCode,
    applicationId: application.applicationId || applicationCode,
    id: application.id || applicationCode,
    serviceId: String(application.serviceId || "").trim(),
    serviceName: String(application.serviceName || "").trim(),
    userId: String(application.userId || "").trim(),
    status: String(application.status || "PENDING").trim(),
    paymentStatus: String(application.paymentStatus || "UNPAID").trim(),
    createdAt: application.createdAt || new Date().toISOString(),
    updatedAt: application.updatedAt || new Date().toISOString()
  };
}

async function readAll() { const client = getClient(); const result = await client.send(new ScanCommand({ TableName: TABLE_NAME })); return (result.Items || []).map(normalizeApplication).filter(Boolean); }
async function writeAll() { throw new Error("writeAll is not supported in DynamoDB-only mode"); }
async function create(application) { const item = normalizeApplication(application); if (!item) throw new Error("Hồ sơ không hợp lệ"); const client = getClient(); await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item })); return item; }
async function findByCode(applicationCode) { const code = String(applicationCode || "").trim(); if (!code) return null; const client = getClient(); const result = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: { applicationCode: code } })); return normalizeApplication(result.Item); }
async function findByUserId(userId) { const uid = String(userId || "").trim(); if (!uid) return []; const items = await readAll(); return items.filter((item) => item.userId === uid); }
async function updateByCode(applicationCode, updates) { const code = String(applicationCode || "").trim(); if (!code) return null; const current = await findByCode(code); if (!current) return null; const next = normalizeApplication({ ...current, ...(updates || {}), applicationCode: code, applicationId: code, id: code, updatedAt: new Date().toISOString() }); const client = getClient(); const result = await client.send(new PutCommand({ TableName: TABLE_NAME, Item: next })); return next; }
async function deleteByCode(applicationCode) { const code = String(applicationCode || "").trim(); if (!code) return false; const client = getClient(); await client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { applicationCode: code } })); return true; }

module.exports = { readAll, writeAll, create, findByCode, findByUserId, updateByCode, deleteByCode, normalizeApplication };
