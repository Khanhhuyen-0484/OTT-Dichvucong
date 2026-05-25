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

function uniqueIds(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean)));
}

function normalizeRole(role) {
  if (role === "owner" || role === "deputy") return role;
  return "member";
}

function normalizeMember(member, createdBy = "") {
  if (typeof member === "string" || typeof member === "number") {
    const id = String(member).trim();
    if (!id) return null;
    const role = id === String(createdBy || "").trim() ? "owner" : "member";
    return { id, role: normalizeRole(role) };
  }
  const id = String(member?.id || member?.userId || "").trim();
  if (!id) return null;
  let role = normalizeRole(member?.role);
  if (id === String(createdBy || "").trim()) role = "owner";
  return { id, role };
}

const ROLE_RANK = { owner: 3, deputy: 2, member: 1 };

function normalizeMembersList(rawMembers = [], createdBy = "") {
  const creatorId = String(createdBy || "").trim();
  const map = new Map();

  (Array.isArray(rawMembers) ? rawMembers : []).forEach((entry) => {
    const normalized = normalizeMember(entry, creatorId);
    if (!normalized) return;
    const prev = map.get(normalized.id);
    if (!prev || (ROLE_RANK[normalized.role] || 0) > (ROLE_RANK[prev.role] || 0)) {
      map.set(normalized.id, normalized);
    }
  });

  if (creatorId && !map.has(creatorId)) {
    map.set(creatorId, { id: creatorId, role: "owner" });
  } else if (creatorId && map.has(creatorId)) {
    map.set(creatorId, { ...map.get(creatorId), role: "owner" });
  }

  return Array.from(map.values());
}

function isRoomMember(room, userId) {
  const uid = String(userId || "").trim();
  if (!uid || !room) return false;
  const createdBy = String(room.createdBy || "").trim();
  if (createdBy && createdBy === uid) return true;
  return Boolean(
    room.members?.some((m) => String(m?.id || "").trim() === uid)
  );
}

function getMemberRole(room, userId) {
  const uid = String(userId || "").trim();
  if (!uid || !room) return null;
  const member = room.members?.find((m) => m.id === uid);
  if (member?.role === "owner" || member?.role === "deputy") return member.role;
  if (String(room.createdBy || "").trim() === uid) return "owner";
  return member?.role || null;
}

/** Trưởng/phó nhóm — xóa thành viên, phong phó nhóm, giải tán. */
function canManageGroup(room, userId) {
  const role = getMemberRole(room, userId);
  return role === "owner" || role === "deputy";
}

/** Mọi thành viên trong nhóm (giống Zalo): đổi tên, đổi ảnh, thêm bạn. */
function canEditGroupSettings(room, userId) {
  return isRoomMember(room, userId);
}


function normalizePublicUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw;
}

function sanitizeMedia(media) {
  if (!media || typeof media !== "object") return null;
  const type =
    media.type === "video"
      ? "video"
      : media.type === "image"
        ? "image"
        : media.type === "location"
          ? "location"
          : media.type === "file" || media.type === "document"
            ? "document"
            : null;
  const url = normalizePublicUrl(media.url || media.fileUrl || media.image || media.attachmentUrl || "");
  const hasLocation = media.latitude != null && media.longitude != null;
  if (!type && !hasLocation) return null;
  if ((type === "image" || type === "video" || type === "document") && !url) return null;
  return {
    type: type || "location",
    url: url.slice(0, 2000000),
    name: String(media.name || media.label || "").slice(0, 120),
    fileUrl: String(media.fileUrl || media.url || media.image || "").slice(0, 2000000),
    fileType: String(media.fileType || "").slice(0, 20),
    fileSize: Number(media.fileSize || media.size || 0) || 0,
    latitude: hasLocation ? Number(media.latitude) : undefined,
    longitude: hasLocation ? Number(media.longitude) : undefined,
    mapsUrl: String(media.mapsUrl || "").slice(0, 500),
    address: String(media.address || "").slice(0, 240),
    label: String(media.label || "").slice(0, 160)
  };
}

function sanitizeLocation(location) {
  if (!location || typeof location !== "object") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    label: String(location.label || "").slice(0, 160),
    address: String(location.address || "").slice(0, 240),
    mapsUrl: String(location.mapsUrl || `https://www.google.com/maps?q=${latitude},${longitude}`).slice(0, 500)
  };
}

