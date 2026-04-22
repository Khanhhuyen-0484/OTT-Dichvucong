import React, { useMemo, useState } from "react";
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
function GroupManagementPanel({
  activeRoom,
  user,
  myGroupRole,
  newMemberId,
  setNewMemberId,
  contacts = [],        // ← FIX: default [] để tránh crash khi undefined
  performGroupAction,
}) {
  if (activeRoom.type !== "group" || (myGroupRole !== "owner" && myGroupRole !== "deputy")) {
    return null;
  }

  const members = activeRoom.members || [];

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
            .filter((c) => !members.some((m) => m.id === c.id))
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
        {members
          .filter((m) => m.id !== user?.id)
          .map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-xs border border-slate-100"
            >
              <span className="text-slate-700">
                {m.fullName}
                <span className="ml-1 text-slate-400">({m.role})</span>
              </span>
              <div className="flex gap-1">
                {myGroupRole === "owner" && m.role !== "owner" && (
                  m.role === "deputy" ? (
                    <button
                      type="button"
                      onClick={() => performGroupAction("demote", m.id)}
                      className="text-amber-600 hover:text-amber-800"
                      title="Hạ chức"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => performGroupAction("promote", m.id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Phong phó"
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => performGroupAction("remove", m.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Xóa khỏi nhóm"
                >
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
  contacts = [],        // ← FIX: default [] ở đây cũng để an toàn
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
  const [reactionMap, setReactionMap] = useState({});
  const reactionOptions = useMemo(() => ["👍", "❤️", "😄", "😲", "😭", "😡"], []);
  const messages = activeRoom?.messages || [];

  const toggleReaction = (messageId, emoji) => {
    setReactionMap((prev) => {
      const current = Array.isArray(prev[messageId]) ? prev[messageId] : [];
      const next = current.includes(emoji)
        ? current.filter((x) => x !== emoji)
        : [...current, emoji];
      return {
        ...prev,
        [messageId]: next
      };
    });
  };

  if (!activeRoom) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Chọn hội thoại để bắt đầu chat
      </div>
    );
  }

  const otherMember =
    activeRoom.type !== "group"
      ? activeRoom.members?.find((m) => m.id !== user?.id)
      : null;

  const roomLabel =
    activeRoom.type === "group"
      ? activeRoom.name || "Nhóm"
      : otherMember?.fullName || "Hội thoại";

  return (
    <div className="col-span-8 p-2 sm:p-3 flex flex-col bg-[#F5F7FA] relative h-full">
      {roomErr && <div className="text-[10px] text-red-500 mb-2">{roomErr}</div>}
      {!activeRoom ? (
        <div className="text-sm text-slate-500 text-center py-16">Chọn hội thoại để bắt đầu chat</div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {activeRoom.type === "group"
                  ? activeRoom.name || "Nhóm chat"
                  : activeRoom.members?.find((m) => m.id !== user?.id)?.fullName || "Hội thoại"}
              </div>
              <div className="text-[11px] text-slate-500">
                {activeRoom.type === "group" ? `${(activeRoom.members || []).length} thành viên` : "Đang hoạt động"}
              </div>
            </div>
            <button
              type="button"
              onClick={onStartVideoCall}
              className="rounded-lg bg-[#003366] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00284f]"
            >
              <Video className="mr-1 inline h-3.5 w-3.5" />
              Video Call
            </button>
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-[#F5F7FA] p-3 sm:p-4 space-y-2">
            {messages.map((m, idx) => {
              const prev = messages[idx - 1];
              const next = messages[idx + 1];
              const isMine = m.senderId === user?.id;
              const displayText = m.unsentForAll ? "Tin nhắn đã được thu hồi" : m.text;
              const isClusterStart = !prev || prev.senderId !== m.senderId;
              const isClusterEnd = !next || next.senderId !== m.senderId;
              const sender = activeRoom.members?.find((x) => x.id === m.senderId) || m.sender || null;
              const senderName = isMine ? myName : sender?.fullName || "Đối phương";
              const senderAvatar = sender?.avatarUrl;
              const reactions = reactionMap[m.id] || [];
              const canShowMenu = !m.unsentForAll;
              
              return (
                <div
                  key={m.id}
                  className={`group flex ${isMine ? "justify-end" : "justify-start"} items-start gap-2 px-2`}
                >
                  {/* Left spacer for receiver messages - for action menu alignment */}
                  {!isMine && canShowMenu && <div className="w-8 flex-shrink-0" />}

                  {/* Message Container */}
                  <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[min(85vw,450px)]`}>
                    {/* Reaction Picker */}
                    {canShowMenu && (
                      <div
                        className={`pointer-events-none mb-1 inline-flex gap-1 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 ${
                          isMine ? "self-end" : "self-start"
                        }`}
                      >
                        {reactionOptions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, emoji)}
                            className="text-xs transition-transform hover:scale-125 active:scale-100"
                            title="React"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Bubble Message */}
                    <div className="relative">
                      <Bubble
                        from="user"
                        text={displayText}
                        isMine={isMine}
                        media={m.unsentForAll ? null : m.media}
                        replyTo={m.replyTo}
                        createdAt={isClusterEnd ? m.createdAt : null}
                        label={null}
                        reactions={reactions}
                        isFirstInGroup={isClusterStart}
                        senderName={senderName}
                        senderAvatar={senderAvatar}
                      />

                      {/* Action Menu - Zalo Style */}
                      {canShowMenu && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMessageMenuId(messageMenuId === m.id ? null : m.id)}
                            className={`absolute top-2 text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100 ${
                              isMine ? "-left-8" : "-right-8"
                            }`}
                            aria-label="Menu"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {messageMenuId === m.id && (
                            <div
                              className={`absolute top-0 z-40 flex flex-col gap-1 rounded-[12px] bg-white shadow-lg border border-slate-200 overflow-hidden ${
                                isMine
                                  ? "-left-[180px]"
                                  : "-right-[180px]"
                              }`}
                              style={{
                                minWidth: "140px",
                                animation: "fadeIn 0.15s ease-out"
                              }}
                            >
                              {isMine && (
                                <button
                                  type="button"
                                  onClick={() => doMessageAction("unsend", m.id)}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
                                >
                                  <Undo2 className="h-4 w-4 flex-shrink-0" />
                                  <span>Thu hồi</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => doMessageAction("delete", m.id)}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="h-4 w-4 flex-shrink-0" />
                                <span>Xóa</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => doMessageAction("forward", m.id)}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
                              >
                                <Forward className="h-4 w-4 flex-shrink-0" />
                                <span>Chuyển tiếp</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onReplyMessage(m)}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition border-t border-slate-200"
                              >
                                <CornerUpLeft className="h-4 w-4 flex-shrink-0" />
                                <span>Phản hồi</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right spacer for sender messages */}
                  {isMine && canShowMenu && <div className="w-8 flex-shrink-0" />}
                </div>
              );
            })}
          </div>

          <style>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: scale(0.95);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
          {roomMedia && (
            <div className="mb-2 bg-amber-50 rounded-xl p-3 flex items-center justify-between border border-amber-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800 font-medium">Đính kèm: {roomMedia.name || roomMedia.type}</span>
              </div>
              <button type="button" onClick={() => setRoomMedia(null)} className="text-amber-600 hover:text-amber-700 font-semibold text-sm">
                Hủy
              </button>
            </div>
          )}
          {replyToMessage && (
            <div className="mb-2 bg-blue-50 rounded-xl p-3 flex items-center justify-between border border-blue-200 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <CornerUpLeft className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="truncate text-sm text-blue-800 font-medium">
                  Phản hồi: {replyToMessage.sender?.fullName || "Tin nhắn"} - {String(replyToMessage.text || "").slice(0, 50)}
                </span>
              </div>
              <button type="button" onClick={clearReply} className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex-shrink-0 ml-2">
                Hủy
              </button>
            </div>
          )}
          {activeRoom.type === "group" && (myGroupRole === "owner" || myGroupRole === "deputy") && (
            <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-3">
              <div className="font-bold text-slate-700 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Quản lý nhóm ({myGroupRole === "owner" ? "Trưởng nhóm" : "Phó nhóm"})
              </div>
              <div className="flex gap-2">
                <select
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Chọn thành viên</option>
                  {contacts
                    .filter((c) => !(activeRoom.members || []).some((m) => m.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => performGroupAction("add", newMemberId)}
                  className="px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition font-medium"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {(activeRoom.members || [])
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                      <span className="text-sm font-medium text-slate-700">
                        {m.fullName} <span className="text-xs text-slate-500">({m.role})</span>
                      </span>
                      <div className="flex gap-2">
                        {myGroupRole === "owner" && m.role !== "owner" && (
                          <>
                            {m.role === "deputy" ? (
                              <button
                                type="button"
                                onClick={() => performGroupAction("demote", m.id)}
                                className="text-amber-600 hover:text-amber-700 transition"
                                title="Hạ xuống thành viên"
                              >
                                <ShieldOff className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => performGroupAction("promote", m.id)}
                                className="text-blue-600 hover:text-blue-700 transition"
                                title="Nâng lên phó nhóm"
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => performGroupAction("remove", m.id)}
                          className="text-red-600 hover:text-red-700 transition"
                          title="Xóa khỏi nhóm"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              {myGroupRole === "owner" && (
                <button
                  type="button"
                  onClick={() => performGroupAction("dissolve")}
                  className="w-full px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition font-medium text-sm border border-red-200"
                >
                  Giải tán nhóm
                </button>
              )}
            </div>
          )}
          <form onSubmit={sendRoom} className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex gap-2 items-end">
              <label className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition flex-shrink-0">
                <Paperclip className="h-4 w-4 text-slate-600" />
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
                placeholder="Nhắn tin..."
                className="flex-1 text-sm p-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={roomLoading || (!roomInput.trim() && !roomMedia)}
                className="bg-[#0084ff] text-white p-2.5 rounded-2xl hover:bg-[#0073e6] disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </>
      )}
      {forwardingMessageId && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4">
            <div className="text-sm font-bold mb-2">Chọn nơi chuyển tiếp</div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {rooms
                .filter((r) => r.id !== activeRoom?.id)
                .map((r) => (
                  <button key={r.id} type="button" onClick={() => doForward(r.id)} className="block w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-100 text-sm">
                    {r.type === "group" ? r.name || "Nhóm" : r.members?.find((m) => m.id !== user?.id)?.fullName || "Hội thoại"}
                  </button>
                ))}
            </div>
            <button type="button" onClick={() => setForwardingMessageId(null)} className="mt-3 text-xs text-slate-500">Đóng</button>
          </div>
        )}

        {/* Reply preview */}
        {replyToMessage && (
          <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs">
            <span className="truncate text-blue-700">
              ↪ {replyToMessage.sender?.fullName || "Tin nhắn"}: {String(replyToMessage.text || "").slice(0, 80)}
            </span>
            <button
              type="button"
              onClick={clearReply}
              className="ml-2 font-medium text-blue-600 hover:text-blue-800"
            >
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendRoom();
              }
            }}
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