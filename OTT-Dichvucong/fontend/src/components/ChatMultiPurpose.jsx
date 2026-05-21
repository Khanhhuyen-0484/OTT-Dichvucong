import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckSquare,
  FileImage,
  Heart,
  MapPin,
  ChevronDown,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Forward,
  Send,
  Smile,
  ThumbsUp,
  Trash2,
  Undo2,
  CornerUpLeft,
  Pin,
  MapPinned,
  UserPlus,
  Video,
} from "lucide-react";
import Bubble from "./Bubble.jsx";
import GroupInfoDrawer from "./GroupInfoDrawer.jsx";
import { canManageGroupRoom } from "../lib/groupRoles.js";
import {
  MAX_PINNED_MESSAGES,
  getPinnedMessages,
  getPinnedPreviewText,
} from "../lib/chatPinned.js";

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

function isDisplayableAvatarSrc(src) {
  const s = String(src || "").trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return true;
  return false;
}

function Avatar({ src, name, className = "" }) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [src]);

  if (isDisplayableAvatarSrc(src) && !broken) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        className={className}
        onError={() => setBroken(true)}
      />
    );
  }
  const idx = (String(name || "A").charCodeAt(0) || 0) % AVATAR_BG.length;
  return (
    <div className={`${className} ${AVATAR_BG[idx]} flex items-center justify-center text-[11px] font-bold text-white`}>
      {getInitials(name)}
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
  onSendLocation,
  onStartVideoCall,
  replyToMessage,
  clearReply,
  onReplyMessage,
  chatEndRef,
  onUpdateGroupMeta,
  setForwardingMessageId,
  groupActionBusy = false,
}) {
  const [reactionMap, setReactionMap] = useState({});
  const [hoverMessageId, setHoverMessageId] = useState(null);
  const [reactionHoverId, setReactionHoverId] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupInfoInitialTab, setGroupInfoInitialTab] = useState("overview");

  const canEditGroup = canManageGroupRoom(activeRoom, user?.id);
  const canManageGroup = canEditGroup;

  const openGroupInfo = useCallback((tab = "overview") => {
    setGroupInfoInitialTab(tab);
    setShowGroupInfo(true);
  }, []);
  const [showPinnedMenu, setShowPinnedMenu] = useState(false);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const reactionOptions = useMemo(() => ["❤️", "👍", "😂", "😮", "😢", "😡"], []);
  const pinnedMessageRefs = useRef({});
  const latestPinnedMessageRef = useRef(null);
  const messages = activeRoom?.messages || [];
  const pinnedMessages = useMemo(() => getPinnedMessages(messages), [messages]);
  const latestPinnedPreview = pinnedMessages[0] || null;
  const latestPinnedMessageId = latestPinnedPreview?.id ?? null;
  const pinnedCount = pinnedMessages.length;

  const scrollToPinnedMessage = useCallback((messageId) => {
    const node =
      pinnedMessageRefs.current[messageId] ||
      (messageId === latestPinnedMessageId ? latestPinnedMessageRef.current : null);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [latestPinnedMessageId]);
  const partner = activeRoom?.members?.find((m) => m.id !== user?.id);
  const rawGroupAvatar = activeRoom?.avatar || activeRoom?.avatarUrl || "";
  const groupAvatar = isDisplayableAvatarSrc(rawGroupAvatar) ? rawGroupAvatar : GROUP_FALLBACK_AVATAR;
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

  const handleSendLocation = async () => {
    if (locationLoading) return;
    setLocationLoading(true);
    try {
      await onSendLocation?.();
    } finally {
      setLocationLoading(false);
    }
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
    return (
      <div className="flex h-full min-h-0 items-center justify-center text-sm text-slate-400">
        Chọn hội thoại để bắt đầu chat
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2 shadow-sm md:px-4">
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
          <button
            type="button"
            onClick={onStartVideoCall}
            title="Gọi video"
            className="rounded-full bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
          >
            <Video className="h-5 w-5" />
          </button>
          {activeRoom.type === "group" && (
            <>
              {canEditGroup && (
                <button
                  type="button"
                  onClick={() => openGroupInfo("members")}
                  title="Thêm thành viên"
                  className="rounded-full bg-emerald-50 p-2 text-emerald-600 transition hover:bg-emerald-100"
                >
                  <UserPlus className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => openGroupInfo("overview")}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Thông tin nhóm
              </button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F5F7FA] px-4 pb-4 pt-2">
        {pinnedCount > 0 && (
          <div className="relative sticky top-0 z-30 -mx-4 mb-2 border-b border-slate-200 bg-white px-3 py-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollToPinnedMessage(latestPinnedPreview?.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-xs font-bold text-slate-800">Tin nhắn</div>
                  <div className="truncate text-[11px] text-slate-600">
                    {getPinnedPreviewText(latestPinnedPreview)}
                  </div>
                </div>
              </button>

              {pinnedCount > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPinnedList((prev) => !prev);
                    setShowPinnedMenu(false);
                  }}
                  className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  +{pinnedCount - 1} ghim
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showPinnedList ? "rotate-180" : ""}`} />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowPinnedMenu((prev) => !prev);
                  setShowPinnedList(false);
                }}
                className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Tùy chọn tin ghim"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {showPinnedList && pinnedCount > 1 && (
              <div className="max-h-28 space-y-0.5 overflow-y-auto border-t border-slate-100 py-1">
                {pinnedMessages.map((pm, index) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      scrollToPinnedMessage(pm.id);
                      setShowPinnedList(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-50"
                  >
                    <span className="w-4 text-center text-[10px] font-bold text-slate-400">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">
                      {getPinnedPreviewText(pm)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showPinnedMenu && (
              <div className="absolute right-3 top-full z-40 mt-0.5 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinnedMenu(false);
                    setShowPinnedList(true);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  Xem {pinnedCount} tin ghim
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinnedMenu(false);
                    if (latestPinnedPreview) doMessageAction("pin", latestPinnedPreview.id);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  Bỏ ghim tin mới nhất
                </button>
              </div>
            )}
          </div>
        )}
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
              ref={(node) => {
                if ((m.isPinned ?? m.pinned) && node) {
                  pinnedMessageRefs.current[m.id] = node;
                } else if (pinnedMessageRefs.current[m.id]) {
                  delete pinnedMessageRefs.current[m.id];
                }
                if (m.id === latestPinnedMessageId) {
                  latestPinnedMessageRef.current = node;
                }
              }}
              className={`group relative flex items-start gap-2 ${isMine ? "justify-end" : "justify-start"}`}
              onMouseEnter={() => setHoverMessageId(m.id)}
              onMouseLeave={() => {
                setHoverMessageId(null);
                setReactionHoverId(null);
              }}
            >
              {!isMine && <Avatar src={senderAvatar} name={senderName} className="mt-1 h-7 w-7 rounded-full border border-slate-200 object-cover" />}
              <div className={`relative flex max-w-[88%] flex-col sm:max-w-[82%] ${isMine ? "items-end" : "items-start"}`}>
                <Bubble
                  text={m.unsentForAll ? "Tin nhắn đã được thu hồi" : m.text}
                  isMine={isMine}
                  media={m.unsentForAll ? null : (m.media || (m.fileUrl ? { type: "file", fileUrl: m.fileUrl, name: m.fileName || m.name } : null))}
                  location={m.location}
                  fileUrl={m.fileUrl}
                  fileName={m.fileName || m.name}
                  type={m.type}
                  messageType={m.messageType}
                  callLog={m.callLog}
                  reactions={reactions}
                  replyTo={m.replyTo}
                  createdAt={m.createdAt}
                  pinned={m.pinned}
                  isPinned={m.isPinned ?? m.pinned}
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
                    <button onClick={() => onReplyMessage(m)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"><CornerUpLeft className="h-3.5 w-3.5"/> Phản hồi</button>
                    <button onClick={() => { setForwardingMessageId?.(m.id); setMessageMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"><Forward className="h-3.5 w-3.5"/> Chuyển tiếp</button>
                    <button
                      onClick={() => doMessageAction("pin", m.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <Pin className="h-3.5 w-3.5" />
                      {(m.isPinned ?? m.pinned)
                        ? "Bỏ ghim"
                        : pinnedCount >= MAX_PINNED_MESSAGES
                          ? `Đã đủ ${MAX_PINNED_MESSAGES} tin ghim`
                          : `Ghim tin nhắn (${pinnedCount}/${MAX_PINNED_MESSAGES})`}
                    </button>
                    {isMine && (
                      <button onClick={() => doMessageAction("unsend", m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"><Undo2 className="h-3.5 w-3.5"/> Thu hồi</button>
                    )}
                    <button onClick={() => doMessageAction("delete", m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-slate-50"><Trash2 className="h-3.5 w-3.5"/> Xóa</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="shrink-0">
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

      <form onSubmit={sendRoom} className="shrink-0 border-t border-slate-100 bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
        <div className="mb-2 flex items-center gap-3 border-b border-slate-100 pb-2 text-slate-500">
          <button type="button" className="hover:text-slate-700" onClick={() => imageInputRef.current?.click()}><FileImage className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5" /></button>
          <button type="button" className="hover:text-slate-700" onClick={handleSendLocation} disabled={locationLoading}><MapPinned className="h-5 w-5" /></button>
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
      </div>

      <GroupInfoDrawer
        open={showGroupInfo}
        initialTab={groupInfoInitialTab}
        onClose={() => setShowGroupInfo(false)}
        activeRoom={activeRoom}
        user={user}
        myGroupRole={myGroupRole}
        newMemberId={newMemberId}
        setNewMemberId={setNewMemberId}
        contacts={contacts}
        performGroupAction={performGroupAction}
        onUpdateGroupMeta={onUpdateGroupMeta}
        busy={groupActionBusy}
      />
    </div>
  );
}

export default ChatMultiPurpose;