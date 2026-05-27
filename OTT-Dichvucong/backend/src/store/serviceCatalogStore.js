const fs = require("fs");
const path = require("path");
const { GetCommand, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const TABLE_NAME = process.env.DYNAMO_PUBLIC_SERVICES_TABLE || "PublicServices";
const FALLBACK_FILE_CANDIDATES = [
  path.join(__dirname, "..", "..", "data", "public_services.json"),
  path.join(__dirname, "..", "..", "data", "services.json")
];

function getClient() {
  return getDynamoClient();
}

function loadFallbackServices() {
  for (const filePath of FALLBACK_FILE_CANDIDATES) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(normalizeItem).filter(Boolean);
      }
    } catch (error) {
      // ignore malformed fallback files and continue to next source
    }
  }
  return [];
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
  try {
    const client = getClient();
    const data = await client.send(new ScanCommand({ TableName: TABLE_NAME }));
    const items = (data.Items || []).map(normalizeItem).filter(Boolean);
    return items.length ? items : loadFallbackServices();
  } catch (error) {
    return loadFallbackServices();
  }
}

async function seedServicesToDynamo() {
  const fallbackServices = loadFallbackServices();
  if (!fallbackServices.length) return { seeded: 0 };

  const client = getClient();
  const existing = await client.send(new ScanCommand({ TableName: TABLE_NAME }));
  const existingIds = new Set((existing.Items || []).map((item) => String(item.serviceId || item.id || "").trim()).filter(Boolean));

  let seeded = 0;
  for (const service of fallbackServices) {
    if (existingIds.has(service.serviceId)) continue;
    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: service }));
    seeded += 1;
  }

  return { seeded };
}

async function getService(serviceId) {
  const normalizedId = String(serviceId || "").trim();
  if (!normalizedId) return null;
  const client = getClient();
  try {
    const data = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: { serviceId: normalizedId } }));
    const item = normalizeItem(data.Item);
    if (item) return item;
  } catch (error) {
    // fall back below
  }
  return loadFallbackServices().find((item) => item.serviceId === normalizedId) || null;
}

async function upsertService(item) {
  const normalized = normalizeItem(item);
  if (!normalized) throw new Error("Dịch vụ không hợp lệ");
  const client = getClient();
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: normalized }));
  return normalized;
}

module.exports = { listServices, getService, upsertService, normalizeItem, seedServicesToDynamo };
