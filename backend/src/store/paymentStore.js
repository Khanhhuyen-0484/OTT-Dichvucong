const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const tableName = process.env.DYNAMO_PAYMENTS_TABLE || "Payments";

async function savePayment(item) {
  const client = getDynamoClient();
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function getPaymentsByApplicationId(applicationId) {
  const client = getDynamoClient();
  try {
    const data = await client.send(new QueryCommand({
      TableName: tableName,
      IndexName: "applicationId-createdAt-index",
      KeyConditionExpression: "applicationId = :applicationId",
      ExpressionAttributeValues: { ":applicationId": applicationId },
      ScanIndexForward: false,
    }));
    return data.Items || [];
  } catch (error) {
    console.warn("[paymentStore.getPaymentsByApplicationId] fallback empty:", error?.message || error);
    return [];
  }
}

module.exports = { savePayment, getPaymentsByApplicationId };
