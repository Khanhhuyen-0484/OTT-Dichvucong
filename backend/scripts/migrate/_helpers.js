const fs = require("fs/promises");
const path = require("path");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { loadEnv } = require("../../src/config/loadEnv");
loadEnv();
const { dynamo } = require("../../src/config/dynamoClient");

const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

async function readJson(fileName, fallback = {}) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function putAll(tableName, items) {
  for (const item of items) {
    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: item
      })
    );
  }
}

module.exports = { readJson, putAll };