function sanitizeMessage(message) {
  const deletedFor = Array.isArray(message?.deletedFor)
    ? Array.from(new Set(message.deletedFor.map(String)))
    : [];
  const media = sanitizeMedia(message?.media);
  return {
    id: String(message?.id || makeId("msg")),
    senderId: String(message?.senderId || ""),
    messageType: String(message?.messageType || (message?.location ? "location" : "text")),
    text: String(message?.text || "").slice(0, 4000),
    media,
    location: sanitizeLocation(message?.location),
    callLog: message?.callLog && typeof message.callLog === "object"
      ? {
          status: String(message.callLog.status || "").slice(0, 32),
          durationSec: Number(message.callLog.durationSec || 0) || 0,
          roomId: String(message.callLog.roomId || "").slice(0, 120),
          callerId: String(message.callLog.callerId || "").slice(0, 120),
          callerName: String(message.callLog.callerName || "").slice(0, 120),
          endedBy: String(message.callLog.endedBy || "").slice(0, 120)
        }
      : null,
    replyToMessageId: String(message?.replyToMessageId || "").trim(),
    createdAt: message?.createdAt || nowIso(),
    unsentForAll: Boolean(message?.unsentForAll),
    isPinned: Boolean(message?.isPinned || message?.pinned),
    pinned: Boolean(message?.isPinned || message?.pinned),
    pinnedAt: message?.pinnedAt || null,
    pinnedBy: String(message?.pinnedBy || "").trim(),
    deletedFor
  };
}

