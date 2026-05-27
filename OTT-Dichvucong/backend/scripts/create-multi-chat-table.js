const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { loadEnv } = require("../src/config/loadEnv");
loadEnv();

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "";
const client = new DynamoDBClient({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      : undefined
});

async function createMultiChatRoomsTable() {
  const tableName = process.env.DYNAMODB_MULTI_CHAT_ROOMS_TABLE || "MultiChatRooms";

  const params = {
    TableName: tableName,
    KeySchema: [
      {
        AttributeName: "id",
        KeyType: "HASH" // Partition key
      }
    ],
    AttributeDefinitions: [
      {
        AttributeName: "id",
        AttributeType: "S"
      }
    ],
    BillingMode: "PAY_PER_REQUEST" // On-demand pricing
  };

  try {
    console.log(`Creating table: ${tableName}`);
    const result = await client.send(new CreateTableCommand(params));
    console.log("Table created successfully:", result.TableDescription.TableName);
  } catch (error) {
    if (error.name === "ResourceInUseException") {
      console.log(`Table ${tableName} already exists`);
    } else {
      console.error("Error creating table:", error);
      throw error;
    }
  }
}

createMultiChatRoomsTable().catch(console.error);