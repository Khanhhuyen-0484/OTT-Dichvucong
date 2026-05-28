/**
 * Migration script: Chuyển dữ liệu users từ JSON files sang DynamoDB
 * 
 * Chạy: node scripts/migrate-users.js
 */

require("dotenv").config({ path: ".env" });
const fs = require("fs");
const path = require("path");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../src/config/dynamoClient");

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "Users";
const usersJsonPath = path.join(__dirname, "../data/users.json");

async function migrateUsers() {
  try {
    console.log("[Migration] Bắt đầu migrate users...");

    // Đọc file JSON
    const jsonData = fs.readFileSync(usersJsonPath, "utf-8");
    const { users } = JSON.parse(jsonData);

    if (!users || !Array.isArray(users)) {
      console.log("[Migration] Không tìm thấy mảng users trong file JSON");
      return;
    }

    console.log(`[Migration] Tìm thấy ${users.length} users trong JSON`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Đảm bảo các trường bắt buộc
        const userToInsert = {
          id: user.id || `u_${Date.now()}`,
          email: String(user.email || "").trim().toLowerCase(),
          fullName: String(user.fullName || "").trim(),
          phone: String(user.phone || "").trim(),
          address: String(user.address || "").trim(),
          avatarUrl: String(user.avatarUrl || "").trim(),
          role: user.role === "admin" ? "admin" : "citizen",
          passwordHash: String(user.passwordHash || ""),
          createdAt: user.createdAt || new Date().toISOString()
        };

        // Kiểm tra các trường bắt buộc
        if (!userToInsert.email || !userToInsert.passwordHash) {
          console.log(`[!] Bỏ qua user ${user.id} - thiếu email hoặc passwordHash`);
          errorCount++;
          continue;
        }

        // Migrate vào DynamoDB
        await dynamo.send(
          new PutCommand({
            TableName: USERS_TABLE,
            Item: userToInsert
          })
        );

        console.log(`[✓] Migrate user: ${userToInsert.email} (${userToInsert.id})`);
        successCount++;
      } catch (err) {
        console.error(`[✗] Lỗi migrate user ${user.id}:`, err.message);
        errorCount++;
      }
    }

    console.log("\n========== KẾT QUẢ MIGRATION ==========");
    console.log(`Thành công: ${successCount}/${users.length}`);
    console.log(`Lỗi: ${errorCount}/${users.length}`);
    console.log("======================================\n");

  } catch (err) {
    console.error("[Migration] Lỗi:", err.message);
    process.exit(1);
  }
}

migrateUsers().then(() => {
  console.log("[Migration] Hoàn tất!");
  process.exit(0);
}).catch((err) => {
  console.error("[Migration] Thất bại:", err);
  process.exit(1);
});
