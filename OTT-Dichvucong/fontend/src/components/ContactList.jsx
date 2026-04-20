import React from "react";
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
  user
}) {
  return (
    <div className="col-span-4 border-r p-2">
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setChatModeTab("rooms")}
          className={`flex-1 text-xs py-1 rounded ${chatModeTab === "rooms" ? "bg-[#003366] text-white" : "bg-slate-100"}`}
        >
          Hội thoại
        </button>
        <button
          type="button"
          onClick={() => setChatModeTab("contacts")}
          className={`flex-1 text-xs py-1 rounded ${chatModeTab === "contacts" ? "bg-[#003366] text-white" : "bg-slate-100"}`}
        >
          Danh bạ
        </button>
      </div>
      <div className="flex gap-1 mb-2">
        <div className="relative flex-1">
          <Search className="h-3 w-3 absolute left-2 top-2.5 text-slate-400" />
          <input
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            placeholder="SĐT / Email"
            className="w-full rounded-lg border text-xs pl-7 pr-2 py-1.5"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowGroupModal(true)}
          className="rounded-lg p-1.5 bg-emerald-100 text-emerald-700"
          title="Tạo nhóm"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-1">
        <button
          type="button"
          onClick={openStaffChat}
          className="w-full rounded-lg border border-[#003366]/20 bg-[#003366]/5 p-2 text-left hover:bg-[#003366]/10"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#003366]">Cán bộ hỗ trợ</div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white bg-[#003366]">
              Dịch vụ công
            </span>
          </div>
          <div className="text-[10px] text-slate-500">Trao đổi trực tiếp với cán bộ</div>
        </button>
      </div>
      <div className="space-y-1 max-h-[360px] overflow-y-auto">
        {(chatModeTab === "contacts" ? contacts : rooms).map((item) => {
          if (chatModeTab === "contacts") {
            return (
              <div key={item.id} className="w-full p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-semibold truncate">{item.fullName}</div>
                <div className="text-[10px] text-slate-500 truncate">{item.phone || item.email}</div>
                <button
                  type="button"
                  onClick={() => openDirectChat(item.id)}
                  className="mt-1 rounded-md bg-[#003366] px-2 py-1 text-[10px] font-semibold text-white"
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
              onClick={() => setActiveRoomId(item.id)}
              className={`w-full text-left p-2 rounded-lg ${isActive ? "bg-[#003366] text-white" : "hover:bg-slate-100"}`}
            >
              <div className="text-xs font-semibold truncate">
                {item.type === "group"
                  ? item.name || "Nhóm chat"
                  : item.members?.find((m) => m.id !== user?.id)?.fullName || "Hội thoại"}
              </div>
              <div className={`text-[10px] truncate ${isActive ? "text-white/70" : "text-slate-500"}`}>
                {item.type === "group" ? "Nhóm" : "Cá nhân"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ContactList;