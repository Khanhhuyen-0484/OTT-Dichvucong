const { GetCommand, PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const TABLE_NAME = process.env.DYNAMODB_DOSSIERS_TABLE || "Dossiers";

function getClient() { return getDynamoClient(); }

function normalizeDossier(dossier) {
  if (!dossier) return null;
  const dossierId = String(dossier.dossierId || dossier.id || dossier.applicationCode || dossier.dossierCode || "").trim();
  const dossierCode = String(dossier.dossierCode || dossier.applicationCode || dossierId || "").trim();
  if (!dossierId) return null;
  return {
    ...dossier,
    dossierId,
    dossierCode,
    id: dossierId,
    applicationCode: dossierCode,
    applicationId: dossierId,
    serviceId: String(dossier.serviceId || "").trim(),
    serviceName: String(dossier.serviceName || "").trim(),
    citizenName: String(dossier.citizenName || dossier.formData?.fullName || "Người dân").trim(),
    phone: String(dossier.phone || dossier.formData?.phone || "").trim(),
    email: String(dossier.email || dossier.formData?.email || "").trim(),
    status: String(dossier.status || "new").trim(),
    paymentStatus: String(dossier.paymentStatus || "unpaid").trim(),
    timeline: Array.isArray(dossier.timeline) ? dossier.timeline : [],
    createdAt: dossier.createdAt || new Date().toISOString(),
    updatedAt: dossier.updatedAt || new Date().toISOString()
  };
}

async function syncFromApplication(application) {
  const client = getClient();
  const dossierId = String(application.dossierId || application.id || application.applicationCode || application.applicationId || "").trim();
  const dossierCode = String(application.dossierCode || application.applicationCode || dossierId || "").trim();
  const item = normalizeDossier({
    dossierId,
    dossierCode,
    id: dossierId,
    serviceId: application.serviceId,
    serviceName: application.serviceName,
    citizenName: application.formData?.fullName || application.citizenName || "Người dân",
    phone: application.formData?.phone || application.phone || "",
    email: application.formData?.email || application.email || "",
    status: application.status || "new",
    paymentStatus: application.paymentStatus || "unpaid",
    timeline: application.history || [],
    createdAt: application.createdAt || new Date().toISOString(),
    updatedAt: application.updatedAt || new Date().toISOString(),
    source: "service_application"
  });
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}
async function findById(id) { const code = String(id || "").trim(); if (!code) return null; const client = getClient(); const result = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: code } })); return normalizeDossier(result.Item); }
async function listAll() { const client = getClient(); const result = await client.send(new ScanCommand({ TableName: TABLE_NAME })); return (result.Items || []).map(normalizeDossier).filter(Boolean); }
async function updateById(id, updates) { const code = String(id || "").trim(); if (!code) return null; const client = getClient(); const result = await client.send(new UpdateCommand({ TableName: TABLE_NAME, Key: { id: code }, UpdateExpression: "SET #data = :data, updatedAt = :updated_at", ExpressionAttributeNames: { "#data": "data" }, ExpressionAttributeValues: { ":data": updates || {}, ":updated_at": new Date().toISOString() }, ReturnValues: "ALL_NEW" })); return normalizeDossier(result.Attributes); }

module.exports = { syncFromApplication, findById, listAll, updateById, normalizeDossier };
