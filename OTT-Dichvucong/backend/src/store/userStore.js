const { GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");

const USERS_TABLE = process.env.USERS_TABLE || process.env.DYNAMODB_USERS_TABLE || "Users";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function findByEmail(email) {
  try {
    console.log("[DEBUG] Email nhận vào:", email);
    const norm = String(email || "").trim().toLowerCase();
    if (!norm) return null;

    const params = {
      TableName: USERS_TABLE,
      FilterExpression: "#emailLower = :email",
      ExpressionAttributeNames: {
        "#emailLower": "email"
      },
      ExpressionAttributeValues: {
        ":email": norm
      },
      Limit: 1
    };

    console.log("Params scan:", params);
    const result = await dynamo.send(new ScanCommand(params));
    console.log("[LOGIN DEBUG] User tìm thấy trong DB:", result.Items?.[0]);
    console.log("Items tìm thấy:", result.Items);

    if (result.Items?.[0]) return result.Items[0];

    const fallbackResult = await dynamo.send(
      new ScanCommand({
        TableName: USERS_TABLE
      })
    );
    const fallbackItem = (fallbackResult.Items || []).find((item) => {
      const emailLower = String(item?.email || "").trim().toLowerCase();
      const emailUpper = String(item?.Email || "").trim().toLowerCase();
      return emailLower === norm || emailUpper === norm;
    });
    console.log("[LOGIN DEBUG] User fallback scan:", fallbackItem);
    return fallbackItem || null;
  } catch (error) {
    console.error("[userStore.findByEmail] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

async function findById(id) {
  try {
    if (!id) return null;
    const result = await dynamo.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id }
      })
    );
    return result.Item || null;
  } catch (error) {
    console.error("[userStore.findById] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function createUser({
  email,
  passwordHash,
  fullName,
  phone,
  address
}) {
  try {
    const norm = normalizeEmail(email);
    const existing = await findByEmail(norm);
    if (existing) {
      const err = new Error("Email already exists");
      err.code = "EMAIL_EXISTS";
      throw err;
    }
    const user = {
      id: `u_${Date.now()}`,
      email: norm,
      fullName: String(fullName || "").trim(),
      phone: String(phone || "").trim(),
      address: String(address || "").trim(),
      role: "citizen",
      avatarUrl: "",
      passwordHash,
      createdAt: new Date().toISOString()
    };
    await dynamo.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: user
      })
    );
    return user;
  } catch (error) {
    console.error("[userStore.createUser] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

const PATCHABLE = new Set(["fullName", "phone", "address", "avatarUrl"]);

async function updateUserById(id, patch) {
  try {
    const updates = {};
    for (const [k, v] of Object.entries(patch || {})) {
      if (!PATCHABLE.has(k) || v === undefined) continue;
      if (k === "avatarUrl") {
        updates.avatarUrl = v === null || v === "" ? "" : String(v).trim();
      } else if (k === "fullName") {
        updates.fullName = String(v || "").trim();
      } else if (k === "phone") {
        updates.phone = String(v || "").trim();
      } else if (k === "address") {
        updates.address = String(v || "").trim();
      }
    }
    const keys = Object.keys(updates);
    if (keys.length === 0) return findById(id);

    const setExpr = keys.map((key, i) => `#k${i} = :v${i}`).join(", ");
    const names = {};
    const values = {};
    keys.forEach((key, i) => {
      names[`#k${i}`] = key;
      values[`:v${i}`] = updates[key];
    });

    const result = await dynamo.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${setExpr}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updateUserById] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function deleteUserById(id) {
  try {
    if (!id) return false;
    const existing = await findById(id);
    if (!existing) return false;
    await dynamo.send(
      new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { id }
      })
    );
    return Boolean(existing);
  } catch (error) {
    console.error("[userStore.deleteUserById] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function updateUserRole(id, role) {
  try {
    if (!id) return null;
    const validRoles = ["citizen", "admin"];
    if (!validRoles.includes(role)) {
      const err = new Error("Invalid role");
      err.code = "INVALID_ROLE";
      throw err;
    }

    const result = await dynamo.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: "SET #role = :role",
        ExpressionAttributeNames: {
          "#role": "role"
        },
        ExpressionAttributeValues: {
          ":role": role
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updateUserRole] DynamoDB error:", error?.name, error?.message, error);
    throw error;
  }
}

async function updatePasswordHashById(id, passwordHash) {
  try {
    if (!id || !passwordHash) return null;
    const result = await dynamo.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: "SET passwordHash = :password_hash",
        ExpressionAttributeValues: {
          ":password_hash": String(passwordHash)
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error(
      "[userStore.updatePasswordHashById] DynamoDB error:",
      error?.name,
      error?.message,
      error
    );
    throw error;
  }
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  normalizeEmail,
  updateUserById,
  updateUserRole,
  deleteUserById,
  updatePasswordHashById
};
