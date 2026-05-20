const { migrateUsers } = require("./users");
const { migrateChatThreads } = require("./chatThreads");
const { migrateDossiers } = require("./dossiers");
const { migrateSupportConversations } = require("./supportConversations");
const { migrateAdminAi } = require("./adminAi");

async function run() {
  await migrateUsers();
  await migrateChatThreads();
  await migrateDossiers();
  await migrateSupportConversations();
  await migrateAdminAi();
}

run().catch((err) => {
  console.error("[migrate] migrate:all failed:", err.message);
  process.exit(1);
});
