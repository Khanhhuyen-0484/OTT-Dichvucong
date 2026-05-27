import React, { useMemo } from "react";
import { ContactRound, Search, UserPlus, Users } from "lucide-react";

const AVATAR_BG = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

function getAvatarUrl(entity) {
  if (!entity) return "";
  return entity.avatarUrl || entity.photoURL || entity.avatar || "";
}

function getInitials(name) {
  const n = String(name || "").trim();
  if (!n) return "?";
  const words = n.split(/\s+/).filter(Boolean);
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
}

function Avatar({ src, name, className = "" }) {
  if (src) return <img src={src} alt={name || "avatar"} className={className} />;
  const idx = (String(name || "A").charCodeAt(0) || 0) % AVATAR_BG.length;
  return (
    <div className={`${className} ${AVATAR_BG[idx]} flex items-center justify-center text-[11px] font-bold text-white`}>
      {getInitials(name)}
    </div>
  );
}

function latestMessageOf(item) {
  const messages = Array.isArray(item?.messages) ? item.messages.filter(Boolean) : [];
  return item?.latestMessage || item?.lastMessage || messages[messages.length - 1] || null;
}

function messageText(message, fallback = "Chưa có tin nhắn") {
  if (!message) return fallback;
  if (message.unsentForAll) return "Tin nhắn đã được thu hồi";
  const text = String(message.text || message.content || "").trim();
  if (text) return text;
  const media = message.media || message.attachment || {};
  const type = String(media.type || media.mimeType || media.fileType || "").toLowerCase();
  if (type.includes("image")) return "Đã gửi một ảnh";
  if (type.includes("video")) return "Đã gửi một video";
  if (type.includes("audio")) return "Đã gửi một tin nhắn thoại";
  if (type.includes("location") || message.location) return "Đã gửi vị trí";
  if (media.fileName || media.url || media.fileUrl) return "Đã gửi một tệp";
  return fallback;
}

