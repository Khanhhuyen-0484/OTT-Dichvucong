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

const WINDOWS_1252_REVERSE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function encodeWindows1252(text) {
  return Buffer.from([...text].map((char) => {
    const code = char.charCodeAt(0);
    return WINDOWS_1252_REVERSE.get(code) || (code <= 0xff ? code : 0x3f);
  }));
}

function decodeText(value) {
  const text = String(value || "");
  if (!/[\u00c3\u00c2\u00c4\u00c6\u00c5\u0192]|\u00e1\u00ba|\u00e1\u00bb/.test(text)) return text;
  try {
    return encodeWindows1252(text).toString("utf8");
  } catch {
    return text;
  }
}

function normalizeTextFields(item) {
  if (!item || typeof item !== "object") return item;
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => {
      if (typeof value === "string") return [key, decodeText(value)];
      if (Array.isArray(value)) return [key, value.map((entry) => normalizeTextFields(entry))];
      if (value && typeof value === "object") return [key, normalizeTextFields(value)];
      return [key, value];
    })
  );
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
  item = normalizeTextFields(item);
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
    processingTime: String(item.processingTime || "Không xác định"),
    fee: Number(item.fee || 0),
    documents: Array.isArray(item.documents) ? item.documents : [],
    timeline: Array.isArray(item.timeline) && item.timeline.length
  ? item.timeline
  : [
      "Tiếp nhận hồ sơ",
      "Kiểm tra tính hợp lệ",
      "Xử lý chuyên viên",
      "Phê duyệt / bổ sung",
      "Trả kết quả"
    ],
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
