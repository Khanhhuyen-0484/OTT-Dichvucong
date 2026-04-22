import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckSquare,
  FileImage,
  Heart,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Forward,
  Send,
  Smile,
  ThumbsUp,
  Trash2,
  Undo2,
  UserMinus,
  UserPlus,
  Shield,
  ShieldOff,
  CornerUpLeft,
  Video,
  X,
} from "lucide-react";
import Bubble from "./Bubble.jsx";

const GROUP_FALLBACK_AVATAR = "https://cdn-icons-png.flaticon.com/512/681/681494.png";
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
  if (src) {
    return <img src={src} alt={name || "avatar"} className={className} />;
  }
  const idx = (String(name || "A").charCodeAt(0) || 0) % AVATAR_BG.length;
  return (
    <div className={`${className} ${AVATAR_BG[idx]} flex items-center justify-center text-[11px] font-bold text-white`}>
      {getInitials(name)}
    </div>
  );
}

function GroupInfoDrawer({
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
}) {
  if (!open || activeRoom?.type !== "group") return null;
  const canManageGroup = myGroupRole === "owner" || myGroupRole === "deputy";
  const members = activeRoom.members || [];

  return (
    <div className="fixed inset-y-0 right-0 z-[65] w-full max-w-sm border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div className="text-sm font-bold text-slate-800">Thông tin nhóm</div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <img
              src={activeRoom.avatar || GROUP_FALLBACK_AVATAR}
              alt={activeRoom.name || "Nhóm chat"}
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onUpdateGroupMeta?.({ avatarFile: e.target.files?.[0] || null })}
            />
          </label>
          <button
            type="button"
            onClick={() => onUpdateGroupMeta?.({ editableName: true })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Đổi tên nhóm
          </button>
        </div>

        <div>
          <div className="text-xs text-slate-500">Tên nhóm</div>
          <div
            className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onUpdateGroupMeta?.({ name: e.currentTarget.textContent || "" })}
          >
            {activeRoom.name || "Nhóm chat"}
          </div>
        </div>

        {canManageGroup && (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Quản lý thành viên
            </div>
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
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {members
                .filter((m) => m.id !== user?.id)
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
                    <span className="text-slate-700">
                      {m.fullName}
                      <span className="ml-1 text-slate-400">({m.role})</span>
                    </span>
                    <div className="flex gap-1">
                      {myGroupRole === "owner" && m.role !== "owner" && (
                        m.role === "deputy" ? (
                          <button type="button" onClick={() => performGroupAction("demote", m.id)} className="text-amber-600 hover:text-amber-800">
                            <ShieldOff className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => performGroupAction("promote", m.id)} className="text-blue-600 hover:text-blue-800">
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                        )
                      )}
                      <button type="button" onClick={() => performGroupAction("remove", m.id)} className="text-red-500 hover:text-red-700">
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
        )}
      </div>
    </div>
  );
}

