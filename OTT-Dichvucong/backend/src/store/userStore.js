const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

async function readUsers() {
  await ensureFile();
  const raw = await fs.readFile(USERS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await ensureFile();
  await fs.writeFile(USERS_FILE, JSON.stringify({ users }, null, 2), "utf8");
}

async function findByEmail(email) {
  const norm = normalizeEmail(email);
  const users = await readUsers();
  return users.find((u) => normalizeEmail(u.email) === norm) || null;
}

async function findById(id) {
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

async function createUser({
  email,
  passwordHash,
  fullName,
  phone,
  address
}) {
  const norm = normalizeEmail(email);
  const users = await readUsers();
  if (users.some((u) => normalizeEmail(u.email) === norm)) {
    const err = new Error("Email already exists");
    err.code = "EMAIL_EXISTS";
    throw err;
  }
  const user = {
    id: `u_${Date.now()}`,
    email: norm,
    fullName: String(fullName || "").trim(),
    phone: String(phone || "").trim(),
    address: String(address || "").trim(),
    avatarUrl: "",
    passwordHash,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

const PATCHABLE = new Set(["fullName", "phone", "address", "avatarUrl"]);

async function updateUserById(id, patch) {
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return null;
  for (const [k, v] of Object.entries(patch)) {
    if (!PATCHABLE.has(k) || v === undefined) continue;
    if (k === "avatarUrl") {
      users[i].avatarUrl = v === null || v === "" ? "" : String(v).trim();
    } else if (k === "fullName") {
      users[i].fullName = String(v || "").trim();
    } else if (k === "phone") {
      users[i].phone = String(v || "").trim();
    } else if (k === "address") {
      users[i].address = String(v || "").trim();
    }
  }
  await writeUsers(users);
  return users[i];
}

async function deleteUserById(id) {
  if (!id) return false;
  const users = await readUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  users.splice(i, 1);
  await writeUsers(users);
  return true;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  normalizeEmail,
  updateUserById,
  deleteUserById
};
