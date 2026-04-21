const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");

const CHAT_THREADS_TABLE = process.env.DYNAMODB_CHAT_THREADS_TABLE || "ChatThreads";

/**
 * @param {string} userId
 * @returns {Promise<Array<{from:string,text:string,at:string}>>}
 */
async function getThread(userId) {
  const key = String(userId || "").trim();
  if (!key) return [];
  const result = await dynamo.send(
    new GetCommand({
      TableName: CHAT_THREADS_TABLE,
      Key: { threadId: key }
    })
  );
  return Array.isArray(result.Item?.messages) ? result.Item.messages : [];
}

/**
 * @param {string} userId
 * @param {{ from: string, text: string }} msg
 */
async function appendMessage(userId, msg) {
  const row = {
    from: msg.from,
    text: String(msg.text || "").slice(0, 4000),
    at: new Date().toISOString()
  };

  const key = String(userId || "").trim();
  await dynamo.send(
    new UpdateCommand({
      TableName: CHAT_THREADS_TABLE,
      Key: { threadId: key },
      UpdateExpression:
        "SET messages = list_append(if_not_exists(messages, :empty_list), :new_message), lastMessage = :last_message, updatedAt = :updated_at",
      ExpressionAttributeValues: {
        ":empty_list": [],
        ":new_message": [row],
        ":last_message": row,
        ":updated_at": row.at
      }
    })
  );
  return row;
}

module.exports = { getThread, appendMessage };
