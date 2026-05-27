const { readJson, putAll } = require("./_helpers");

async function migrateUsers() {
  const tableName = process.env.DYNAMODB_USERS_TABLE || "Users";
  const data = await readJson("users.json", { users: [] });
  const users = Array.isArray(data.users) ? data.users : [];
  await putAll(tableName, users);
  console.log(`[migrate] Users: ${users.length} records -> ${tableName}`);
}

module.exports = { migrateUsers };

if (require.main === module) {
  migrateUsers().catch((err) => {
    console.error("[migrate] Users failed:", err.message);
    process.exit(1);
  });
}
