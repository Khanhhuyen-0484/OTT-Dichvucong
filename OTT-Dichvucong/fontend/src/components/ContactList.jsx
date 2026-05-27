import React, { useMemo } from "react";
import { Search, Plus } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";

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
  user,
  unreadMap = {}
}) {
  const listItems = useMemo(() => (chatModeTab === "contacts" ? contacts : rooms), [chatModeTab, contacts, rooms]);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">Danh sách chat</h2>
        <button
          type="button"
          onClick={() => setShowGroupModal(true)}
          className="rounded-lg p-1.5 bg-emerald-100 text-emerald-700"
          title="Tạo nhóm"
        >
          <Plus className="h-4 w-4" />
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
      <div className="relative mb-3">
        <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
        <input
          value={contactQuery}
          onChange={(e) => setContactQuery(e.target.value)}
          placeholder="Tìm theo SĐT / Email / Tên"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs pl-8 pr-2 py-2 focus:outline-none focus:border-[#003366]"
        />
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
          const targetUser = item.members?.find((m) => m.id !== user?.id) || null;
          const roomTitle = item.type === "group" ? item.name || "Nhóm chat" : targetUser?.fullName || "Hội thoại";
          const roomAvatar = item.type === "group" ? item.avatarUrl : targetUser?.avatarUrl;
          const unreadCount = unreadMap[item.id] || 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveRoomId(item.id)}
              className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                isActive
                  ? "border-[#003366] bg-[#003366] text-white shadow-sm"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <UserAvatar
                  user={{ fullName: roomTitle }}
                  src={roomAvatar}
                  size={34}
                  showActive={item.type === "direct"}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{roomTitle}</div>
                  <div className={`text-[11px] truncate ${isActive ? "text-white/80" : "text-slate-500"}`}>
                    {item.type === "group" ? "Nhóm chat" : "Chat cá nhân"}
                  </div>
                </div>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ContactList;