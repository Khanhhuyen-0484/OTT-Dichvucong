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
  Video
} from "lucide-react";
import Bubble from "./Bubble.jsx";
import UserAvatar from "./UserAvatar.jsx";

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
  clearReply
}) {
  const myName = user?.fullName || "Bạn";

  return (
    <div className="col-span-8 p-3 flex flex-col">
      {roomErr && <div className="text-[10px] text-red-500 mb-2">{roomErr}</div>}
      {!activeRoom ? (
        <div className="text-xs text-slate-500 text-center py-16">Chọn hội thoại để bắt đầu chat</div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold text-slate-700">
              {activeRoom.type === "group" ? "Nhóm" : "Hội thoại cá nhân"}
            </div>
            <button
              type="button"
              onClick={onStartVideoCall}
              className="rounded-md bg-[#003366] px-2 py-1 text-[11px] font-semibold text-white"
            >
              <Video className="mr-1 inline h-3.5 w-3.5" />
              Video Call
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {(activeRoom.messages || []).map((m) => {
              const isMine = m.senderId === user?.id;
              const displayText = m.unsentForAll ? "Tin nhắn đã được thu hồi" : m.text;
              return (
                <div key={m.id} className="relative">
                  <Bubble
                    from="user"
                    text={displayText}
                    isMine={isMine}
                    media={m.unsentForAll ? null : m.media}
                    label={
                      activeRoom.type === "group" && !isMine
                        ? m.sender?.fullName || "Thành viên"
                        : isMine
                        ? myName
                        : activeRoom.members?.find((x) => x.id === m.senderId)?.fullName || "Đối phương"
                    }
                  />
                  {!m.unsentForAll && (
                    <button
                      type="button"
                      onClick={() => setMessageMenuId(messageMenuId === m.id ? null : m.id)}
                      className="absolute top-0 right-0 text-slate-400 hover:text-slate-700"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                  {messageMenuId === m.id && (
                    <div className="absolute top-5 right-0 bg-white border rounded-lg shadow text-xs z-10">
                      {isMine && (
                        <button type="button" onClick={() => doMessageAction("unsend", m.id)} className="block px-3 py-1.5 hover:bg-slate-100">
                          <Undo2 className="h-3 w-3 inline mr-1" />
                          Thu hồi
                        </button>
                      )}
                      <button type="button" onClick={() => doMessageAction("delete", m.id)} className="block px-3 py-1.5 hover:bg-slate-100">
                        <Trash2 className="h-3 w-3 inline mr-1" />
                        Xóa phía tôi
                      </button>
                      <button type="button" onClick={() => doMessageAction("forward", m.id)} className="block px-3 py-1.5 hover:bg-slate-100">
                        <Forward className="h-3 w-3 inline mr-1" />
                        Chuyển tiếp
                      </button>
                      <button type="button" onClick={() => onReplyMessage(m)} className="block px-3 py-1.5 hover:bg-slate-100">
                        <CornerUpLeft className="h-3 w-3 inline mr-1" />
                        Phản hồi
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {roomMedia && (
            <div className="text-[10px] bg-slate-100 rounded p-2 mb-2 flex items-center justify-between">
              <span>Đính kèm: {roomMedia.name || roomMedia.type}</span>
              <button type="button" onClick={() => setRoomMedia(null)} className="text-red-500">
                Hủy
              </button>
            </div>
          )}
          {replyToMessage && (
            <div className="text-[10px] bg-blue-50 rounded p-2 mb-2 flex items-center justify-between border border-blue-100">
              <span className="truncate pr-2">
                Đang phản hồi: {(replyToMessage.sender?.fullName || "Tin nhắn")} - {String(replyToMessage.text || "").slice(0, 60)}
              </span>
              <button type="button" onClick={clearReply} className="text-blue-700">
                Hủy
              </button>
            </div>
          )}
          {activeRoom.type === "group" && (myGroupRole === "owner" || myGroupRole === "deputy") && (
            <div className="mb-2 rounded-lg border p-2 text-[10px] space-y-2">
              <div className="font-bold text-slate-600">
                Quản lý nhóm ({myGroupRole === "owner" ? "Trưởng nhóm" : "Phó nhóm"})
              </div>
              <div className="flex gap-1">
                <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} className="flex-1 border rounded px-2 py-1">
                  <option value="">Chọn thành viên</option>
                  {contacts
                    .filter((c) => !(activeRoom.members || []).some((m) => m.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => performGroupAction("add", newMemberId)} className="px-2 rounded bg-emerald-100 text-emerald-700">
                  <UserPlus className="h-3 w-3" />
                </button>
              </div>
              <div className="max-h-20 overflow-y-auto space-y-1">
                {(activeRoom.members || [])
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
                      <span>{m.fullName} ({m.role})</span>
                      <div className="flex gap-1">
                        {myGroupRole === "owner" && m.role !== "owner" && (
                          <>
                            {m.role === "deputy" ? (
                              <button type="button" onClick={() => performGroupAction("demote", m.id)} className="text-amber-700">
                                <ShieldOff className="h-3 w-3" />
                              </button>
                            ) : (
                              <button type="button" onClick={() => performGroupAction("promote", m.id)} className="text-blue-700">
                                <Shield className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                        <button type="button" onClick={() => performGroupAction("remove", m.id)} className="text-red-600">
                          <UserMinus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              {myGroupRole === "owner" && (
                <button type="button" onClick={() => performGroupAction("dissolve")} className="px-2 py-1 rounded bg-red-100 text-red-700">
                  Giải tán nhóm
                </button>
              )}
            </div>
          )}
          <form onSubmit={sendRoom} className="flex gap-2 mt-2">
            <label className="p-2.5 rounded-xl border bg-white cursor-pointer">
              <Paperclip className="h-4 w-4" />
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
              className="flex-1 text-sm p-2.5 rounded-xl border border-slate-200"
            />
            <button type="submit" disabled={roomLoading || (!roomInput.trim() && !roomMedia)} className="bg-[#003366] text-white p-2.5 rounded-xl disabled:opacity-50">
              <Send size={18} />
            </button>
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
        </div>
      )}
    </div>
  );
}

export default ChatMultiPurpose;