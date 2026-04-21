const { GetCommand, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamo } = require("../config/dynamoClient");
const userStore = require("./userStore");

const MULTI_CHAT_ROOMS_TABLE =
  process.env.DYNAMODB_MULTI_CHAT_ROOMS_TABLE || "MultiChatRooms";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRole(role) {
  if (role === "owner" || role === "deputy") return role;
  return "member";
}

function normalizeMember(member) {
  if (!member?.id) return null;
  return {
    id: String(member.id),
    role: normalizeRole(member.role)
  };
}

function isRoomMember(room, userId) {
  return Boolean(room?.members?.some((m) => m.id === userId));
}

function getMemberRole(room, userId) {
  return room?.members?.find((m) => m.id === userId)?.role || null;
}

function canManageGroup(room, userId) {
  const role = getMemberRole(room, userId);
  return role === "owner" || role === "deputy";
}

function sanitizeMedia(media) {
  if (!media || typeof media !== "object") return null;
  const type =
    media.type === "video"
      ? "video"
      : media.type === "image"
      ? "image"
      : media.type === "file"
      ? "file"
      : null;
  const url = String(media.url || "").trim();
  if (!type || !url) return null;
  return {
    type,
    url: url.slice(0, 2000000),
    name: String(media.name || "").slice(0, 120)
  };
}

function sanitizeMessage(message) {
  const deletedFor = Array.isArray(message?.deletedFor)
    ? Array.from(new Set(message.deletedFor.map(String)))
    : [];
  return {
    id: String(message?.id || makeId("msg")),
    senderId: String(message?.senderId || ""),
    text: String(message?.text || "").slice(0, 4000),
    media: sanitizeMedia(message?.media),
    replyToMessageId: String(message?.replyToMessageId || "").trim(),
    createdAt: message?.createdAt || nowIso(),
    unsentForAll: Boolean(message?.unsentForAll),
    deletedFor
  };
}

function sanitizeRoom(room) {
  const members = Array.isArray(room?.members)
    ? room.members.map(normalizeMember).filter(Boolean)
    : [];
  const messages = Array.isArray(room?.messages) ? room.messages.map(sanitizeMessage) : [];
  return {
    id: String(room?.id || makeId("room")),
    type: room?.type === "group" ? "group" : "direct",
    name: String(room?.name || ""),
    avatarUrl: String(room?.avatarUrl || ""),
    createdBy: String(room?.createdBy || ""),
    members,
    messages,
    lastMessage: messages[messages.length - 1] || null,
    updatedAt: room?.updatedAt || nowIso(),
    createdAt: room?.createdAt || nowIso()
  };
}

async function saveRoom(room) {
  const next = sanitizeRoom(room);
  await dynamo.send(
    new PutCommand({
      TableName: MULTI_CHAT_ROOMS_TABLE,
      Item: next
    })
  );
  return next;
}

async function getRoomById(roomId) {
  const id = String(roomId || "").trim();
  if (!id) return null;
  const rs = await dynamo.send(
    new GetCommand({
      TableName: MULTI_CHAT_ROOMS_TABLE,
      Key: { id }
    })
  );
  if (!rs.Item) return null;
  return sanitizeRoom(rs.Item);
}

