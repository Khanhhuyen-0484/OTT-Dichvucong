const { GetCommand, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { loadEnv } = require("../../src/config/loadEnv");
loadEnv();
const { dynamo } = require("../../src/config/dynamoClient");

async function migrateApplicationsToDossiers() {
  const sourceTable = process.env.DYNAMODB_SERVICE_APPLICATIONS_TABLE || "Applications";
  const targetTable = process.env.DYNAMODB_DOSSIERS_TABLE || "Dossiers";

  const scan = await dynamo.send(new ScanCommand({ TableName: sourceTable }));
  const items = Array.isArray(scan.Items) ? scan.Items : [];

  let copied = 0;
  let skipped = 0;
  let existing = 0;

  for (const item of items) {
    const applicationId = String(item.applicationId || item.applicationCode || item.id || "").trim();
    if (!applicationId) {
      skipped += 1;
      continue;
    }

    const current = await dynamo.send(new GetCommand({ TableName: targetTable, Key: { applicationId } }));
    if (current?.Item) {
      existing += 1;
      continue;
    }

    const dossier = {
      ...item,
      applicationId,
      applicationCode: item.applicationCode || applicationId,
      id: item.id || applicationId,
      updatedAt: item.updatedAt || new Date().toISOString(),
      createdAt: item.createdAt || new Date().toISOString(),
    };

    await dynamo.send(new PutCommand({ TableName: targetTable, Item: dossier }));
    copied += 1;
  }

  console.log(`[migrate] Applications -> Dossiers: copied=${copied}, existing=${existing}, skipped=${skipped}, source=${sourceTable}, target=${targetTable}`);
  return { copied, skipped, sourceTable, targetTable };
}

module.exports = { migrateApplicationsToDossiers };

if (require.main === module) {
  migrateApplicationsToDossiers().catch((err) => {
    console.error("[migrate] Applications -> Dossiers failed:", err.message);
    process.exit(1);
  });
}
