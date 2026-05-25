const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

let docClient = null;

function createClient() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error("Missing AWS region. Set AWS_REGION or AWS_DEFAULT_REGION in .env");
  }

  const client = new DynamoDBClient({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}

function getDynamoClient() {
  if (!docClient) docClient = createClient();
  return docClient;
}

/** @deprecated Prefer getDynamoClient(); kept for stores that import `{ dynamo }`. */
const dynamo = {
  send: (...args) => getDynamoClient().send(...args),
};

module.exports = { dynamo, getDynamoClient };
