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
}) {
  const listItems = useMemo(() => (chatModeTab === "contacts" ? contacts : rooms), [chatModeTab, contacts, rooms]);

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
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg border border-[#003366]/15 bg-[#003366]/5 px-2.5 py-1 text-left hover:bg-[#003366]/10"
      >
        <span className="text-[11px] font-semibold text-[#003366]">Cán bộ hỗ trợ</span>
        <span className="shrink-0 rounded-full bg-[#003366] px-1.5 py-px text-[9px] font-semibold text-white">
          DVCT
        </span>
      </button>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg bg-white/80 p-1">
        {listItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 px-2 py-8 text-center text-[11px] leading-relaxed text-slate-500">
            {chatModeTab === "contacts"
              ? "Chưa có bạn bè phù hợp.\nBấm + để kết bạn."
              : "Chưa có hội thoại.\nTạo nhóm hoặc chat với bạn bè."}
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
          const lastPreview = item.lastMessage?.text || (item.type === "group" ? "Nhóm chat" : "Tin nhắn mới");
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
                {(item.unreadCount || item.unread || 0) > 0 ? (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {(item.unreadCount || item.unread || 0) > 99 ? "99+" : item.unreadCount || item.unread}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {embedded && (
        <p className="mt-2 shrink-0 text-center text-[10px] text-slate-400">
          {roomCount} hội thoại · {contactCount} bạn bè
        </p>
      )}
    </aside>
  );
}

export default ContactList;
