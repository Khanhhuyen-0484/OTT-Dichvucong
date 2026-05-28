const { readJson, putAll } = require("./_helpers");

async function migrateAdminAi() {
  const tableName = process.env.DYNAMODB_ADMIN_AI_TABLE || "AdminAi";
  const data = await readJson("admin_data.json", { ai: {} });
  const ai = data.ai && typeof data.ai === "object" ? data.ai : {};
  const item = {
    id: "default",
    rulesText: String(ai.rulesText || ""),
    history: Array.isArray(ai.history) ? ai.history : [],
    updatedAt: new Date().toISOString()
  };
  await putAll(tableName, [item]);
  console.log(`[migrate] AdminAi: 1 record -> ${tableName}`);
}

module.exports = { migrateAdminAi };

if (require.main === module) {
  migrateAdminAi().catch((err) => {
    console.error("[migrate] AdminAi failed:", err.message);
    process.exit(1);
  });
}
