const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");
const { normalizeAttachments } = require("./applicationAttachmentNormalizer");

const TABLE_NAME = process.env.DYNAMODB_SERVICE_APPLICATIONS_TABLE || process.env.DYNAMODB_DOSSIERS_TABLE || "Dossiers";

function getClient() { return getDynamoClient(); }

const ALLOWED_STATUSES = new Set(["PENDING", "PROCESSING", "NEED_MORE", "COMPLETED", "REJECTED"]);

function normalizeTimeline(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      status: String(item?.status || "").trim().toUpperCase(),
      action: String(item?.action || "").trim(),
      note: String(item?.note || "").trim(),
      actor: String(item?.actor || item?.by || "").trim(),
      createdAt: item?.createdAt || item?.at || new Date().toISOString(),
    }))
    .filter((item) => item.status || item.action || item.note || item.actor);
}

function normalizeApplication(application) {
  if (!application) return null;

  const dossierId = String(application.dossierId || application.id || application.applicationCode || application.applicationId || "").trim();
  const dossierCode = String(application.dossierCode || application.applicationCode || dossierId || "").trim();
  if (!dossierId) return null;

  const status = String(application.status || "PENDING").trim().toUpperCase();
  const timeline = normalizeTimeline(application.timeline || application.history || []);

  return {
    ...application,
    dossierId,
    dossierCode,
    id: dossierId,
    applicationCode: dossierCode,
    applicationId: dossierId,
    serviceId: String(application.serviceId || "").trim(),
    serviceName: String(application.serviceName || "").trim(),
    userId: String(application.userId || "").trim(),
    status: ALLOWED_STATUSES.has(status) ? status : "PENDING",
    paymentStatus: String(application.paymentStatus || "UNPAID").trim(),
    timeline,
    history: timeline,
    attachments: normalizeAttachments(application.attachments || []).map((item) => ({
      ...item,
      previewUrl: item.fileUrl || item.url || item.path || "",
    })),
    createdAt: application.createdAt || new Date().toISOString(),
    updatedAt: application.updatedAt || new Date().toISOString(),
  };
}

async function readAll() {
  const client = getClient();
  const result = await client.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items || []).map(normalizeApplication).filter(Boolean);
}

async function writeAll() {
  throw new Error("writeAll is not supported in DynamoDB-only mode");
}

async function create(application) {
  const item = normalizeApplication(application);
  if (!item) throw new Error("Hồ sơ không hợp lệ");
  const client = getClient();
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

function getDossierKey(dossierId) {
  return { id: String(dossierId || "").trim() };
}

async function findByCode(dossierIdOrCode) {
  const dossierId = String(dossierIdOrCode || "").trim();
  if (!dossierId) return null;
  const client = getClient();
  const result = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: getDossierKey(dossierId) }));
  return normalizeApplication(result.Item);
}

async function findByUserId(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [];
  const items = await readAll();
  return items.filter((item) => item.userId === uid);
}

async function updateByCode(dossierIdOrCode, updates) {
  const dossierId = String(dossierIdOrCode || "").trim();
  if (!dossierId) return null;

  const current = await findByCode(dossierId);
  if (!current) return null;

  const next = normalizeApplication({
    ...current,
    ...(updates || {}),
    dossierId,
    dossierCode: current.dossierCode || current.applicationCode || dossierId,
    id: dossierId,
    updatedAt: new Date().toISOString(),
  });

  const client = getClient();
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: next }));
  return next;
}

async function deleteByCode(dossierIdOrCode) {
  const dossierId = String(dossierIdOrCode || "").trim();
  if (!dossierId) return false;
  const client = getClient();
  await client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: getDossierKey(dossierId) }));
  return true;
}

module.exports = {
  readAll,
  writeAll,
  create,
  findByCode,
  findByUserId,
  updateByCode,
  deleteByCode,
  normalizeApplication,
};
