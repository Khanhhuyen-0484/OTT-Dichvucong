const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const tableName = process.env.DYNAMO_NOTIFICATIONS_TABLE || "Notifications";

async function createNotification(item) {
  const client = getDynamoClient();
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function getNotificationsByUser(userId) {
  const client = getDynamoClient();
  try {
    const data = await client.send(new QueryCommand({
      TableName: tableName,
      IndexName: "userId-createdAt-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward: false,
    }));
    return data.Items || [];
  } catch (error) {
    console.warn("[notificationStore.getNotificationsByUser] fallback empty:", error?.message || error);
    return [];
  }
}

module.exports = { createNotification, getNotificationsByUser };
