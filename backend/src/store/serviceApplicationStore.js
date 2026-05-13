const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../data/service_applications.json");

function ensureFile() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf-8");
  }
}

function readAll() {
  try {
    ensureFile();
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("readAll service_applications error:", err);
    return [];
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function create(application) {
  const items = readAll();
  items.push(application);
  writeAll(items);
  return application;
}

function findByCode(applicationCode) {
  const items = readAll();
  return items.find((item) => item.applicationCode === applicationCode) || null;
}

function findByUserId(userId) {
  const items = readAll();
  return items.filter((item) => item.userId === userId);
}

function updateByCode(applicationCode, updates) {
  const items = readAll();
  const idx = items.findIndex((item) => item.applicationCode === applicationCode);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  writeAll(items);
  return items[idx];
}

function deleteByCode(applicationCode) {
  const items = readAll();
  const filtered = items.filter((item) => item.applicationCode !== applicationCode);
  writeAll(filtered);
  return true;
}

module.exports = {
  readAll,
  writeAll,
  create,
  findByCode,
  findByUserId,
  updateByCode,
  deleteByCode
};