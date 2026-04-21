import React from "react";
import {
  MoreHorizontal,
  Undo2,
  Trash2,
  Forward,
  Paperclip,
  Send,
  UserPlus,
  UserMinus,
  Shield,
  ShieldOff,
  CornerUpLeft,
  Video,
} from "lucide-react";
import Bubble from "./Bubble.jsx";

// ─── Group management panel ───────────────────────────────────────────────────
function GroupManagementPanel({ activeRoom, user, myGroupRole, newMemberId, setNewMemberId, contacts, performGroupAction }) {
  if (activeRoom.type !== "group" || (myGroupRole !== "owner" && myGroupRole !== "deputy")) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        Quản lý nhóm · {myGroupRole === "owner" ? "Trưởng nhóm" : "Phó nhóm"}
      </div>

      {/* Add member */}
      <div className="flex gap-2">
        <select
          value={newMemberId}
          onChange={(e) => setNewMemberId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-[#003366]"
        >
          <option value="">Thêm thành viên...</option>
          {contacts
            .filter((c) => !(activeRoom.members || []).some((m) => m.id === c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
        </select>
        <button
          type="button"
          onClick={() => performGroupAction("add", newMemberId)}
          disabled={!newMemberId}
          className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-200 disabled:opacity-40"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Member list */}
      <div className="max-h-28 overflow-y-auto space-y-1">
        {(activeRoom.members || [])
          .filter((m) => m.id !== user?.id)
          .map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-xs border border-slate-100">
              <span className="text-slate-700">
                {m.fullName}
                <span className="ml-1 text-slate-400">({m.role})</span>
              </span>
              <div className="flex gap-1">
                {myGroupRole === "owner" && m.role !== "owner" && (
                  m.role === "deputy" ? (
                    <button type="button" onClick={() => performGroupAction("demote", m.id)} className="text-amber-600 hover:text-amber-800" title="Hạ chức">
                      <ShieldOff className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => performGroupAction("promote", m.id)} className="text-blue-600 hover:text-blue-800" title="Phong phó">
                      <Shield className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
                <button type="button" onClick={() => performGroupAction("remove", m.id)} className="text-red-500 hover:text-red-700" title="Xóa khỏi nhóm">
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>

      {myGroupRole === "owner" && (
        <button
          type="button"
          onClick={() => performGroupAction("dissolve")}
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
        >
          Giải tán nhóm
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function ChatMultiPurpose({
  roomErr,
  activeRoom,
  user,
  messageMenuId,
  setMessageMenuId,
  doMessageAction,
  roomMedia,
  setRoomMedia,
  myGroupRole,
  newMemberId,
  setNewMemberId,
  contacts,
  performGroupAction,
  roomInput,
  setRoomInput,
  sendRoom,
  roomLoading,
  onPickMedia,
  forwardingMessageId,
  setForwardingMessageId,
  doForward,
  rooms,
  onReplyMessage,
  onStartVideoCall,
  replyToMessage,
  clearReply,
  chatEndRef,
}) {
  const myName = user?.fullName || "Bạn";

  if (!activeRoom) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Chọn hội thoại để bắt đầu chat
      </div>
    );
  }

  const otherMember = activeRoom.type !== "group"
    ? activeRoom.members?.find((m) => m.id !== user?.id)
    : null;

  const roomLabel = activeRoom.type === "group"
    ? activeRoom.name || "Nhóm"
    : otherMember?.fullName || "Hội thoại";

  return (
    // KEY FIX: flex-col + h-full + overflow-hidden → children control their own scroll
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Header — shrink-0 (never pushes) ── */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{roomLabel}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {activeRoom.type === "group"
              ? `${activeRoom.members?.length || 0} thành viên`
              : "Hội thoại cá nhân"}
          </div>
        </div>
        <button
          type="button"
          onClick={onStartVideoCall}
          className="flex items-center gap-1.5 rounded-lg bg-[#003366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#002244] transition-colors"
        >
          <Video className="h-3.5 w-3.5" />
          Video Call
        </button>
      </div>

      {/* Error bar */}
      {roomErr && (
        <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-500">
          {roomErr}
        </div>
      )}

      {/* ── Messages — flex-1 + overflow-y-auto = only this scrolls ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {(activeRoom.messages || []).map((m) => {
          const isMine = m.senderId === user?.id;
          const displayText = m.unsentForAll ? "Tin nhắn đã được thu hồi" : m.text;
          const senderName = isMine
            ? myName
            : activeRoom.type === "group"
            ? m.sender?.fullName || "Thành viên"
            : otherMember?.fullName || "Đối phương";

          return (
            <div key={m.id} className="relative group">
              <Bubble
                from="user"
                text={displayText}
                isMine={isMine}
                media={m.unsentForAll ? null : m.media}
                label={activeRoom.type === "group" || !isMine ? senderName : myName}
              />

              {/* Message action menu trigger */}
              {!m.unsentForAll && (
                <button
                  type="button"
                  onClick={() => setMessageMenuId(messageMenuId === m.id ? null : m.id)}
                  className={`absolute top-1 ${isMine ? "left-0" : "right-0"} p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 transition-opacity`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              )}

              {/* Dropdown menu */}
              {messageMenuId === m.id && (
                <div
                  className={`absolute top-6 ${isMine ? "left-0" : "right-0"} z-20 min-w-[130px] rounded-xl border border-slate-100 bg-white py-1 shadow-lg text-xs`}
                >
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => doMessageAction("unsend", m.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                    >
                      <Undo2 className="h-3.5 w-3.5 text-slate-500" />
                      Thu hồi
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => doMessageAction("delete", m.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                    Xóa phía tôi
                  </button>
                  <button
                    type="button"
                    onClick={() => doMessageAction("forward", m.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  >
                    <Forward className="h-3.5 w-3.5 text-slate-500" />
                    Chuyển tiếp
                  </button>
                  <button
                    type="button"
                    onClick={() => { onReplyMessage(m); setMessageMenuId(null); }}
                    className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  >
                    <CornerUpLeft className="h-3.5 w-3.5 text-slate-500" />
                    Phản hồi
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {/* Scroll anchor */}
        <div ref={chatEndRef} />
      </div>

      {/* ── Group management (owner/deputy only) — shrink-0 ── */}
      <GroupManagementPanel
        activeRoom={activeRoom}
        user={user}
        myGroupRole={myGroupRole}
        newMemberId={newMemberId}
        setNewMemberId={setNewMemberId}
        contacts={contacts}
        performGroupAction={performGroupAction}
      />

      {/* ── Bottom input area — shrink-0 (always visible) ── */}
      <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 space-y-2">
        {/* Media preview */}
        {roomMedia && (
          <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            <span className="truncate">📎 {roomMedia.name || roomMedia.type}</span>
            <button type="button" onClick={() => setRoomMedia(null)} className="ml-2 text-red-500 hover:text-red-700 font-medium">
              Hủy
            </button>
          </div>
        )}

        {/* Reply preview */}
        {replyToMessage && (
          <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs">
            <span className="truncate text-blue-700">
              ↪ {replyToMessage.sender?.fullName || "Tin nhắn"}: {String(replyToMessage.text || "").slice(0, 80)}
            </span>
            <button type="button" onClick={clearReply} className="ml-2 font-medium text-blue-600 hover:text-blue-800">
              Hủy
            </button>
          </div>
        )}

        {/* Input row */}
        <form onSubmit={sendRoom} className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50 transition-colors">
            <Paperclip className="h-4 w-4 text-slate-500" />
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onPickMedia(e.target.files?.[0] || null)}
            />
          </label>
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendRoom(); } }}
            placeholder="Nhắn tin..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#003366] focus:outline-none"
          />
          <button
            type="submit"
            disabled={roomLoading || (!roomInput.trim() && !roomMedia)}
            className="flex items-center justify-center rounded-xl bg-[#003366] p-2.5 text-white disabled:opacity-50 hover:bg-[#002244] transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatMultiPurpose;