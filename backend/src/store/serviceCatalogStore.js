const { GetCommand, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const TABLE_NAME = process.env.DYNAMO_PUBLIC_SERVICES_TABLE || "PublicServices";

function getClient() {
  return getDynamoClient();
}

function normalizeItem(item) {
  if (!item) return null;
  const serviceId = String(item.serviceId || item.id || "").trim();
  if (!serviceId) return null;
  return {
    ...item,
    serviceId,
    id: serviceId,
    name: String(item.name || "").trim(),
    description: String(item.description || "").trim(),
    categoryId: String(item.categoryId || "").trim(),
    categoryName: String(item.categoryName || item.category || "Khác").trim(),
    processingTime: String(item.processingTime || "Đang cập nhật"),
    fee: Number(item.fee || 0),
    documents: Array.isArray(item.documents) ? item.documents : [],
    timeline: Array.isArray(item.timeline) && item.timeline.length ? item.timeline : ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"],
    faq: Array.isArray(item.faq) ? item.faq : []
  };
}

async function listServices() {
  const client = getClient();
  const data = await client.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (data.Items || []).map(normalizeItem).filter(Boolean);
}

async function getService(serviceId) {
  const normalizedId = String(serviceId || "").trim();
  if (!normalizedId) return null;
  const client = getClient();
  const data = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: { serviceId: normalizedId } }));
  return normalizeItem(data.Item);
}

async function upsertService(item) {
  const normalized = normalizeItem(item);
  if (!normalized) throw new Error("Dịch vụ không hợp lệ");
  const client = getClient();
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: normalized }));
  return normalized;
}

module.exports = { listServices, getService, upsertService, normalizeItem };
