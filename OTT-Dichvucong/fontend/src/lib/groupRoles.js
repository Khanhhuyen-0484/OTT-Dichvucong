const ROLE_RANK = { owner: 3, deputy: 2, member: 1 };

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
  const createdBy = String(room.createdBy || "").trim();
  if (createdBy && createdBy === uid) return true;
  return dedupeMembers(room.members || []).some((m) => String(m.id || "").trim() === uid);
}

/** Suy ra quyền của user trong nhóm (xử lý dữ liệu cũ thiếu role owner). */
export function resolveMyGroupRole(room, userId) {
  if (!room || room.type !== "group" || !userId) return null;

  const uid = String(userId).trim();
  const creatorId = String(room.createdBy || "").trim();
  const members = dedupeMembers(room.members || []);

  const mine = members.filter((m) => m.id === uid);
  const roles = mine.map((m) => m.role).filter(Boolean);

  if (roles.includes("owner")) return "owner";
  if (roles.includes("deputy")) return "deputy";
  if (creatorId && creatorId === uid) return "owner";

  return roles[0] || (members.some((m) => m.id === uid) ? "member" : null);
}

/** Đổi tên, đổi ảnh, thêm thành viên — mọi thành viên (giống Zalo). */
export function canManageGroupRoom(room, userId) {
  return isGroupMember(room, userId);
}

/** Xóa thành viên, phong/hạ phó nhóm — chỉ trưởng nhóm / phó nhóm. */
export function canAdminGroupRoom(room, userId) {
  const role = resolveMyGroupRole(room, userId);
  return role === "owner" || role === "deputy";
}
