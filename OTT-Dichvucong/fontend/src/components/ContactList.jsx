import React, { useMemo } from "react";
import { ContactRound, Search } from "lucide-react";
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
  return <div className={`${className} ${AVATAR_BG[idx]} flex items-center justify-center text-[11px] font-bold text-white`}>{getInitials(name)}</div>;
}

function AddFriendIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M7.5 18.25v-.75a4.25 4.25 0 0 1 4.25-4.25h.5a4.25 4.25 0 0 1 4.25 4.25v.75" strokeLinecap="round" />
      <circle cx="12" cy="8.25" r="3.25" />
      <path d="M19.25 7.25v5" strokeLinecap="round" />
      <path d="M16.75 9.75h5" strokeLinecap="round" />
    </svg>
  );
}

function CreateGroupIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <circle cx="9" cy="8.25" r="3" />
      <path d="M4.75 18.25v-.6A4.15 4.15 0 0 1 8.9 13.5h.2a4.15 4.15 0 0 1 4.15 4.15v.6" strokeLinecap="round" />
      <path d="M15.1 13.9a3.35 3.35 0 0 1 2.9 3.3v1.05" strokeLinecap="round" />
      <path d="M14.9 6.55a2.75 2.75 0 1 1 0 5.5" strokeLinecap="round" />
      <path d="M18.75 4.75v5" strokeLinecap="round" />
      <path d="M16.25 7.25h5" strokeLinecap="round" />
    </svg>
  );
}

function ContactList({
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
  onSelectRoom
}) {
  const listItems = useMemo(() => (chatModeTab === "contacts" ? contacts : rooms), [chatModeTab, contacts, rooms]);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">Danh sách chat</h2>
        <button
          type="button"
          onClick={onOpenFriendHub}
          className="relative rounded-xl bg-[#eef4ff] px-3 py-2 text-xs font-bold text-[#0d5bd7] ring-1 ring-[#0d5bd7]/10 transition hover:bg-[#dfeafe]"
          title="Trung tâm bạn bè"
        >
          <div className="flex items-center gap-1.5">
            <ContactRound className="h-4 w-4" />
            Danh bạ
          </div>
          {pendingHubCount > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {pendingHubCount > 9 ? "9+" : pendingHubCount}
            </span>
          ) : null}
        </button>
      </div>
      <div className="flex gap-1 mb-3 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setChatModeTab("rooms")}
          className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition ${chatModeTab === "rooms" ? "bg-white text-[#003366] shadow-sm" : "text-slate-600"}`}
        >
          Hội thoại
        </button>
        <button
          type="button"
          onClick={() => setChatModeTab("contacts")}
          className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition ${chatModeTab === "contacts" ? "bg-white text-[#003366] shadow-sm" : "text-slate-600"}`}
        >
          Danh bạ
        </button>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            placeholder={chatModeTab === "contacts" ? "Tìm bạn bè" : "Tìm hội thoại"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs pl-8 pr-2 py-2 focus:outline-none focus:border-[#003366]"
          />
        </div>
        <button
          type="button"
          onClick={onOpenAddFriend}
          className="rounded-[24px] bg-white p-3.5 text-[#113a72] transition hover:bg-slate-50"
          title="Thêm bạn"
        >
          <AddFriendIcon className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowGroupModal(true)}
          className="rounded-[24px] bg-white p-3.5 text-[#113a72] transition hover:bg-slate-50"
          title="Tạo nhóm"
        >
          <CreateGroupIcon className="h-4.5 w-4.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={openStaffChat}
        className="mb-2 w-full rounded-xl border border-[#003366]/20 bg-[#003366]/5 p-2 text-left hover:bg-[#003366]/10"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-[#003366]">Cán bộ hỗ trợ</div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white bg-[#003366]">
            Dịch vụ công
          </span>
        </div>
        <div className="text-[10px] text-slate-500">Hỗ trợ trực tuyến một cửa</div>
      </button>
      <div className="space-y-1.5 max-h-[58vh] overflow-y-auto pr-1">
        {listItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
            {chatModeTab === "contacts" ? "Không tìm thấy người dùng phù hợp." : "Chưa có hội thoại nào."}
          </div>
        )}
        {listItems.map((item) => {
          if (chatModeTab === "contacts") {
            return (
              <div key={item.id} className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="text-sm font-semibold truncate text-slate-800">{item.fullName}</div>
                <div className="text-[11px] text-slate-500 truncate">{item.phone || item.email}</div>
                <button
                  type="button"
                  onClick={() => openDirectChat(item.id)}
                  className="mt-2 rounded-lg bg-[#003366] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00284f]"
                >
                  Bắt đầu chat
                </button>
              </div>
            );
          }
          const isActive = activeRoomId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveRoomId(item.id);
                onSelectRoom?.(item.id);
              }}
              className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                isActive
                  ? "border-[#003366] bg-[#003366] text-white shadow-sm"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  src={item.type === "group"
                    ? (getAvatarUrl(item) || "https://cdn-icons-png.flaticon.com/512/681/681494.png")
                    : getAvatarUrl(item.members?.find((m) => m.id !== user?.id))}
                  name={item.type === "group" ? (item.name || "Nhóm") : (item.members?.find((m) => m.id !== user?.id)?.fullName || "Người dùng")}
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">
                    {item.type === "group"
                      ? item.name || "Nhóm chat"
                      : item.members?.find((m) => m.id !== user?.id)?.fullName || "Hội thoại"}
                  </div>
                  <div className={`text-[11px] truncate ${isActive ? "text-white/80" : "text-slate-500"}`}>
                    {item.type === "group" ? "Nhóm chat" : "Chat cá nhân"}
                  </div>
                </div>
                {(item.unreadCount || item.unread || 0) > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {(item.unreadCount || item.unread || 0) > 99 ? "99+" : (item.unreadCount || item.unread || 0)}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ContactList;
