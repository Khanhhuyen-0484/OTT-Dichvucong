import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  canAdminGroupRoom,
  canManageGroupRoom,
  dedupeMembers,
  resolveMyGroupRole,
} from "../lib/groupRoles.js";
import {
  Crown,
  FileText,
  ImageIcon,
  LogOut,
  Pencil,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const GROUP_FALLBACK_AVATAR = "https://cdn-icons-png.flaticon.com/512/681/681494.png";
const AVATAR_BG = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

const ROLE_LABELS = {
  owner: "Trưởng nhóm",
  deputy: "Phó nhóm",
  member: "Thành viên",
};

function getInitials(name) {
  const n = String(name || "").trim();
  if (!n) return "?";
  const words = n.split(/\s+/).filter(Boolean);
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
}

function isDisplayableAvatarSrc(src) {
  const s = String(src || "").trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s) || s.startsWith("data:");
}

function Avatar({ src, name, className = "" }) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [src]);

  if (isDisplayableAvatarSrc(src) && !broken) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        className={className}
        onError={() => setBroken(true)}
      />
    );
  }
  const idx = (String(name || "A").charCodeAt(0) || 0) % AVATAR_BG.length;
  return (
    <div className={`${className} ${AVATAR_BG[idx]} flex items-center justify-center text-[11px] font-bold text-white`}>
      {getInitials(name)}
    </div>
  );
}

function normalizeMediaUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:") || /^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return "";
}

function getExtension(url = "", name = "") {
  const raw = String(url || name || "").split("?")[0].split("#")[0];
  return String(raw.split(".").pop() || "").toLowerCase();
}