async function listRoomsForUser(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return [];
  const rs = await dynamo.send(new ScanCommand({ TableName: MULTI_CHAT_ROOMS_TABLE }));
  const rooms = (rs.Items || []).map(sanitizeRoom).filter((room) => isRoomMember(room, uid));
  return rooms.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function ensureDirectRoom(userA, userB) {
  const a = String(userA || "").trim();
  const b = String(userB || "").trim();
  if (!a || !b || a === b) {
    throw new Error("Không thể tạo hội thoại với người dùng này");
  }
  const existing = await listRoomsForUser(a);
  const found = existing.find((room) => {
    if (room.type !== "direct" || room.members.length !== 2) return false;
    const ids = room.members.map((m) => m.id).sort();
    return ids[0] === [a, b].sort()[0] && ids[1] === [a, b].sort()[1];
  });
  if (found) return found;

  const room = {
    id: makeId("direct"),
    type: "direct",
    createdBy: a,
    members: [
      { id: a, role: "member" },
      { id: b, role: "member" }
    ],
    messages: [],
    updatedAt: nowIso(),
    createdAt: nowIso()
  };
  return saveRoom(room);
}

async function createGroupRoom({ ownerId, name, avatarUrl, memberIds }) {
  const owner = String(ownerId || "").trim();
  const groupName = String(name || "").trim();
  const ids = Array.from(new Set((memberIds || []).map(String).filter(Boolean)));
  if (!owner || !groupName) throw new Error("Thiếu thông tin tạo nhóm");
  const finalIds = Array.from(new Set([owner, ...ids]));
  const members = finalIds.map((id) => ({
    id,
    role: id === owner ? "owner" : "member"
  }));
  const room = {
    id: makeId("group"),
    type: "group",
    name: groupName.slice(0, 120),
    avatarUrl: String(avatarUrl || "").slice(0, 500),
    createdBy: owner,
    members,
    messages: [],
    updatedAt: nowIso(),
    createdAt: nowIso()
  };
  return saveRoom(room);
}

async function appendMessage({ roomId, senderId, text, media, replyToMessageId }) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Không tìm thấy phòng chat");
  const sid = String(senderId || "").trim();
  if (!isRoomMember(room, sid)) throw new Error("Bạn không phải thành viên của phòng chat");
  const replyId = String(replyToMessageId || "").trim();
  if (replyId) {
    const target = room.messages.find((m) => m.id === replyId);
    if (!target) throw new Error("Tin nhắn trả lời không tồn tại");
  }

  const message = sanitizeMessage({
    id: makeId("msg"),
    senderId: sid,
    text,
    media,
    replyToMessageId: replyId,
    createdAt: nowIso(),
    unsentForAll: false,
    deletedFor: []
  });
  const next = {
    ...room,
    messages: [...room.messages, message],
    lastMessage: message,
    updatedAt: message.createdAt
  };
  return saveRoom(next);
}

async function unsendMessage({ roomId, messageId, requesterId }) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Không tìm thấy phòng chat");
  const rid = String(requesterId || "").trim();
  const nextMessages = room.messages.map((m) => {
    if (m.id !== messageId) return m;
    if (m.senderId !== rid) {
      throw new Error("Bạn chỉ có thể thu hồi tin nhắn của mình");
    }
    return {
      ...m,
      text: "",
      media: null,
      unsentForAll: true
    };
  });
  const next = { ...room, messages: nextMessages, updatedAt: nowIso() };
  next.lastMessage = next.messages[next.messages.length - 1] || null;
  return saveRoom(next);
}

async function deleteMessageForUser({ roomId, messageId, userId }) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Không tìm thấy phòng chat");
  const uid = String(userId || "").trim();
  if (!isRoomMember(room, uid)) throw new Error("Bạn không phải thành viên của phòng chat");
  const nextMessages = room.messages.map((m) => {
    if (m.id !== messageId) return m;
    const deletedFor = Array.from(new Set([...(m.deletedFor || []), uid]));
    return { ...m, deletedFor };
  });
  const next = { ...room, messages: nextMessages, updatedAt: nowIso() };
  next.lastMessage = next.messages[next.messages.length - 1] || null;
  return saveRoom(next);
}

async function forwardMessage({ sourceRoomId, messageId, targetRoomId, senderId }) {
  const source = await getRoomById(sourceRoomId);
  if (!source) throw new Error("Không tìm thấy phòng nguồn");
  const msg = source.messages.find((m) => m.id === messageId);
  if (!msg) throw new Error("Không tìm thấy tin nhắn");
  if (msg.unsentForAll) throw new Error("Không thể chuyển tiếp tin nhắn đã thu hồi");
  return appendMessage({
    roomId: targetRoomId,
    senderId,
    text: msg.text,
    media: msg.media
  });
}

async function addGroupMember({ roomId, requesterId, memberId }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (!canManageGroup(room, requesterId)) throw new Error("Bạn không có quyền thêm thành viên");
  const uid = String(memberId || "").trim();
  if (!uid) throw new Error("Thành viên không hợp lệ");
  if (room.members.some((m) => m.id === uid)) return room;
  const next = {
    ...room,
    members: [...room.members, { id: uid, role: "member" }],
    updatedAt: nowIso()
  };
  return saveRoom(next);
}

async function removeGroupMember({ roomId, requesterId, memberId }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (!canManageGroup(room, requesterId)) throw new Error("Bạn không có quyền xóa thành viên");
  const targetId = String(memberId || "").trim();
  const target = room.members.find((m) => m.id === targetId);
  if (!target) return room;
  if (target.role === "owner") throw new Error("Không thể xóa trưởng nhóm");
  const next = {
    ...room,
    members: room.members.filter((m) => m.id !== targetId),
    updatedAt: nowIso()
  };
  return saveRoom(next);
}

async function assignDeputy({ roomId, requesterId, memberId, enabled }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  const ownerRole = getMemberRole(room, requesterId);
  if (ownerRole !== "owner") throw new Error("Chỉ trưởng nhóm có thể gán phó nhóm");
  const targetId = String(memberId || "").trim();
  const nextMembers = room.members.map((m) => {
    if (m.id !== targetId) return m;
    if (m.role === "owner") return m;
    return { ...m, role: enabled ? "deputy" : "member" };
  });
  const next = { ...room, members: nextMembers, updatedAt: nowIso() };
  return saveRoom(next);
}

async function dissolveGroup({ roomId, requesterId }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (getMemberRole(room, requesterId) !== "owner") {
    throw new Error("Chỉ trưởng nhóm được giải tán nhóm");
  }
  const next = {
    ...room,
    members: [],
    messages: [
      ...room.messages,
      sanitizeMessage({
        id: makeId("sys"),
        senderId: requesterId,
        text: "Nhóm đã được giải tán",
        createdAt: nowIso(),
        unsentForAll: false,
        deletedFor: []
      })
    ],
    updatedAt: nowIso()
  };
  next.lastMessage = next.messages[next.messages.length - 1] || null;
  return saveRoom(next);
}

async function updateGroupInfo({ roomId, requesterId, name, avatarUrl }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (!canManageGroup(room, requesterId)) throw new Error("Bạn không có quyền cập nhật thông tin nhóm");

  const nextName = typeof name === "string" ? name.trim().slice(0, 120) : room.name;
  const nextAvatar = typeof avatarUrl === "string" ? avatarUrl.trim().slice(0, 500) : room.avatarUrl;

  const next = {
    ...room,
    name: nextName || room.name || "Nhóm chat",
    avatarUrl: nextAvatar,
    updatedAt: nowIso()
  };
  return saveRoom(next);
}

async function searchContacts({ keyword, currentUserId }) {
  const q = String(keyword || "").trim().toLowerCase();
  const rs = await dynamo.send(new ScanCommand({ TableName: process.env.USERS_TABLE || process.env.DYNAMODB_USERS_TABLE || "Users" }));
  const users = (rs.Items || []).filter((u) => u.id !== currentUserId);
  const filtered = !q
    ? users
    : users.filter((u) => {
        const fullName = String(u.fullName || "").toLowerCase();
        const email = String(u.email || "").toLowerCase();
        const phone = String(u.phone || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || phone.includes(q);
      });
  return filtered.map((u) => ({
    id: u.id,
    fullName: u.fullName || "Người dùng",
    email: u.email || "",
    phone: u.phone || "",
    avatarUrl:
      u.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || "Nguoi dung")}&size=128`
  }));
}

async function hydrateRoomForUser(room, currentUserId) {
  const users = await Promise.all(room.members.map((m) => userStore.findById(m.id).catch(() => null)));
  const userMap = {};
  users.forEach((u) => {
    if (u?.id) userMap[u.id] = u;
  });
  const members = room.members.map((m) => {
    const user = userMap[m.id];
    return {
      ...m,
      fullName: user?.fullName || "Người dùng",
      avatarUrl:
        user?.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "Nguoi dung")}&size=128`
    };
  });
  const visibleMessages = room.messages
    .filter((m) => !(m.deletedFor || []).includes(currentUserId))
    .map((m) => ({
      ...m,
      sender: members.find((x) => x.id === m.senderId) || {
        id: m.senderId,
        fullName: "Người dùng",
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("Nguoi dung")}&size=128`
      }
    }));
  const messageMap = new Map(visibleMessages.map((m) => [m.id, m]));
  const hydratedMessages = visibleMessages.map((m) => {
    const replied = m.replyToMessageId ? messageMap.get(m.replyToMessageId) : null;
    return {
      ...m,
      replyTo: replied
        ? {
            id: replied.id,
            text: replied.text,
            media: replied.media,
            senderId: replied.senderId,
            senderName: replied.sender?.fullName || "Người dùng",
            unsentForAll: Boolean(replied.unsentForAll)
          }
        : null
    };
  });
  return {
    ...room,
    members,
    messages: hydratedMessages
  };
}

module.exports = {
  listRoomsForUser,
  getRoomById,
  ensureDirectRoom,
  createGroupRoom,
  appendMessage,
  unsendMessage,
  deleteMessageForUser,
  forwardMessage,
  addGroupMember,
  removeGroupMember,
  assignDeputy,
  dissolveGroup,
  updateGroupInfo,
  searchContacts,
  hydrateRoomForUser
};
