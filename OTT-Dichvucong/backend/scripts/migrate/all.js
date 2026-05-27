const { migrateUsers } = require("./users");
const { migrateChatThreads } = require("./chatThreads");
const { migrateDossiers } = require("./dossiers");
const { migrateApplicationsToDossiers } = require("./applicationsToDossiers");
const { migrateSupportConversations } = require("./supportConversations");
const { migrateAdminAi } = require("./adminAi");

async function run() {
  await migrateUsers();
  await migrateChatThreads();
  await migrateDossiers();
  await migrateApplicationsToDossiers();
  await migrateSupportConversations();
  await migrateAdminAi();
}

run().catch((err) => {
  console.error("[migrate] migrate:all failed:", err.message);
  process.exit(1);
});