function extractSharedAttachments(messages = [], members = []) {
  const memberMap = new Map((members || []).map((m) => [m.id, m]));
  const images = [];
  const files = [];
  const seen = new Set();

  for (const message of messages) {
    if (!message?.id || message.unsentForAll || seen.has(message.id)) continue;
    seen.add(message.id);

    const media = message.media || {};
    const url = normalizeMediaUrl(media.url || media.fileUrl || message.fileUrl);
    if (!url) continue;

    const sender =
      memberMap.get(message.senderId) ||
      message.sender ||
      { fullName: message.senderName || "Người dùng" };
    const ext = getExtension(url, media.name || message.fileName);
    const base = {
      id: message.id,
      url,
      senderName: sender.fullName || "Người dùng",
      createdAt: message.createdAt,
    };

    const isImage =
      media.type === "image" ||
      media.type === "video" ||
      ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "mp4", "webm"].includes(ext);

    const isFile =
      media.type === "file" ||
      media.type === "document" ||
      message.messageType === "file" ||
      ["pdf", "doc", "docx"].includes(ext);

    if (isImage && !isFile) {
      images.push({ ...base, type: media.type === "video" ? "video" : "image" });
    } else if (isFile) {
      files.push({
        ...base,
        name: media.name || message.fileName || message.name || "Tệp đính kèm",
        ext,
      });
    }
  }

  return {
    images: images.reverse(),
    files: files.reverse(),
  };
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function GroupInfoDrawer({
  open,
  onClose,
  activeRoom,
  user,
  myGroupRole,
  newMemberId,
  setNewMemberId,
  contacts = [],
  performGroupAction,
  onUpdateGroupMeta,
  busy = false,
  initialTab = "overview",
}) {
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  const [memberQuery, setMemberQuery] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const avatarInputRef = useRef(null);

  const effectiveRole = resolveMyGroupRole(activeRoom, user?.id) || myGroupRole;
  const canEditGroup = canManageGroupRoom(activeRoom, user?.id);
  const canAdminGroup = canAdminGroupRoom(activeRoom, user?.id);
  const isOwner = effectiveRole === "owner";

  const members = useMemo(
    () => dedupeMembers(activeRoom?.members || []),
    [activeRoom?.members]
  );

  const rawAvatar = activeRoom?.avatar || activeRoom?.avatarUrl || "";
  const groupAvatar = isDisplayableAvatarSrc(rawAvatar) ? rawAvatar : GROUP_FALLBACK_AVATAR;
  const groupName = activeRoom?.name || "Nhóm chat";

  const { images, files } = useMemo(
    () => extractSharedAttachments(activeRoom?.messages || [], members),
    [activeRoom?.messages, members]
  );

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.fullName, ROLE_LABELS[m.role]].join(" ").toLowerCase().includes(q)
    );
  }, [members, memberQuery]);

  const addableContacts = useMemo(
    () => contacts.filter((c) => !members.some((m) => m.id === c.id)),
    [contacts, members]
  );

  if (!open || activeRoom?.type !== "group") return null;

  const startEditName = () => {
    setNameDraft(groupName);
    setEditingName(true);
  };

  const saveName = () => {
    const next = nameDraft.trim();
    if (next && next !== groupName) onUpdateGroupMeta?.({ name: next });
    setEditingName(false);
  };

  const tabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "members", label: `Thành viên (${members.length})` },
    { id: "media", label: `Ảnh & File (${images.length + files.length})` },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        className="fixed inset-0 z-[64] bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-[65] flex w-full max-w-md flex-col border-l border-slate-200/80 bg-gradient-to-b from-white via-slate-50/80 to-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#003366]/70">
                Nhóm chat
              </p>
              <h2 className="text-lg font-bold text-slate-900">Thông tin nhóm</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Group hero */}
          <div className="mt-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-[#003366]/5 to-transparent p-3">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={groupAvatar}
                  alt={groupName}
                  className="h-16 w-16 rounded-2xl border-2 border-white object-cover shadow-md ring-2 ring-[#003366]/10"
                />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpdateGroupMeta?.({ avatarFile: file });
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="space-y-2">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="Nhập tên nhóm..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#003366]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !nameDraft.trim()}
                        onClick={saveName}
                        className="flex-1 rounded-xl bg-[#003366] py-2 text-xs font-semibold text-white hover:bg-[#00284f] disabled:opacity-40"
                      >
                        Lưu tên nhóm
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <h3 className="truncate text-base font-bold text-slate-900">{groupName}</h3>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {members.length} thành viên · {images.length} ảnh · {files.length} tệp
                </p>
                {activeRoom?.createdAt && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Tạo {formatWhen(activeRoom.createdAt)}
                  </p>
                )}
              </div>
            </div>

            {canEditGroup && !editingName && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#003366]/20 bg-white py-2 text-xs font-semibold text-[#003366] hover:bg-[#003366]/5 disabled:opacity-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Đổi ảnh nhóm
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={startEditName}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#003366] py-2 text-xs font-semibold text-white hover:bg-[#00284f] disabled:opacity-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Đổi tên nhóm
                </button>
              </div>
            )}
            {busy && (
              <p className="mt-2 text-center text-[11px] font-medium text-[#003366]">Đang lưu...</p>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
                  tab === t.id
                    ? "bg-white text-[#003366] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === "overview" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Users, label: "Thành viên", value: members.length },
                  { icon: ImageIcon, label: "Ảnh/Video", value: images.length },
                  { icon: FileText, label: "Tệp tin", value: files.length },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm"
                  >
                    <stat.icon className="mx-auto h-4 w-4 text-[#003366]" />
                    <div className="mt-1 text-lg font-bold text-slate-900">{stat.value}</div>
                    <div className="text-[10px] font-medium text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              {images.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Ảnh gần đây</span>
                    <button
                      type="button"
                      onClick={() => setTab("media")}
                      className="text-[11px] font-semibold text-[#003366]"
                    >
                      Xem tất cả
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {images.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewUrl(item.url)}
                        className="aspect-square overflow-hidden rounded-lg bg-slate-100"
                      >
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="mb-2 text-xs font-bold text-slate-700">Thành viên nổi bật</div>
                <div className="space-y-2">
                  {members.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Avatar
                        src={m.avatarUrl}
                        name={m.fullName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {m.fullName}
                          {m.id === user?.id && (
                            <span className="ml-1 text-[10px] text-slate-400">(Bạn)</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{ROLE_LABELS[m.role] || m.role}</div>
                      </div>
                      {m.role === "owner" && <Crown className="h-4 w-4 text-amber-500" />}
                    </div>
                  ))}
                </div>
                {members.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setTab("members")}
                    className="mt-2 w-full text-center text-[11px] font-semibold text-[#003366]"
                  >
                    Xem đủ {members.length} thành viên
                  </button>
                )}
              </section>
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-3">
              {canEditGroup && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <UserPlus className="h-4 w-4" />
                    Thêm thành viên
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newMemberId}
                      onChange={(e) => setNewMemberId(e.target.value)}
                      className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400"
                    >
                      <option value="">Chọn người cần mời...</option>
                      {addableContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!newMemberId || busy}
                      onClick={() => performGroupAction("add", newMemberId)}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Mời
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Tìm thành viên..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#003366]"
                />
              </div>

              <div className="space-y-2">
                {filteredMembers.map((m) => {
                  const isSelf = m.id === user?.id;
                  const canRemove = canAdminGroup && !isSelf && m.role !== "owner";
                  const canPromote = isOwner && m.role === "member";
                  const canDemote = isOwner && m.role === "deputy";

                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
                    >
                      <Avatar
                        src={m.avatarUrl}
                        name={m.fullName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-800">
                            {m.fullName}
                          </span>
                          {isSelf && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              Bạn
                            </span>
                          )}
                        </div>
                        <span
                          className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            m.role === "owner"
                              ? "bg-amber-100 text-amber-800"
                              : m.role === "deputy"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {canPromote && (
                          <button
                            type="button"
                            title="Phong phó nhóm"
                            disabled={busy}
                            onClick={() => performGroupAction("promote", m.id)}
                            className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDemote && (
                          <button
                            type="button"
                            title="Hạ chức phó nhóm"
                            disabled={busy}
                            onClick={() => performGroupAction("demote", m.id)}
                            className="rounded-lg bg-amber-50 p-2 text-amber-600 hover:bg-amber-100"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            title="Xóa khỏi nhóm"
                            disabled={busy}
                            onClick={() => performGroupAction("remove", m.id)}
                            className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">Không tìm thấy thành viên</p>
                )}
              </div>
            </div>
          )}

          {tab === "media" && (
            <div className="space-y-4">
              <section>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                  <ImageIcon className="h-4 w-4 text-[#003366]" />
                  Ảnh & video ({images.length})
                </div>
                {images.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                    Chưa có ảnh hoặc video trong nhóm
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewUrl(item.url)}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100"
                      >
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-left">
                          <p className="truncate text-[9px] font-medium text-white">
                            {item.senderName}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                  <FileText className="h-4 w-4 text-[#003366]" />
                  Tệp đính kèm ({files.length})
                </div>
                {files.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                    Chưa có tệp tin trong nhóm
                  </p>
                ) : (
                  <div className="space-y-2">
                    {files.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-[#003366]/30 hover:bg-slate-50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003366]/10 text-lg">
                          {item.ext === "pdf" ? "📕" : item.ext === "doc" || item.ext === "docx" ? "📘" : "📄"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {item.senderName} · {formatWhen(item.createdAt)}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 bg-white p-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => performGroupAction("leave")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Rời nhóm
          </button>
          {isOwner && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Giải tán nhóm? Hành động này không thể hoàn tác.")) {
                  performGroupAction("dissolve");
                }
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Giải tán nhóm
            </button>
          )}
        </div>
      </aside>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl("")}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            onClick={() => setPreviewUrl("")}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt="Xem trước"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
