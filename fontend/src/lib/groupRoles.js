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

/** Suy ra quy?n c?a user trong nh?m (x? l? d? li??u cu thi?u role owner). */
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

/** ??.i t?n, ?'?.i ?nh, th?m th�nh vi?n ??" m?i th�nh vi?n (gi?'ng Zalo). */
export function canManageGroupRoom(room, userId) {
  return isGroupMember(room, userId);
}

/** X?a th�nh vi?n, phong/h? ph? nh?m ??" ch?? tru?Yng nh?m / ph? nh?m. */
export function canAdminGroupRoom(room, userId) {
  const role = resolveMyGroupRole(room, userId);
  return role === "owner" || role === "deputy";
}