function ChatMultiPurpose({
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
  contacts = [],
  performGroupAction,
  roomInput,
  setRoomInput,
  sendRoom,
  roomLoading,
  onPickMedia,
  onStartVideoCall,
  replyToMessage,
  clearReply,
  onReplyMessage,
  chatEndRef,
  onUpdateGroupMeta,
  setForwardingMessageId,
}) {
  const [reactionMap, setReactionMap] = useState({});
  const [hoverMessageId, setHoverMessageId] = useState(null);
  const [reactionHoverId, setReactionHoverId] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const reactionOptions = useMemo(() => ["❤️", "👍", "😂", "😮", "😢", "😡"], []);
  const messages = activeRoom?.messages || [];
  const partner = activeRoom?.members?.find((m) => m.id !== user?.id);
  const groupAvatar = activeRoom?.avatar || GROUP_FALLBACK_AVATAR;
  const headerAvatar = activeRoom?.type === "group" ? groupAvatar : getAvatarUrl(partner);
  const hasSendPayload = Boolean(roomInput.trim() || roomMedia);
  const lastMessage = messages[messages.length - 1];

  const scrollToLatestMessage = useCallback(() => {
    chatEndRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatEndRef]);

  useEffect(() => {
    if (!lastMessage?.media) return;
    const fileUrl = String(lastMessage.media.fileUrl || lastMessage.media.url || "").toLowerCase();
    const isDocFile =
      ["file", "document"].includes(lastMessage.media.type) ||
      fileUrl.endsWith(".pdf") ||
      fileUrl.endsWith(".doc") ||
      fileUrl.endsWith(".docx");
    if (!isDocFile) return;
    const t = window.setTimeout(scrollToLatestMessage, 120);
    return () => window.clearTimeout(t);
  }, [lastMessage, scrollToLatestMessage]);

  const toggleReaction = (messageId, emoji) => {
    setReactionMap((prev) => {
      const current = Array.isArray(prev[messageId]) ? prev[messageId] : [];
      const next = current.includes(emoji) ? current.filter((x) => x !== emoji) : [...current, emoji];
      return { ...prev, [messageId]: next };
    });
  };

  const sendLikeOrMessage = (e) => {
    if (roomInput.trim() || roomMedia) {
      sendRoom(e);
      return;
    }
    setRoomInput("👍");
    setTimeout(() => sendRoom(e), 0);
  };

  const handleMediaPick = (file, type) => {
    if (!file) return;
    if (type === "file") {
      const lower = file.name.toLowerCase();
      if (!(lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx"))) return;
    }
    onPickMedia(file);
  };

  if (!activeRoom) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Chọn hội thoại để bắt đầu chat</div>;
  }

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 shadow-sm md:px-4">
        <div className="flex flex-row items-center">
          <Avatar src={headerAvatar} name={activeRoom.type === "group" ? activeRoom.name : partner?.fullName} className="mr-3 h-10 w-10 rounded-full border border-slate-200 object-cover" />
          <div>
            <div className="text-sm font-bold text-slate-800">
              {activeRoom.type === "group" ? activeRoom.name || "Nhóm chat" : partner?.fullName || "Hội thoại"}
            </div>
            <div className="text-[11px] text-slate-500">
              {activeRoom.type === "group" ? `${(activeRoom.members || []).length} thành viên` : "Đang hoạt động"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeRoom.type === "group" && (
            <button
              type="button"
              onClick={() => setShowGroupInfo(true)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Thông tin nhóm
            </button>
          )}
          <button onClick={onStartVideoCall} className="rounded-full bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100">
            <Video className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[#F5F7FA] p-4">
        {messages.map((m) => {
          const isMine = m.senderId === user?.id;
          const reactions = reactionMap[m.id] || [];
          const senderMember = activeRoom?.members?.find((x) => x.id === m.senderId);
          const senderName = senderMember?.fullName || m.senderName || "Người dùng";
          const senderAvatar = isMine
            ? getAvatarUrl(user)
            : (m.senderAvatar || getAvatarUrl(senderMember) || (activeRoom.type === "group" ? GROUP_FALLBACK_AVATAR : headerAvatar));

          return (
            <div
              key={m.id}
              className={`group relative flex items-start gap-2 ${isMine ? "justify-end" : "justify-start"}`}
              onMouseEnter={() => setHoverMessageId(m.id)}
              onMouseLeave={() => {
                setHoverMessageId(null);
                setReactionHoverId(null);
              }}
            >
              {!isMine && <Avatar src={senderAvatar} name={senderName} className="mt-1 h-7 w-7 rounded-full border border-slate-200 object-cover" />}
              <div className={`relative flex max-w-[80%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                <Bubble
                  text={m.unsentForAll ? "Tin nhắn đã được thu hồi" : m.text}
                  isMine={isMine}
                  media={m.unsentForAll ? null : (m.media || (m.fileUrl ? { type: "file", fileUrl: m.fileUrl, name: m.fileName || m.name } : null))}
                  fileUrl={m.fileUrl}
                  fileName={m.fileName || m.name}
                  type={m.type}
                  messageType={m.messageType}
                  callLog={m.callLog}
                  reactions={reactions}
                  replyTo={m.replyTo}
                  createdAt={m.createdAt}
                  onMediaRendered={scrollToLatestMessage}
                />
                {!m.unsentForAll && hoverMessageId === m.id && (
                  <div className={`absolute top-1 flex items-center gap-1 ${isMine ? "-left-10" : "-right-10"}`}>
                    <button type="button" onMouseEnter={() => setReactionHoverId(m.id)} className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow hover:text-slate-700">
                      <Heart className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setMessageMenuId(messageMenuId === m.id ? null : m.id)} className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow hover:text-slate-700">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {reactionHoverId === m.id && (
                  <div className={`absolute top-0 z-20 flex gap-1 rounded-full border border-slate-100 bg-white px-2 py-1 shadow-md ${isMine ? "-left-[210px]" : "left-0 -top-9"}`} onMouseLeave={() => setReactionHoverId(null)}>
                    {reactionOptions.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => toggleReaction(m.id, emoji)} className="text-xs transition hover:scale-125">
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {messageMenuId === m.id && (
                  <div className={`absolute top-8 z-50 min-w-[120px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${isMine ? "right-0" : "left-0"}`}>
                    {isMine && (
                      <button onClick={() => doMessageAction("unsend", m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"><Undo2 className="h-3.5 w-3.5"/> Thu hồi</button>
                    )}
                    <button onClick={() => onReplyMessage(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"><CornerUpLeft className="h-3.5 w-3.5"/> Phản hồi</button>
                    <button onClick={() => { setForwardingMessageId?.(m.id); setMessageMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"><Forward className="h-3.5 w-3.5"/> Chuyển tiếp</button>
                    <button onClick={() => doMessageAction("delete", m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-slate-50"><Trash2 className="h-3.5 w-3.5"/> Xóa</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {replyToMessage && (
        <div className="flex items-center justify-between border-t border-blue-100 bg-blue-50 px-4 py-2">
          <div className="truncate text-xs text-blue-700">Đang trả lời: {replyToMessage.text}</div>
          <button onClick={clearReply} className="text-xs font-bold text-blue-600">Hủy</button>
        </div>
      )}

      {roomMedia && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs">
          <span className="truncate text-slate-600">Đã chọn: {roomMedia.name}</span>
          <button type="button" className="font-semibold text-red-500" onClick={() => setRoomMedia(null)}>Bỏ chọn</button>
        </div>
      )}

      <form onSubmit={sendRoom} className="border-t border-slate-100 bg-white p-3">
        <div className="mb-2 flex items-center gap-3 border-b border-slate-100 pb-2 text-slate-500">
          <button type="button" className="hover:text-slate-700" onClick={() => imageInputRef.current?.click()}><FileImage className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700"><Smile className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700"><Calendar className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700"><CheckSquare className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700"><MoreHorizontal className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 rounded-xl bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={sendLikeOrMessage}
            disabled={roomLoading}
            className={`rounded-full p-2.5 transition ${hasSendPayload ? "bg-[#003366] text-white hover:bg-[#00284f]" : "bg-amber-100 text-amber-600 hover:bg-amber-200"} disabled:opacity-50`}
          >
            {hasSendPayload ? <Send className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
          </button>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleMediaPick(e.target.files?.[0], "image")} />
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleMediaPick(e.target.files?.[0], "file")} />
      </form>

      <GroupInfoDrawer
        open={showGroupInfo}
        onClose={() => setShowGroupInfo(false)}
        activeRoom={activeRoom}
        user={user}
        myGroupRole={myGroupRole}
        newMemberId={newMemberId}
        setNewMemberId={setNewMemberId}
        contacts={contacts}
        performGroupAction={performGroupAction}
        onUpdateGroupMeta={onUpdateGroupMeta}
      />
    </div>
  );
}

export default ChatMultiPurpose;