const { GetCommand, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const TABLE_NAME = process.env.DYNAMODB_SERVICE_CATEGORIES_TABLE || process.env.SERVICE_CATEGORIES_TABLE || "ServiceCategories";

const DEFAULT_CATEGORY_NAMES = [
  "Hộ tịch",
  "Đất đai",
  "Xây dựng",
  "Doanh nghiệp",
  "Giao thông vận tải",
  "Giáo dục",
  "Y tế",
  "Lao động - Thương binh và Xã hội",
  "Thuế - Tài chính",
  "Công an"
];

function getClient() { return getDynamoClient(); }
function todayStamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
function pad4() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }
function slugify(text) { return String(text || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function generateCategoryId(name) { return `CAT-${todayStamp()}-${(slugify(name).slice(0, 4).toUpperCase() || pad4())}`; }

function normalizeCategory(item) {
  if (!item) return null;
  const id = String(item.id || item.categoryId || "").trim();
  const name = String(item.name || item.categoryName || "").trim();
  if (!id || !name) return null;
  return {
    ...item,
    id,
    categoryId: id,
    name,
    categoryName: name,
    description: String(item.description || "").trim(),
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function defaultCategories() {
  return DEFAULT_CATEGORY_NAMES.map((name) => normalizeCategory({ id: generateCategoryId(name), name }));
}

async function listCategories() {
  const client = getClient();
  try {
    const data = await client.send(new ScanCommand({ TableName: TABLE_NAME }));
    const items = (data.Items || []).map(normalizeCategory).filter(Boolean);
    return items.length ? items : defaultCategories();
  } catch {
    return defaultCategories();
  }
}

async function getCategoryById(categoryId) {
  const id = String(categoryId || "").trim();
  if (!id) return null;
  const client = getClient();
  try {
    const data = await client.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }));
    return normalizeCategory(data.Item);
  } catch {
    return (await listCategories()).find((item) => item.id === id) || null;
  }
}

async function upsertCategory(category) {
  const normalized = normalizeCategory(category);
  if (!normalized) throw new Error("Danh mục không hợp lệ");
  const client = getClient();
  await client.send(new PutCommand({ TableName: TABLE_NAME, Item: normalized }));
  return normalized;
}

async function seedDefaultCategories() {
  const client = getClient();
  const existing = await listCategories();
  const existingNames = new Set(existing.map((item) => item.name));
  let seeded = 0;
  const created = [];
  for (const name of DEFAULT_CATEGORY_NAMES) {
    if (existingNames.has(name)) continue;
    const item = normalizeCategory({ id: generateCategoryId(name), name });
    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    seeded += 1;
    created.push(item);
  }
  return { seeded, categories: created };
}

module.exports = {
  TABLE_NAME,
  DEFAULT_CATEGORY_NAMES,
  generateCategoryId,
  listCategories,
  getCategoryById,
  upsertCategory,
  seedDefaultCategories,
  normalizeCategory,
};
