const bcrypt = require("bcryptjs");
const { ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { loadEnv } = require("../../src/config/loadEnv");

loadEnv();
const { dynamo } = require("../../src/config/dynamoClient");

const USERS_TABLE = process.env.USERS_TABLE || process.env.DYNAMODB_USERS_TABLE || "Users";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function migratePasswordHashes() {
  let lastEvaluatedKey;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        ProjectionExpression: "id, email, passwordHash",
        ExclusiveStartKey: lastEvaluatedKey
      })
    );

    const users = Array.isArray(result.Items) ? result.Items : [];
    scanned += users.length;

    for (const user of users) {
      const userId = String(user.id || "").trim();
      const email = String(user.email || "").trim().toLowerCase();
      const currentPassword = user.passwordHash;

      if (!userId || typeof currentPassword !== "string" || !currentPassword.trim()) {
        skipped += 1;
        continue;
      }

      if (isBcryptHash(currentPassword)) {
        skipped += 1;
        continue;
      }

      try {
        const nextHash = await bcrypt.hash(currentPassword, BCRYPT_ROUNDS);
        await dynamo.send(
          new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { id: userId },
            UpdateExpression: "SET passwordHash = :password_hash, email = :email",
            ExpressionAttributeValues: {
              ":password_hash": nextHash,
              ":email": email
            },
            ConditionExpression: "attribute_exists(id)"
          })
        );
        updated += 1;
        console.log(`[migrate:passwordHashes] Updated user ${userId}`);
      } catch (error) {
        errors += 1;
        console.error(
          `[migrate:passwordHashes] Failed user ${userId}:`,
          error?.name,
          error?.message
        );
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(
    `[migrate:passwordHashes] Done. scanned=${scanned}, updated=${updated}, skipped=${skipped}, errors=${errors}`
  );

  return { scanned, updated, skipped, errors };
}

module.exports = { migratePasswordHashes };

if (require.main === module) {
  migratePasswordHashes().catch((err) => {
    console.error("[migrate:passwordHashes] Failed:", err?.name, err?.message, err);
    process.exit(1);
  });
}
