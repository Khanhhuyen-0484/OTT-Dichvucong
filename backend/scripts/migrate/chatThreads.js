const { readJson, putAll } = require("./_helpers");

function toThreadItem(threadId, messages) {
  const list = Array.isArray(messages) ? messages : [];
  const lastMessage = list.length ? list[list.length - 1] : null;
  return {
    threadId,
    messages: list,
    lastMessage,
    updatedAt: lastMessage?.at || null
  };
}

async function migrateChatThreads() {
  const tableName = process.env.DYNAMODB_CHAT_THREADS_TABLE || "ChatThreads";
  const data = await readJson("chat_threads.json", { threads: {} });
  const threads = data.threads && typeof data.threads === "object" ? data.threads : {};
  const items = Object.entries(threads).map(([threadId, messages]) =>
    toThreadItem(String(threadId), messages)
  );
  await putAll(tableName, items);
  console.log(`[migrate] ChatThreads: ${items.length} records -> ${tableName}`);
}

module.exports = { migrateChatThreads };

if (require.main === module) {
  migrateChatThreads().catch((err) => {
    console.error("[migrate] ChatThreads failed:", err.message);
    process.exit(1);
  });
}
