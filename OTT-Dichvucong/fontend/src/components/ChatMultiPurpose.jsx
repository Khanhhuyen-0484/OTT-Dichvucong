import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MoreHorizontal,
  Undo2,
  Trash2,
  Forward,
  Paperclip,
  Send,
  CornerUpLeft,
  Video,
  Settings,
  Edit2,
  Check,
  Image,
  Smile,
  UserPlus,
  Clock,
  ThumbsUp
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
  clearReply,
  onUpdateGroupInfo
}) {
  const myName = user?.fullName || "Bạn";
  const [reactionMap, setReactionMap] = useState({});
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const groupNameInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const reactionOptions = useMemo(() => ["👍", "❤️", "😄", "😲", "😭", "😡"], []);
  const messages = activeRoom?.messages || [];
  const peerUser = activeRoom?.members?.find((m) => m.id !== user?.id);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeRoom?.id]);

  useEffect(() => {
    setGroupNameInput(activeRoom?.name || "");
    setGroupAvatarFile(null);
    setIsEditingGroupName(false);
  }, [activeRoom?.id, activeRoom?.name]);

  // Auto focus name input when entering edit mode
  useEffect(() => {
    if (isEditingGroupName && groupNameInputRef.current) {
      groupNameInputRef.current?.focus();
    }
  }, [isEditingGroupName]);

  const handleSaveGroupInfo = async () => {
    if (!groupNameInput.trim()) return;
    setIsSavingGroup(true);
    try {
      await onUpdateGroupInfo?.({
        name: groupNameInput.trim(),
        avatarFile: groupAvatarFile
      });
      setGroupAvatarFile(null);
      setIsEditingGroupName(false);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleGroupNameKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSaveGroupInfo();
    } else if (e.key === "Escape") {
      setIsEditingGroupName(false);
      setGroupNameInput(activeRoom?.name || "");
    }
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGroupAvatarFile(file);
    // Auto-save avatar immediately
    setIsSavingGroup(true);
    try {
      await onUpdateGroupInfo?.({
        name: groupNameInput || activeRoom?.name,
        avatarFile: file
      });
      setGroupAvatarFile(null);
    } finally {
      setIsSavingGroup(false);
    }
  };

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

  return (
    <div className="col-span-8 p-2 sm:p-3 flex flex-col bg-[#F5F7FA] relative h-full">
      {roomErr && <div className="text-[10px] text-red-500 mb-2">{roomErr}</div>}
      {!activeRoom ? (
        <div className="text-sm text-slate-500 text-center py-16">Chọn hội thoại để bắt đầu chat</div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              {activeRoom.type === "group" ? (
                <UserAvatar user={{ fullName: activeRoom.name || "Nhóm chat" }} src={activeRoom.avatarUrl} size={40} />
              ) : (
                <UserAvatar user={peerUser || { fullName: "Người dùng" }} src={peerUser?.avatarUrl} size={40} showActive />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {activeRoom.type === "group"
                    ? activeRoom.name || "Nhóm chat"
                    : peerUser?.fullName || "Hội thoại"}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {activeRoom.type === "group" ? `${(activeRoom.members || []).length} thành viên` : "Đang hoạt động"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeRoom.type === "group" && (
                <button
                  type="button"
                  onClick={() => setShowGroupDrawer(true)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="mr-1 inline h-3.5 w-3.5" />
                  Thông tin
                </button>
              )}
              <button
                type="button"
                onClick={onStartVideoCall}
                className="rounded-lg bg-[#003366] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00284f]"
              >
                <Video className="mr-1 inline h-3.5 w-3.5" />
                Video
              </button>
            </div>
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
                  className={`group flex ${isMine ? "justify-end" : "justify-start"} items-end gap-2 px-2`}
                  onMouseEnter={() => setHoveredMessageId(m.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {/* Avatar for receiver messages - only show at cluster end */}
                  {!isMine && (
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      {isClusterEnd && (
                        <UserAvatar user={sender || { fullName: senderName }} src={senderAvatar} size={32} />
                      )}
                    </div>
                  )}

                  {/* Message Container */}
                  <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[min(85vw,450px)] relative`}>
                    {/* Emoji Reactions Bar - Shows on Hover */}
                    {canShowMenu && hoveredMessageId === m.id && (
                      <div className={`mb-1 inline-flex gap-1 rounded-full bg-white px-2 py-1 shadow-lg ring-1 ring-slate-200 ${
                        isMine ? "self-end mr-2" : "self-start ml-2"
                      }`}>
                        {reactionOptions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, emoji)}
                            className="text-xs transition-transform hover:scale-125 active:scale-100 cursor-pointer"
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
                            className={`absolute top-2 text-slate-400 transition hover:text-slate-600 ${
                              hoveredMessageId === m.id ? "opacity-100" : "opacity-0"
                            } ${isMine ? "-left-8" : "-right-8"}`}
                            aria-label="Menu"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {messageMenuId === m.id && (
                            <div
                              className={`absolute top-0 z-40 flex flex-col gap-1 rounded-[12px] bg-white shadow-xl border border-slate-200 overflow-hidden ${
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
            <div ref={chatBottomRef} />
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
          <form onSubmit={sendRoom} className="mt-3 flex flex-col gap-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
            {/* Toolbar - Tính năng */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
              {/* Nút Gửi Ảnh */}
              <label
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer transition text-slate-600 hover:text-slate-800"
                title="Gửi ảnh"
              >
                <Image className="h-5 w-5" />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickMedia(e.target.files?.[0] || null)}
                />
              </label>

              {/* Nút Gửi File */}
              <label
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer transition text-slate-600 hover:text-slate-800"
                title="Gửi file"
              >
                <Paperclip className="h-5 w-5" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  className="hidden"
                  onChange={(e) => onPickMedia(e.target.files?.[0] || null)}
                />
              </label>

              {/* Nút Sticker */}
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer transition text-slate-600 hover:text-slate-800"
                title="Sticker"
              >
                <Smile className="h-5 w-5" />
              </button>

              {/* Nút Danh Thiếp */}
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer transition text-slate-600 hover:text-slate-800"
                title="Danh thiếp"
              >
                <UserPlus className="h-5 w-5" />
              </button>

              {/* Nút Nhắc Hẹn */}
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer transition text-slate-600 hover:text-slate-800"
                title="Nhắc hẹn"
              >
                <Clock className="h-5 w-5" />
              </button>
            </div>

            {/* Input Section */}
            <div className="flex gap-2 items-end">
              {/* Input Tin Nhắn */}
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 text-sm px-4 py-3 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-slate-400"
              />

              {/* Nút Like / Send */}
              {!roomInput.trim() && !roomMedia ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    // Có thể thêm logic like message hoặc reaction tại đây
                  }}
                  className="p-2.5 rounded-full hover:bg-yellow-100 cursor-pointer transition text-yellow-500 hover:text-yellow-600 flex-shrink-0"
                  title="Thích"
                >
                  <ThumbsUp className="h-5 w-5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={roomLoading}
                  className="p-2.5 rounded-full bg-[#0084ff] text-white hover:bg-[#0073e6] disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
                  title="Gửi"
                >
                  <Send size={20} />
                </button>
              )}
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
        </div>
      )}
      {showGroupDrawer && activeRoom?.type === "group" && (
        <div className="fixed inset-0 z-[65] flex justify-end bg-black/30">
          <div className="h-full w-full max-w-md bg-white shadow-xl p-4 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Thông tin nhóm</h3>
              <button type="button" onClick={() => setShowGroupDrawer(false)} className="text-xs text-slate-500">
                Đóng
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">Ảnh nhóm</label>
              <label className="inline-flex cursor-pointer items-center gap-3 group">
                <UserAvatar user={{ fullName: groupNameInput || activeRoom.name }} src={activeRoom.avatarUrl} size={56} className="group-hover:opacity-75 transition" />
                <div>
                  <span className="text-xs text-blue-600 font-semibold">Chọn ảnh</span>
                  <div className="text-[10px] text-slate-500">Ảnh sẽ được cập nhật ngay lập tức</div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                  disabled={isSavingGroup}
                />
              </label>
              <div className="flex items-center gap-2 justify-between">
                <label className="block text-xs font-semibold text-slate-600">Tên nhóm</label>
                {(myGroupRole === "owner" || myGroupRole === "deputy") && !isEditingGroupName && (
                  <button
                    type="button"
                    onClick={() => setIsEditingGroupName(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    <Edit2 className="inline h-3 w-3 mr-1" />
                    Sửa
                  </button>
                )}
              </div>
              {isEditingGroupName ? (
                <div className="flex gap-2">
                  <input
                    ref={groupNameInputRef}
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    onBlur={handleSaveGroupInfo}
                    onKeyDown={handleGroupNameKeyDown}
                    disabled={isSavingGroup}
                    className="flex-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Nhập tên nhóm"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGroupInfo}
                    disabled={isSavingGroup}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 bg-slate-50">
                  {groupNameInput || activeRoom?.name || "Nhóm chat"}
                </div>
              )}
              <div className="border-t border-slate-200 pt-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">Thành viên</div>
                <div className="space-y-2">
                  {(activeRoom.members || []).map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <UserAvatar user={m} src={m.avatarUrl} size={28} showActive={m.id !== user?.id} />
                      <div className="text-xs text-slate-700">
                        {m.fullName} <span className="text-slate-500">({m.role})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {myGroupRole === "owner" && (
                <button
                  type="button"
                  onClick={() => performGroupAction("dissolve")}
                  className="w-full rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  Giải tán nhóm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatMultiPurpose;