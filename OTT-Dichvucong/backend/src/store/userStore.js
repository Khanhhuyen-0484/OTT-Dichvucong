const { GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "Users";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function findByEmail(email) {
  const norm = normalizeEmail(email);
  console.log('[userStore.findByEmail] Searching normalized email:', norm, 'Table:', USERS_TABLE);
  if (!norm) return null;

  const params = {
    TableName: USERS_TABLE,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": norm
    },
    Limit: 1
  };
  console.log('[userStore.findByEmail] Scan params:', params);

  const result = await dynamo.send(
    new ScanCommand(params)
  );
  console.log('[userStore.findByEmail] Scan result:', { Count: result.Count, ScannedCount: result.ScannedCount, ItemsCount: result.Items?.length || 0 });
  if (result.Items?.[0]) {
    console.log('[userStore.findByEmail] Found user:', { id: result.Items[0].id, email: result.Items[0].email });
  }
  return result.Items?.[0] || null;
}

async function findById(id) {
  if (!id) return null;
  const result = await dynamo.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { id }
    })
  );
  return result.Item || null;
}

async function createUser({
  email,
  passwordHash,
  fullName,
  phone,
  address
}) {
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
}

const PATCHABLE = new Set(["fullName", "phone", "address", "avatarUrl"]);

async function updateUserById(id, patch) {
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
}

async function deleteUserById(id) {
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
}

async function updateUserRole(id, role) {
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
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  normalizeEmail,
  updateUserById,
  updateUserRole,
  deleteUserById
};