function messageTime(message) {
  const value = message?.createdAt || message?.at || message?.updatedAt;
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("vi-VN", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" }).format(date);
}

function roomPreview(room, user) {
  const latest = latestMessageOf(room);
  const text = messageText(latest, room?.type === "group" ? "Nhóm chat" : "Chưa có tin nhắn");
  if (!latest || room?.type !== "group") return text;
  const mine = latest.senderId === user?.id;
  const senderName = mine ? "Bạn" : latest.senderName || latest.sender?.fullName || room?.members?.find((m) => m.id === latest.senderId)?.fullName || "";
  return senderName ? `${senderName}: ${text}` : text;
}

function ContactList({
  embedded = false,
  chatModeTab,
  setChatModeTab,
  contactQuery,
  setContactQuery,
  contacts,
  rooms,
  activeRoomId,
  setActiveRoomId,
  openDirectChat,
  openStaffChat,
  setShowGroupModal,
  onOpenAddFriend,
  onOpenFriendHub,
  pendingHubCount = 0,
  user,
  onSelectRoom,
  roomCount = 0,
  contactCount = 0,
  staffLatestMessage,
  staffUnread = 0,
}) {
  const listItems = useMemo(() => {
    if (chatModeTab === "contacts") return contacts;
    return [...rooms].sort((a, b) => {
      const am = latestMessageOf(a);
      const bm = latestMessageOf(b);
      const at = am?.createdAt || am?.at || a.updatedAt || "";
      const bt = bm?.createdAt || bm?.at || b.updatedAt || "";
      return String(bt).localeCompare(String(at));
    });
  }, [chatModeTab, contacts, rooms]);

  const shellClass = embedded
    ? "flex h-full min-h-0 flex-col p-2"
    : "flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm";

  return (
    <aside className={shellClass}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <h2 className="text-xs font-bold text-slate-800">Danh sách chat</h2>
        <button
          type="button"
          onClick={onOpenFriendHub}
          className="relative rounded-lg bg-[#eef4ff] p-1.5 text-[#0d5bd7] hover:bg-[#dfeafe]"
          title="Trung tâm bạn bè"
        >
          <ContactRound className="h-3.5 w-3.5" />
          {pendingHubCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {pendingHubCount > 9 ? "9+" : pendingHubCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-0.5">
        <button
          type="button"
          onClick={() => setChatModeTab("rooms")}
          className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition ${
            chatModeTab === "rooms" ? "bg-white text-[#003366] shadow-sm" : "text-slate-600"
          }`}
        >
          Hội thoại {roomCount > 0 ? `(${roomCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setChatModeTab("contacts")}
          className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition ${
            chatModeTab === "contacts" ? "bg-white text-[#003366] shadow-sm" : "text-slate-600"
          }`}
        >
          Bạn bè {contactCount > 0 ? `(${contactCount})` : ""}
        </button>
      </div>

      <div className="mb-2 flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            placeholder={chatModeTab === "contacts" ? "Tìm bạn" : "Tìm hội thoại"}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-[11px] focus:border-[#003366] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onOpenAddFriend}
          className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-[#113a72] hover:bg-slate-50"
          title="Thêm bạn"
        >
          <UserPlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowGroupModal(true)}
          className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-[#113a72] hover:bg-slate-50"
          title="Tạo nhóm"
        >
          <Users className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={openStaffChat}
        className="mb-2 flex w-full items-center gap-2 rounded-lg border border-[#003366]/15 bg-[#003366]/5 px-2.5 py-2 text-left hover:bg-[#003366]/10"
      >
        <Avatar src="" name="Cán bộ" className="h-8 w-8 shrink-0 rounded-full border border-[#003366]/10 object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-[#003366]">Cán bộ hỗ trợ</span>
          <span className="block truncate text-[10px] text-slate-500">{messageText(staffLatestMessage, "Hỗ trợ dịch vụ công")}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[9px] font-semibold text-slate-400">{messageTime(staffLatestMessage)}</span>
          {staffUnread > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{staffUnread > 99 ? "99+" : staffUnread}</span>
          ) : (
            <span className="rounded-full bg-[#003366] px-1.5 py-px text-[9px] font-semibold text-white">DVCT</span>
          )}
        </span>
      </button>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg bg-white/80 p-1">
        {listItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 px-2 py-8 text-center text-[11px] leading-relaxed text-slate-500">
            {chatModeTab === "contacts"
              ? "Chưa có bạn bè hợp lệ.\nBấm + để thêm bạn bè."
              : "Chưa có cuộc trò chuyện.\nTạo nhóm hoặc chat với bạn bè."}
          </div>
        )}
        {listItems.map((item) => {
          if (chatModeTab === "contacts") {
            return (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="truncate text-xs font-semibold text-slate-800">{item.fullName}</div>
                <div className="truncate text-[10px] text-slate-500">{item.phone || item.email}</div>
                <button
                  type="button"
                  onClick={() => openDirectChat(item.id)}
                  className="mt-1.5 w-full rounded-md bg-[#003366] py-1 text-[10px] font-semibold text-white hover:bg-[#00284f]"
                >
                  Chat
                </button>
              </div>
            );
          }
          const isActive = activeRoomId === item.id;
          const partner = item.members?.find((m) => m.id !== user?.id);
          const latest = latestMessageOf(item);
          const lastPreview = roomPreview(item, user);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveRoomId(item.id);
                onSelectRoom?.(item.id);
              }}
              className={`w-full rounded-lg px-2 py-1.5 text-left transition ${
                isActive ? "bg-[#003366] text-white shadow-sm" : "bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  src={
                    item.type === "group"
                      ? getAvatarUrl(item) || "https://cdn-icons-png.flaticon.com/512/681/681494.png"
                      : getAvatarUrl(partner)
                  }
                  name={item.type === "group" ? item.name || "Nhóm" : partner?.fullName || "Người dùng"}
                  className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">
                    {item.type === "group" ? item.name || "Nhóm chat" : partner?.fullName || "Hội thoại"}
                  </div>
                  <div className={`truncate text-[10px] ${isActive ? "text-white/75" : "text-slate-500"}`}>
                    {lastPreview}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`text-[9px] font-semibold ${isActive ? "text-white/65" : "text-slate-400"}`}>{messageTime(latest)}</span>
                  {(item.unreadCount || item.unread || 0) > 0 ? (
                    <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {(item.unreadCount || item.unread || 0) > 99 ? "99+" : item.unreadCount || item.unread}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {embedded && (
        <p className="mt-2 shrink-0 text-center text-[10px] text-slate-400">
          {roomCount} Hội thoại ? {contactCount} bạn bè
        </p>
      )}
    </aside>
  );
}

export default ContactList;
