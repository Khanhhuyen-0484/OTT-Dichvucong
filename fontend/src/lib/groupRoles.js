const ROLE_RANK = { owner: 3, deputy: 2, member: 1 };

function getLegacyOwnerId(room, members = []) {
  const explicit = String(
    room?.createdBy || room?.ownerId || room?.creatorId || room?.createdById || ""
  ).trim();
  if (explicit) return explicit;

  const owner = members.find((member) => member?.role === "owner");
  return String(owner?.id || members[0]?.id || "").trim();
}

export function dedupeMembers(members = []) {
  const map = new Map();
  for (const member of members) {
    if (!member?.id) continue;
    const prev = map.get(member.id);
    if (!prev || (ROLE_RANK[member.role] || 0) > (ROLE_RANK[prev.role] || 0)) {
      map.set(member.id, member);
    }
  }
  return Array.from(map.values());
}

export function isGroupMember(room, userId) {
  if (!room || room.type !== "group" || !userId) return false;
  const uid = String(userId).trim();
  const members = dedupeMembers(room.members || []);
  const createdBy = getLegacyOwnerId(room, members);
  if (createdBy && createdBy === uid) return true;
  return members.some((m) => String(m.id || "").trim() === uid);
}

/** Suy ra quyền của user trong nhóm, xử lý dữ liệu cũ thiếu role owner. */
export function resolveMyGroupRole(room, userId) {
  if (!room || room.type !== "group" || !userId) return null;

  const uid = String(userId).trim();
  const members = dedupeMembers(room.members || []);
  const creatorId = getLegacyOwnerId(room, members);

  const mine = members.filter((m) => m.id === uid);
  const roles = mine.map((m) => m.role).filter(Boolean);

  if (roles.includes("owner")) return "owner";
  if (roles.includes("deputy")) return "deputy";
  if (creatorId && creatorId === uid) return "owner";

  return roles[0] || (members.some((m) => m.id === uid) ? "member" : null);
}

/** Đổi tên, đổi ảnh, thêm thành viên cho mọi thành viên trong nhóm. */
export function canManageGroupRoom(room, userId) {
  return isGroupMember(room, userId);
}

/** Xóa thành viên, phong/hạ phó nhóm chỉ dành cho trưởng/phó nhóm. */
export function canAdminGroupRoom(room, userId) {
  const role = resolveMyGroupRole(room, userId);
  return role === "owner" || role === "deputy";
}
