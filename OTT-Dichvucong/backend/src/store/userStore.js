const { GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");

const USERS_TABLE = process.env.USERS_TABLE || process.env.DYNAMODB_USERS_TABLE || "Users";

function getClient() {
  try {
    return getDynamoClient();
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function findByEmail(email) {
  try {
    const norm = String(email || "").trim().toLowerCase();
    if (!norm) return null;

    const client = getClient();
    if (!client) return null;

    const params = {
      TableName: USERS_TABLE,
      FilterExpression: "#emailLower = :email",
      ExpressionAttributeNames: {
        "#emailLower": "email",
      },
      ExpressionAttributeValues: {
        ":email": norm,
      },
      Limit: 1,
    };

    const result = await client.send(new ScanCommand(params));
    if (result.Items?.[0]) return result.Items[0];

    const fallbackResult = await client.send(new ScanCommand({ TableName: USERS_TABLE }));
    const fallbackItem = (fallbackResult.Items || []).find((item) => {
      const emailLower = String(item?.email || "").trim().toLowerCase();
      const emailUpper = String(item?.Email || "").trim().toLowerCase();
      return emailLower === norm || emailUpper === norm;
    });
    return fallbackItem || null;
  } catch (error) {
    console.error("[userStore.findByEmail] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

async function findById(id) {
  try {
    if (!id) return null;
    const client = getClient();
    if (!client) return null;
    const result = await client.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { id },
      })
    );
    return result.Item || null;
  } catch (error) {
    console.error("[userStore.findById] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

function uniqueIds(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean)));
}

function withFriendFields(user) {
  if (!user) return null;
  return {
    ...user,
    friendIds: uniqueIds(user.friendIds),
    incomingFriendRequestIds: uniqueIds(user.incomingFriendRequestIds),
    outgoingFriendRequestIds: uniqueIds(user.outgoingFriendRequestIds),
    blockedUserIds: uniqueIds(user.blockedUserIds),
  };
}

function sanitizePublicUser(user) {
  const safe = withFriendFields(user);
  if (!safe) return null;
  return {
    id: safe.id,
    fullName: safe.fullName || "Người dùng",
    email: safe.email || "",
    phone: safe.phone || "",
    avatarUrl:
      safe.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(safe.fullName || "Nguoi dung")}&size=128`,
    friendIds: safe.friendIds,
    incomingFriendRequestIds: safe.incomingFriendRequestIds,
    outgoingFriendRequestIds: safe.outgoingFriendRequestIds,
    blockedUserIds: safe.blockedUserIds,
  };
}

function normalizePhoneQuery(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function detectFriendLookupMode(keyword = "") {
  const raw = String(keyword || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) return "email";
  const digits = normalizePhoneQuery(raw);
  if (digits.length >= 8) return "phone";
  return null;
}

async function listUsers() {
  try {
    const client = getClient();
    if (!client) return [];
    const result = await client.send(new ScanCommand({ TableName: USERS_TABLE }));
    return (result.Items || []).map(withFriendFields);
  } catch (error) {
    console.error("[userStore.listUsers] DynamoDB error:", error?.name, error?.message, error);
    return [];
  }
}

async function saveUserRecord(user) {
  const client = getClient();
  if (!client) throw new Error("Chưa cấu hình DynamoDB");
  const next = withFriendFields(user);
  await client.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: next,
    })
  );
  return next;
}

async function searchUsersForFriendAdd(currentUserId, keyword = "") {
  const current = withFriendFields(await findById(currentUserId));
  if (!current) return [];
  const q = String(keyword || "").trim().toLowerCase();
  const mode = detectFriendLookupMode(keyword);
  if (!mode) return [];
  const phoneQuery = normalizePhoneQuery(keyword);
  const users = await listUsers();
  const filtered = users.filter((item) => {
    if (!item?.id || item.id === currentUserId) return false;
    if (current.blockedUserIds.includes(item.id) || item.blockedUserIds?.includes(currentUserId)) return false;
    if (mode === "email") {
      return String(item.email || "").toLowerCase().includes(q);
    }
    return normalizePhoneQuery(item.phone).includes(phoneQuery);
  });

  return filtered.map((item) => {
    let status = "none";
    if (current.friendIds.includes(item.id)) status = "friend";
    else if (current.outgoingFriendRequestIds.includes(item.id)) status = "outgoing";
    else if (current.incomingFriendRequestIds.includes(item.id)) status = "incoming";

    return {
      ...sanitizePublicUser(item),
      status,
    };
  });
}

async function listFriends(userId, keyword = "") {
  const current = withFriendFields(await findById(userId));
  if (!current) return [];
  const q = String(keyword || "").trim().toLowerCase();
  const users = await Promise.all(current.friendIds.map((id) => findById(id).catch(() => null)));
  return users
    .map(withFriendFields)
    .filter((item) => item && !current.blockedUserIds.includes(item.id) && !item.blockedUserIds.includes(userId))
    .map(sanitizePublicUser)
    .filter(Boolean)
    .filter((item) => {
      if (!q) return true;
      return [item.fullName, item.email, item.phone]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(q));
    });
}

async function listIncomingFriendRequests(userId) {
  const current = withFriendFields(await findById(userId));
  if (!current) return [];
  const users = await Promise.all(
    current.incomingFriendRequestIds.map((id) => findById(id).catch(() => null))
  );
  return users.map((item) => ({ ...sanitizePublicUser(item), status: "incoming" })).filter(Boolean);
}

async function listOutgoingFriendRequests(userId) {
  const current = withFriendFields(await findById(userId));
  if (!current) return [];
  const users = await Promise.all(
    current.outgoingFriendRequestIds.map((id) => findById(id).catch(() => null))
  );
  return users.map((item) => ({ ...sanitizePublicUser(item), status: "outgoing" })).filter(Boolean);
}

async function listSuggestedFriends(userId, limit = 5) {
  const current = withFriendFields(await findById(userId));
  if (!current) return [];
  const users = await listUsers();
  return users
    .filter((item) => item?.id && item.id !== userId)
    .filter((item) => !current.friendIds.includes(item.id))
    .filter((item) => !current.incomingFriendRequestIds.includes(item.id))
    .filter((item) => !current.outgoingFriendRequestIds.includes(item.id))
    .filter((item) => !current.blockedUserIds.includes(item.id) && !item.blockedUserIds?.includes(userId))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, Math.max(1, Number(limit) || 5))
    .map((item) => ({ ...sanitizePublicUser(item), status: "none" }));
}

async function listBlockedUsers(userId) {
  const current = withFriendFields(await findById(userId));
  if (!current) return [];
  const users = await Promise.all(current.blockedUserIds.map((id) => findById(id).catch(() => null)));
  return users.map(sanitizePublicUser).filter(Boolean);
}

async function sendFriendRequest(senderId, targetId) {
  const sender = withFriendFields(await findById(senderId));
  const target = withFriendFields(await findById(targetId));
  if (!sender || !target) throw new Error("Không tìm thấy người dùng");
  if (sender.id === target.id) throw new Error("Không thể kết bạn với chính mình");
  if (sender.blockedUserIds.includes(target.id) || target.blockedUserIds.includes(sender.id)) {
    throw new Error("Không thể kết bạn với người dùng này");
  }

  if (sender.friendIds.includes(target.id)) {
    return { status: "friend", user: { ...sanitizePublicUser(target), status: "friend" } };
  }

  if (sender.incomingFriendRequestIds.includes(target.id) || target.outgoingFriendRequestIds.includes(sender.id)) {
    return await respondToFriendRequest(sender.id, target.id, "accept");
  }

  if (!sender.outgoingFriendRequestIds.includes(target.id)) {
    sender.outgoingFriendRequestIds.push(target.id);
  }
  if (!target.incomingFriendRequestIds.includes(sender.id)) {
    target.incomingFriendRequestIds.push(sender.id);
  }

  await Promise.all([saveUserRecord(sender), saveUserRecord(target)]);
  return { status: "outgoing", user: { ...sanitizePublicUser(target), status: "outgoing" } };
}

async function respondToFriendRequest(userId, requesterId, action = "accept") {
  const current = withFriendFields(await findById(userId));
  const requester = withFriendFields(await findById(requesterId));
  if (!current || !requester) throw new Error("Không tìm thấy người dùng");

  current.incomingFriendRequestIds = current.incomingFriendRequestIds.filter((id) => id !== requester.id);
  requester.outgoingFriendRequestIds = requester.outgoingFriendRequestIds.filter((id) => id !== current.id);

  if (action === "accept") {
    current.friendIds = uniqueIds([...current.friendIds, requester.id]);
    requester.friendIds = uniqueIds([...requester.friendIds, current.id]);
  }

  await Promise.all([saveUserRecord(current), saveUserRecord(requester)]);
  const status = action === "accept" ? "friend" : "none";
  return { status, user: { ...sanitizePublicUser(requester), status } };
}

async function revokeFriendRequest(senderId, targetUserId) {
  const sender = withFriendFields(await findById(senderId));
  const target = withFriendFields(await findById(targetUserId));
  if (!sender || !target) throw new Error("Không tìm thấy người dùng");

  sender.outgoingFriendRequestIds = sender.outgoingFriendRequestIds.filter((id) => id !== target.id);
  target.incomingFriendRequestIds = target.incomingFriendRequestIds.filter((id) => id !== sender.id);

  await Promise.all([saveUserRecord(sender), saveUserRecord(target)]);
  return { ok: true, status: "none", user: { ...sanitizePublicUser(target), status: "none" } };
}

async function removeFriend(userId, targetUserId) {
  const current = withFriendFields(await findById(userId));
  const target = withFriendFields(await findById(targetUserId));
  if (!current || !target) throw new Error("Không tìm thấy người dùng");

  current.friendIds = current.friendIds.filter((id) => id !== target.id);
  target.friendIds = target.friendIds.filter((id) => id !== current.id);
  current.incomingFriendRequestIds = current.incomingFriendRequestIds.filter((id) => id !== target.id);
  current.outgoingFriendRequestIds = current.outgoingFriendRequestIds.filter((id) => id !== target.id);
  target.incomingFriendRequestIds = target.incomingFriendRequestIds.filter((id) => id !== target.id);
  target.outgoingFriendRequestIds = target.outgoingFriendRequestIds.filter((id) => id !== current.id);

  await Promise.all([saveUserRecord(current), saveUserRecord(target)]);
  return { ok: true };
}

async function blockUser(userId, targetUserId) {
  const current = withFriendFields(await findById(userId));
  const target = withFriendFields(await findById(targetUserId));
  if (!current || !target) throw new Error("Không tìm thấy người dùng");
  if (current.id === target.id) throw new Error("Không thể chặn chính mình");

  current.blockedUserIds = uniqueIds([...current.blockedUserIds, target.id]);
  current.friendIds = current.friendIds.filter((id) => id !== target.id);
  target.friendIds = target.friendIds.filter((id) => id !== current.id);
  current.incomingFriendRequestIds = current.incomingFriendRequestIds.filter((id) => id !== target.id);
  current.outgoingFriendRequestIds = current.outgoingFriendRequestIds.filter((id) => id !== target.id);
  target.incomingFriendRequestIds = target.incomingFriendRequestIds.filter((id) => id !== current.id);
  target.outgoingFriendRequestIds = target.outgoingFriendRequestIds.filter((id) => id !== current.id);

  await Promise.all([saveUserRecord(current), saveUserRecord(target)]);
  return { ok: true };
}

async function unblockUser(userId, targetUserId) {
  const current = withFriendFields(await findById(userId));
  if (!current) throw new Error("Không tìm thấy người dùng");
  current.blockedUserIds = current.blockedUserIds.filter((id) => id !== String(targetUserId || "").trim());
  await saveUserRecord(current);
  return { ok: true };
}

async function createUser({ email, passwordHash, fullName, phone, address }) {
  try {
    const norm = normalizeEmail(email);
    const existing = await findByEmail(norm);
    if (existing) {
      const err = new Error("Email already exists");
      err.code = "EMAIL_EXISTS";
      throw err;
    }
    const client = getClient();
    if (!client) throw new Error("Chưa cấu hình DynamoDB");
    const user = {
      id: `u_${Date.now()}`,
      email: norm,
      fullName: String(fullName || "").trim(),
      phone: String(phone || "").trim(),
      address: String(address || "").trim(),
      role: "citizen",
      avatarUrl: "",
      passwordHash,
      friendIds: [],
      incomingFriendRequestIds: [],
      outgoingFriendRequestIds: [],
      blockedUserIds: [],
      createdAt: new Date().toISOString(),
    };
    await client.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: user,
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
    const client = getClient();
    if (!client) return null;
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

    const result = await client.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${setExpr}, updatedAt = :updatedAt`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: {
          ...values,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updateUserById] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

async function updateUserAvatar(userId, avatarUrl) {
  return updateUserById(userId, { avatarUrl });
}

async function deleteUserById(id) {
  try {
    if (!id) return false;
    const client = getClient();
    if (!client) return false;
    const existing = await findById(id);
    if (!existing) return false;
    await client.send(
      new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { id },
      })
    );
    return Boolean(existing);
  } catch (error) {
    console.error("[userStore.deleteUserById] DynamoDB error:", error?.name, error?.message, error);
    return false;
  }
}

async function updateUserRole(id, role) {
  try {
    if (!id) return null;
    const client = getClient();
    if (!client) return null;
    const validRoles = ["citizen", "admin"];
    if (!validRoles.includes(role)) {
      const err = new Error("Invalid role");
      err.code = "INVALID_ROLE";
      throw err;
    }

    const result = await client.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: "SET #role = :role, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#role": "role",
        },
        ExpressionAttributeValues: {
          ":role": role,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updateUserRole] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

async function updatePasswordHashById(id, passwordHash) {
  try {
    if (!id || !passwordHash) return null;
    const client = getClient();
    if (!client) return null;
    const result = await client.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: "SET passwordHash = :password_hash, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":password_hash": String(passwordHash),
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes || null;
  } catch (error) {
    console.error("[userStore.updatePasswordHashById] DynamoDB error:", error?.name, error?.message, error);
    return null;
  }
}

module.exports = {
  findByEmail,
  findById,
  listUsers,
  listFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  listSuggestedFriends,
  listBlockedUsers,
  searchUsersForFriendAdd,
  sendFriendRequest,
  respondToFriendRequest,
  revokeFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  createUser,
  normalizeEmail,
  updateUserById,
  updateUserAvatar,
  updateUserRole,
  deleteUserById,
  updatePasswordHashById,
  sanitizePublicUser,
  detectFriendLookupMode,
};
