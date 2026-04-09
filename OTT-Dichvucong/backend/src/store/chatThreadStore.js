const fs = require("fs/promises");
const path = require("path");

const FILE = path.join(__dirname, "..", "..", "data", "chat_threads.json");

async function load() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const j = JSON.parse(raw);
    return j.threads && typeof j.threads === "object" ? j : { threads: {} };
  } catch {
    return { threads: {} };
  }
}

async function save(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

/**
 * @param {string} userId
 * @returns {Promise<Array<{from:string,text:string,at:string}>>}
 */
async function getThread(userId) {
  const data = await load();
  const key = String(userId);
  return Array.isArray(data.threads[key]) ? data.threads[key] : [];
}

/**
 * @param {string} userId
 * @param {{ from: string, text: string }} msg
 */
async function appendMessage(userId, msg) {
  const data = await load();
  const key = String(userId);
  if (!Array.isArray(data.threads[key])) data.threads[key] = [];
  const row = {
    from: msg.from,
    text: String(msg.text || "").slice(0, 4000),
    at: new Date().toISOString()
  };
  data.threads[key].push(row);
  await save(data);
  return row;
}

module.exports = { getThread, appendMessage };
