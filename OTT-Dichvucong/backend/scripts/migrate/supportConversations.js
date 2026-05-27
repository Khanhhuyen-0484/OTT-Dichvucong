const { readJson, putAll } = require("./_helpers");

function normalizeConversation(conv) {
  const messages = Array.isArray(conv.messages) ? conv.messages : [];
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  const citizenUserId = conv.citizenUserId ? String(conv.citizenUserId) : undefined;
  const id = citizenUserId || String(conv.id);
  return {
    ...conv,
    id,
    citizenUserId: citizenUserId || conv.citizenUserId,
    lastMessage,
    updatedAt: lastMessage?.at || conv.updatedAt || null
  };
}

async function migrateSupportConversations() {
  const tableName =
    process.env.DYNAMODB_SUPPORT_CONVERSATIONS_TABLE || "SupportConversations";
  const data = await readJson("admin_data.json", { supportConversations: [] });
  const conversations = Array.isArray(data.supportConversations)
    ? data.supportConversations
    : [];
  const items = conversations.map(normalizeConversation);
  await putAll(tableName, items);
  console.log(`[migrate] SupportConversations: ${items.length} records -> ${tableName}`);
}

module.exports = { migrateSupportConversations };

if (require.main === module) {
  migrateSupportConversations().catch((err) => {
    console.error("[migrate] SupportConversations failed:", err.message);
    process.exit(1);
  });
}