function sanitizeRoom(room) {
  const createdBy = String(room?.createdBy || "").trim();
  const members = normalizeMembersList(room?.members, createdBy);
  const messages = Array.isArray(room?.messages) ? room.messages.map(sanitizeMessage) : [];
  const pendingInvites = Array.isArray(room?.pendingInvites)
    ? room.pendingInvites
        .map((invite) => ({
          userId: String(invite?.userId || "").trim(),
          invitedBy: String(invite?.invitedBy || "").trim(),
          createdAt: invite?.createdAt || nowIso()
        }))
        .filter((invite) => invite.userId && invite.invitedBy)
    : [];
  return {
    id: String(room?.id || makeId("room")),
    type: room?.type === "group" ? "group" : "direct",
    name: String(room?.name || ""),
    avatarUrl: (() => {
      const raw = String(room?.avatarUrl || room?.avatar || "").trim();
      return /^https?:\/\//i.test(raw) ? raw.slice(0, 500) : "";
    })(),
    createdBy,
    members,
    pendingInvites,
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
  try {
    const rs = await dynamo.send(new ScanCommand({ TableName: MULTI_CHAT_ROOMS_TABLE }));
    const rooms = (rs.Items || []).map(sanitizeRoom).filter((room) => isRoomMember(room, uid));
    return rooms.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } catch (error) {
    console.error("[multiChatStore.listRoomsForUser]", error?.name, error?.message, error);
    throw error;
  }
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

async function appendMessage({ roomId, senderId, text, media, location, replyToMessageId }) {
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
    messageType: location ? "location" : "text",
    text,
    media,
    location,
    replyToMessageId: replyId,
    createdAt: nowIso(),
    unsentForAll: false,
    pinned: false,
    pinnedAt: null,
    pinnedBy: "",
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

async function appendCallLogMessage({
  roomId,
  actorUserId,
  status,
  durationSec = 0,
  callRoomId = "",
  callerId = "",
  callerName = "",
  endedBy = ""
}) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Không tìm thấy phòng chat");
  const sid = String(actorUserId || "").trim();
  if (!sid || !isRoomMember(room, sid)) throw new Error("Bạn không phải thành viên của phòng chat");

  const message = sanitizeMessage({
    id: makeId("msg"),
    senderId: sid,
    messageType: "call_log",
    text: "",
    media: null,
    callLog: {
      status,
      durationSec,
      roomId: callRoomId,
      callerId,
      callerName,
      endedBy
    },
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

async function inviteMembersToGroup({ roomId, requesterId, memberIds }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (!canEditGroupSettings(room, requesterId)) throw new Error("Bạn không phải thành viên của nhóm");
  const ids = uniqueIds(memberIds);
  if (!ids.length) throw new Error("Chưa chọn bạn bè để mời");

  const existingMemberIds = room.members.map((member) => member.id);
  const pendingMap = new Map((room.pendingInvites || []).map((invite) => [invite.userId, invite]));
  ids.forEach((userId) => {
    if (existingMemberIds.includes(userId)) return;
    pendingMap.set(userId, {
      userId,
      invitedBy: requesterId,
      createdAt: nowIso()
    });
  });

  const next = {
    ...room,
    pendingInvites: Array.from(pendingMap.values()),
    updatedAt: nowIso()
  };
  return saveRoom(next);
}

async function listGroupInvitesForUser(userId) {
  const rooms = await listRoomsForUser(userId);
  const allRooms = await dynamo.send(new ScanCommand({ TableName: MULTI_CHAT_ROOMS_TABLE }));
  const visibleGroupIds = new Set(rooms.map((room) => room.id));
  return (allRooms.Items || [])
    .map(sanitizeRoom)
    .filter((room) => room.type === "group" && !visibleGroupIds.has(room.id))
    .filter((room) => (room.pendingInvites || []).some((invite) => invite.userId === userId));
}

async function respondToGroupInvite({ roomId, userId, action }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  const invite = (room.pendingInvites || []).find((item) => item.userId === userId);
  if (!invite) throw new Error("Không tìm thấy lời mời vào nhóm");

  const next = {
    ...room,
    pendingInvites: (room.pendingInvites || []).filter((item) => item.userId !== userId),
    updatedAt: nowIso()
  };
  if (action === "accept" && !next.members.some((member) => member.id === userId)) {
    next.members = [...next.members, { id: userId, role: "member" }];
  }
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
      location: null,
      unsentForAll: true,
      pinned: false,
      pinnedAt: null,
      pinnedBy: ""
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
  const target = room.messages.find((m) => m.id === messageId);
  if (!target) throw new Error("Không tìm thấy tin nhắn");
  const nextMessages = room.messages.map((m) => {
    if (m.id !== messageId) return m;
    const deletedFor = Array.from(new Set([...(m.deletedFor || []), uid]));
    return {
      ...m,
      deletedFor,
      pinned: false,
      isPinned: false,
      pinnedAt: null,
      pinnedBy: ""
    };
  });
  const next = { ...room, messages: nextMessages, updatedAt: nowIso() };
  next.lastMessage = next.messages[next.messages.length - 1] || null;
  return saveRoom(next);
}

const MAX_PINNED_MESSAGES = 3;

async function togglePinMessage({ roomId, messageId, requesterId }) {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("Không tìm thấy phòng chat");
  const rid = String(requesterId || "").trim();
  if (!isRoomMember(room, rid)) throw new Error("Bạn không phải thành viên của phòng chat");

  const target = room.messages.find((m) => m.id === messageId);
  if (!target) throw new Error("Không tìm thấy tin nhắn");
  if (target.unsentForAll) throw new Error("Không thể ghim tin nhắn đã thu hồi");

  const isCurrentlyPinned = Boolean(target.pinned || target.isPinned);
  const nextPinnedState = !isCurrentlyPinned;
  const pinnedCount = room.messages.filter((m) => m.pinned || m.isPinned).length;

  if (nextPinnedState && pinnedCount >= MAX_PINNED_MESSAGES) {
    throw new Error(`Chỉ ghim tối đa ${MAX_PINNED_MESSAGES} tin nhắn`);
  }

  const nextMessages = room.messages.map((m) => {
    if (m.id === messageId) {
      return {
        ...m,
        pinned: nextPinnedState,
        isPinned: nextPinnedState,
        pinnedAt: nextPinnedState ? nowIso() : null,
        pinnedBy: nextPinnedState ? rid : ""
      };
    }
    return m;
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
    media: msg.media,
    location: msg.location
  });
}

async function addGroupMember({ roomId, requesterId, memberId }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (!canEditGroupSettings(room, requesterId)) throw new Error("Bạn không phải thành viên của nhóm");
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
  const targetId = String(memberId || "").trim();
  const requester = String(requesterId || "").trim();
  const isSelfLeave = targetId && targetId === requester;
  if (isSelfLeave) {
    if (!isRoomMember(room, requester)) throw new Error("Bạn không phải thành viên của nhóm");
  } else if (!canManageGroup(room, requesterId)) {
    throw new Error("Bạn không có quyền xóa thành viên");
  }
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

async function updateGroupRoom({ roomId, requesterId, name, avatarUrl }) {
  const room = await getRoomById(roomId);
  if (!room || room.type !== "group") throw new Error("Không tìm thấy nhóm chat");
  if (!canEditGroupSettings(room, requesterId)) {
    throw new Error("Bạn không phải thành viên của nhóm");
  }

  const nextName = name !== undefined ? String(name || "").trim() : room.name;
  if (!nextName) throw new Error("Tên nhóm không được để trống");

  const next = {
    ...room,
    name: nextName.slice(0, 120),
    avatarUrl:
      avatarUrl !== undefined ? String(avatarUrl || "").slice(0, 500) : room.avatarUrl,
    updatedAt: nowIso()
  };
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

async function searchContacts({ keyword, currentUserId }) {
  return await userStore.listFriends(currentUserId, keyword);
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
  appendCallLogMessage,
  unsendMessage,
  deleteMessageForUser,
  togglePinMessage,
  forwardMessage,
  addGroupMember,
  removeGroupMember,
  assignDeputy,
  updateGroupRoom,
  dissolveGroup,
  inviteMembersToGroup,
  listGroupInvitesForUser,
  respondToGroupInvite,
  searchContacts,
  hydrateRoomForUser
};
