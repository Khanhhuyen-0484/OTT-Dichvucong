import React, { useMemo, useState } from "react";
import {
  ContactRound,
  MessageCircle,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";

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
  onRequestDeleteRoom,
}) {
  const [openRoomMenuId, setOpenRoomMenuId] = useState(null);

  const listItems = useMemo(() => {
    const query = String(contactQuery || "").trim().toLowerCase();
    if (chatModeTab === "contacts") {
      return contacts.filter((contact) =>
        [contact.fullName, contact.email, contact.phone].join(" ").toLowerCase().includes(query)
      );
    }
    return [...rooms]
      .filter((room) => {
        if (!query) return true;
        const partner = room.members?.find((m) => m.id !== user?.id);
        return [
          room.name,
          partner?.fullName,
          partner?.email,
          roomPreview(room, user)
        ].join(" ").toLowerCase().includes(query);
      })
      .sort((a, b) => {
      const am = latestMessageOf(a);
      const bm = latestMessageOf(b);
      const at = am?.createdAt || am?.at || a.updatedAt || "";
      const bt = bm?.createdAt || bm?.at || b.updatedAt || "";
      return String(bt).localeCompare(String(at));
    });
  }, [chatModeTab, contactQuery, contacts, rooms, user]);

  const shellClass = embedded
    ? "flex h-full min-h-0 flex-col bg-linear-to-b from-white via-blue-50/30 to-white p-3"
    : "flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-linear-to-b from-white via-blue-50/30 to-white p-4 shadow-xl shadow-blue-950/8";

  return (
    <aside className={shellClass}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#003366] ring-1 ring-blue-100">
            <Sparkles className="h-3 w-3" />
            Trò chuyện
          </div>
          <h2 className="mt-2 text-base font-black text-slate-950">Danh sách chat</h2>
        </div>
        <button
          type="button"
          onClick={onOpenFriendHub}
          className="relative rounded-2xl bg-white p-2.5 text-[#003366] shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-50"
          title="Trung tâm bạn bè"
        >
          <ContactRound className="h-4 w-4" />
          {pendingHubCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {pendingHubCount > 9 ? "9+" : pendingHubCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-200/60">
        <button
          type="button"
          onClick={() => setChatModeTab("rooms")}
          className={`rounded-xl px-3 py-2 text-xs font-black transition ${
            chatModeTab === "rooms" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Hội thoại {roomCount > 0 ? `(${roomCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setChatModeTab("contacts")}
          className={`rounded-xl px-3 py-2 text-xs font-black transition ${
            chatModeTab === "contacts" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Bạn bè {contactCount > 0 ? `(${contactCount})` : ""}
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            placeholder={chatModeTab === "contacts" ? "Tìm bạn" : "Tìm hội thoại"}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={onOpenAddFriend}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-white text-[#003366] shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
          title="Thêm bạn"
        >
          <UserPlus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowGroupModal(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-white text-[#003366] shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
          title="Tạo nhóm"
        >
          <Users className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={openStaffChat}
        className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
      >
        <div className="relative">
          <Avatar src="" name="Cán bộ" className="h-11 w-11 shrink-0 rounded-2xl border border-[#003366]/10 object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
            <ShieldCheck className="h-3 w-3" />
          </span>
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-slate-900">Cán bộ hỗ trợ</span>
          <span className="block truncate text-xs font-semibold text-slate-500">{messageText(staffLatestMessage, "Hỗ trợ dịch vụ công")}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[9px] font-semibold text-slate-400">{messageTime(staffLatestMessage)}</span>
          {staffUnread > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{staffUnread > 99 ? "99+" : staffUnread}</span>
          ) : (
            <span className="rounded-full bg-[#003366] px-2 py-0.5 text-[9px] font-black text-white">DVCT</span>
          )}
        </span>
      </button>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-3xl bg-white/70 p-1.5 shadow-inner shadow-slate-200/50">
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
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <Avatar src={getAvatarUrl(item)} name={item.fullName} className="h-11 w-11 shrink-0 rounded-2xl border border-slate-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-slate-900">{item.fullName}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{item.phone || item.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openDirectChat(item.id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#003366] py-2 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-[#06477f]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Nhắn tin
                </button>
              </div>
            );
          }
          const isActive = activeRoomId === item.id;
          const partner = item.members?.find((m) => m.id !== user?.id);
          const latest = latestMessageOf(item);
          const lastPreview = roomPreview(item, user);
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => {
                  setActiveRoomId(item.id);
                  onSelectRoom?.(item.id);
                  setOpenRoomMenuId(null);
                }}
                className={`w-full rounded-2xl px-3 py-3 pr-10 text-left transition ${
                  isActive
                    ? "bg-linear-to-r from-[#003366] to-[#075b99] text-white shadow-lg shadow-blue-950/20"
                    : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-100 hover:-translate-y-0.5 hover:bg-blue-50/60 hover:ring-blue-100 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={
                      item.type === "group"
                        ? getAvatarUrl(item) || "https://cdn-icons-png.flaticon.com/512/681/681494.png"
                        : getAvatarUrl(partner)
                    }
                    name={item.type === "group" ? item.name || "Nhóm" : partner?.fullName || "Người dùng"}
                    className={`h-12 w-12 shrink-0 rounded-2xl border object-cover ${isActive ? "border-white/30" : "border-slate-100"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black">
                      {item.type === "group" ? item.name || "Nhóm chat" : partner?.fullName || "Hội thoại"}
                    </div>
                    <div className={`mt-0.5 truncate text-xs font-semibold ${isActive ? "text-white/78" : "text-slate-500"}`}>
                      {lastPreview}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold ${isActive ? "text-white/70" : "text-slate-400"}`}>{messageTime(latest)}</span>
                    {(item.unreadCount || item.unread || 0) > 0 ? (
                      <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {(item.unreadCount || item.unread || 0) > 99 ? "99+" : item.unreadCount || item.unread}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOpenRoomMenuId((current) => (current === item.id ? null : item.id))}
                className={`pointer-events-none absolute right-2 top-3 grid h-8 w-8 place-items-center rounded-full transition group-hover:pointer-events-auto ${
                  isActive
                    ? "bg-white/12 text-white opacity-0 hover:bg-white/20 group-hover:opacity-100"
                    : "bg-white text-slate-500 opacity-0 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50 hover:text-slate-900 group-hover:opacity-100"
                } ${openRoomMenuId === item.id ? "pointer-events-auto opacity-100" : ""}`}
                title="Tùy chọn"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {openRoomMenuId === item.id ? (
                <div className="absolute right-2 top-12 z-30 w-44 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/12">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenRoomMenuId(null);
                      onRequestDeleteRoom?.(item);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa tin nhắn
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {embedded && (
        <p className="mt-3 shrink-0 text-center text-xs font-semibold text-slate-400">
          {roomCount} hội thoại · {contactCount} bạn bè
        </p>
      )}
    </aside>
  );
}

export default ContactList;
