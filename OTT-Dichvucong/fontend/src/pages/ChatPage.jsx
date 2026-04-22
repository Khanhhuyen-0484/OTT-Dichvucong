import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, X } from "lucide-react";

// Components
import Bubble from "../components/Bubble.jsx";
import ContactList from "../components/ContactList.jsx";
import ChatMultiPurpose from "../components/ChatMultiPurpose.jsx";
import GroupCreator from "../components/GroupCreator.jsx";
import GovHeader from "../components/GovHeader.jsx";
import VideoCall from "../components/VideoCall.jsx";
import IncomingCallModal from "../components/IncomingCallModal.jsx";

// Context & Libs
import { useAuth } from "../context/AuthContext.jsx";
import {
  addGroupMember,
  assignGroupDeputy,
  createGroupRoom,
  deleteRoomMessageForMe,
  dissolveGroup,
  ensureDirectRoom,
  forwardRoomMessage,
  getApiErrorMessage,
  getChatContacts,
  getChatRooms,
  getStaffChat,
  postRoomMessage,
  postStaffChat,
  removeGroupDeputy,
  removeGroupMember,
  unsendRoomMessage,
} from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import { uploadToS3 } from "../lib/uploadToS3.js";

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#003366] border-t-transparent" />
        <span className="text-sm font-bold text-slate-600">Đang tải hệ thống...</span>
      </div>
    </div>
  );
}

function ForwardModal({ rooms, activeRoomId, userId, doForward, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Chuyển tiếp</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {rooms
            .filter((r) => r.id !== activeRoomId)
            .map((r) => (
              <button
                key={r.id}
                onClick={() => doForward(r.id)}
                className="w-full rounded-2xl px-4 py-4 text-left text-sm font-semibold hover:bg-blue-50 border border-slate-100 transition-all active:scale-[0.98]"
              >
                {r.type === "group"
                  ? `👥 ${r.name || "Nhóm"}`
                  : `👤 ${r.members?.find((m) => m.id !== userId)?.fullName || "Người dùng"}`}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const chatEndRef = useRef(null);

  const [tabState, setTabState]                       = useState("multi");
  const [chatModeTab, setChatModeTab]                 = useState("rooms");
  const [rooms, setRooms]                             = useState([]);
  const [contacts, setContacts]                       = useState([]);
  const [activeRoomId, setActiveRoomId]               = useState(null);
  const [contactQuery, setContactQuery]               = useState("");

  const [roomInput, setRoomInput]                     = useState("");
  const [roomMedia, setRoomMedia]                     = useState(null);
  const [roomLoading, setRoomLoading]                 = useState(false);
  const [roomErr, setRoomErr]                         = useState(null);
  const [messageMenuId, setMessageMenuId]             = useState(null);
  const [forwardingMessageId, setForwardingMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage]           = useState(null);
  const [newMemberId, setNewMemberId]                 = useState("");

  const [staffMessages, setStaffMessages]             = useState([]);
  const [staffInput, setStaffInput]                   = useState("");
  const [staffLoading, setStaffLoading]               = useState(false);
  const [staffUnread, setStaffUnread]                 = useState(0);

  const [videoCallState, setVideoCallState]           = useState(null);
  const [incomingCall, setIncomingCall]               = useState(null);

  const [showGroupModal, setShowGroupModal]           = useState(false);
  const [groupName, setGroupName]                     = useState("");
  const [groupAvatar, setGroupAvatar]                 = useState("");
  const [groupMemberIds, setGroupMemberIds]           = useState([]);

  // ─── Refs: cho phép socket handler đọc giá trị mới nhất
  //           mà không cần re-register listener ────────────────────────────────
  const activeRoomIdRef = useRef(activeRoomId);
  const tabStateRef     = useRef(tabState);
  const loadRoomsRef    = useRef(null);
  const loadStaffRef    = useRef(null);
  const scrollBotRef    = useRef(null);

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { tabStateRef.current     = tabState;     }, [tabState]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const { data } = await getChatRooms();
      setRooms(data.rooms || []);
      return data.rooms || [];
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
      return [];
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await getChatContacts(contactQuery);
      setContacts(data.contacts || []);
    } catch (err) {
      console.error(err);
    }
  }, [contactQuery]);

  const loadStaff = useCallback(async () => {
    try {
      const { data } = await getStaffChat();
      setStaffMessages(data.messages || []);
      setTimeout(scrollToBottom, 200);
    } catch (err) {
      console.error(err);
    }
  }, [scrollToBottom]);

  // Cập nhật refs mỗi khi callback thay đổi
  useEffect(() => { loadRoomsRef.current = loadRooms;     }, [loadRooms]);
  useEffect(() => { loadStaffRef.current = loadStaff;     }, [loadStaff]);
  useEffect(() => { scrollBotRef.current = scrollToBottom; }, [scrollToBottom]);

  // ─── Socket: đăng ký 1 lần duy nhất khi user ready ──────────────────────────
  // Mọi giá trị động (activeRoomId, tabState, callback) đều đọc qua ref
  // → listener không bao giờ bị off/on lại → không bỏ sót event nào.

  useEffect(() => {
    if (!ready || !user) return;

    const socket = connectSocket();

    const handleNewMessage = async (msg) => {
      console.log("[ChatPage] 📨 new-message:", msg);

      // Reload rooms để lấy messages mới nhất của tất cả thành viên
      await loadRoomsRef.current();

      // Scroll xuống nếu tin thuộc room đang mở
      const incomingRoomId = msg?.roomId ?? null;
      const currentRoomId  = activeRoomIdRef.current;
      const isActiveRoom   = !incomingRoomId || incomingRoomId === currentRoomId;
      if (isActiveRoom) {
        setTimeout(() => scrollBotRef.current(), 100);
      }

      // Xử lý tab staff
      if (tabStateRef.current === "staff") {
        loadStaffRef.current();
      } else if (msg?.from === "staff") {
        setStaffUnread((prev) => prev + 1);
      }
    };

    const handleIncomingCall = (data) => {
      console.log("[ChatPage] 📞 incoming-call:", data);
      if (data.isGroupCall) {
        setIncomingCall((prev) => ({
          isGroupCall:  true,
          groupName:    data.groupName || prev?.groupName || "Cuộc gọi nhóm",
          roomId:       data.roomId,
          callerOffers: { ...(prev?.callerOffers || {}), [data.fromUserId]: data.offer },
          callerNames:  (prev?.callerNames || []).includes(data.callerName)
            ? (prev?.callerNames || [])
            : [...(prev?.callerNames || []), data.callerName],
          callerUserId: prev?.callerUserId || data.fromUserId,
        }));
      } else {
        setIncomingCall({
          isGroupCall:  false,
          callerName:   data.callerName,
          callerUserId: data.fromUserId,
          roomId:       data.roomId,
          offer:        data.offer,
        });
      }
    };

    socket.on("new-message",   handleNewMessage);
    socket.on("incoming-call", handleIncomingCall);

    return () => {
      socket.off("new-message",   handleNewMessage);
      socket.off("incoming-call", handleIncomingCall);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]); // ← chỉ [ready, user], mọi thứ khác đọc qua ref

  // ─── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (ready && user) {
      loadRooms();
      loadContacts();
      if (tabState === "staff") loadStaff();
    }
  }, [ready, user, tabState, contactQuery, loadRooms, loadContacts, loadStaff]);

  // Scroll xuống khi chọn room mới
  useEffect(() => {
    if (activeRoomId) setTimeout(scrollToBottom, 150);
  }, [activeRoomId, scrollToBottom]);

  // ─── Call Handlers ────────────────────────────────────────────────────────────

  const startVideoCall = useCallback(() => {
    const currentRoom = rooms.find((r) => r.id === activeRoomId);
    if (!currentRoom) return;
    const callRoomId = `call_${activeRoomId}_${Date.now()}`;

    if (currentRoom.type === "group") {
      const otherMembers = (currentRoom.members || []).filter((m) => m.id !== user.id);
      if (!otherMembers.length) return;
      setVideoCallState({ roomId: callRoomId, targetUserIds: otherMembers.map((m) => m.id), isCallee: false, isGroupCall: true });
    } else {
      const other = currentRoom.members?.find((m) => m.id !== user.id);
      if (!other) return;
      setVideoCallState({ roomId: callRoomId, targetUserId: other.id, isCallee: false, isGroupCall: false });
    }
  }, [activeRoomId, rooms, user]);

  const acceptCall = useCallback((call) => {
    if (call.isGroupCall) {
      setVideoCallState({
        roomId:        call.roomId,
        targetUserIds: Object.keys(call.callerOffers || { [call.callerUserId]: call.offer }),
        isCallee:      true,
        callerOffers:  call.callerOffers || { [call.callerUserId]: call.offer },
        isGroupCall:   true,
      });
    } else {
      setVideoCallState({ roomId: call.roomId, targetUserId: call.callerUserId, isCallee: true, callerOffer: call.offer, isGroupCall: false });
    }
    setIncomingCall(null);
  }, []);

  const rejectCall = useCallback(() => {
    if (incomingCall) connectSocket().emit("call-rejected", { toUserId: incomingCall.callerUserId });
    setIncomingCall(null);
  }, [incomingCall]);

  // ─── Send message ─────────────────────────────────────────────────────────────

  const sendRoom = async (e) => {
    e?.preventDefault();
    if (!activeRoomId || roomLoading || (!roomInput.trim() && !roomMedia)) return;
    setRoomLoading(true);
    try {
      let mediaPayload = null;
      if (roomMedia) {
        const uploaded = await uploadToS3(roomMedia);
        mediaPayload = { type: roomMedia.type.startsWith("video") ? "video" : "image", url: uploaded.publicUrl || uploaded.url };
      }
      await postRoomMessage(activeRoomId, { text: roomInput, media: mediaPayload, replyToId: replyToMessage?.id });
      setRoomInput("");
      setRoomMedia(null);
      setReplyToMessage(null);
      await loadRooms();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  };

  const activeRoom  = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);
  const myGroupRole = useMemo(() => activeRoom?.members?.find((m) => m.id === user?.id)?.role, [activeRoom, user]);

  if (!ready) return <LoadingScreen />;
  if (!user)  return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <GovHeader />

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 mx-auto w-full max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-2 hover:bg-white rounded-full transition-all shadow-sm border border-slate-200 active:scale-90">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <h1 className="text-2xl font-black text-[#003366] tracking-tight">Trung tâm Phản hồi</h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mb-4 flex gap-2 rounded-2xl bg-slate-200/50 p-1.5 border border-slate-200">
          <button
            onClick={() => setTabState("multi")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all
              ${tabState === "multi" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:bg-white/50"}`}
          >
            Phòng Chat & Nhóm
          </button>
          <button
            onClick={() => { setTabState("staff"); setStaffUnread(0); }}
            className={`flex-1 relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all
              ${tabState === "staff" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:bg-white/50"}`}
          >
            Hỗ trợ Cán bộ
            {staffUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white animate-bounce shadow-lg">!</span>
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tabState === "multi" ? (
            <div className="grid h-full gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4 h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <ContactList
                  chatModeTab={chatModeTab} setChatModeTab={setChatModeTab}
                  contactQuery={contactQuery} setContactQuery={setContactQuery}
                  contacts={contacts} rooms={rooms} activeRoomId={activeRoomId}
                  setActiveRoomId={setActiveRoomId}
                  openDirectChat={async (id) => {
                    const { data } = await ensureDirectRoom(id);
                    setActiveRoomId(data.room.id);
                    loadRooms();
                  }}
                  setShowGroupModal={() => setShowGroupModal(true)}
                  user={user}
                />
              </div>
              <div className="lg:col-span-8 h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <ChatMultiPurpose
                  activeRoom={activeRoom} user={user}
                  roomInput={roomInput} setRoomInput={setRoomInput}
                  sendRoom={sendRoom} onStartVideoCall={startVideoCall}
                  chatEndRef={chatEndRef}
                  messageMenuId={messageMenuId} setMessageMenuId={setMessageMenuId}
                  doMessageAction={async (action, mid) => {
                    if (action === "unsend")       await unsendRoomMessage(activeRoomId, mid);
                    else if (action === "delete")  await deleteRoomMessageForMe(activeRoomId, mid);
                    else if (action === "forward") setForwardingMessageId(mid);
                    loadRooms();
                    setMessageMenuId(null);
                  }}
                  roomMedia={roomMedia} setRoomMedia={setRoomMedia}
                  myGroupRole={myGroupRole}
                  newMemberId={newMemberId} setNewMemberId={setNewMemberId}
                  contacts={contacts}
                  performGroupAction={async (act, tid) => {
                    try {
                      if (act === "dissolve")      { await dissolveGroup(activeRoomId); setActiveRoomId(null); }
                      else if (act === "add")      { if (!tid) return; await addGroupMember(activeRoomId, tid); setNewMemberId(""); }
                      else if (act === "remove")   await removeGroupMember(activeRoomId, tid);
                      else if (act === "promote")  await assignGroupDeputy(activeRoomId, tid);
                      else if (act === "demote")   await removeGroupDeputy(activeRoomId, tid);
                      loadRooms();
                    } catch (err) { setRoomErr(getApiErrorMessage(err)); }
                  }}
                  roomLoading={roomLoading} onPickMedia={setRoomMedia}
                  forwardingMessageId={forwardingMessageId}
                  setForwardingMessageId={setForwardingMessageId}
                  doForward={async (tid) => {
                    await forwardRoomMessage(activeRoomId, forwardingMessageId, tid);
                    setForwardingMessageId(null);
                    loadRooms();
                  }}
                  rooms={rooms}
                  onReplyMessage={setReplyToMessage} replyToMessage={replyToMessage}
                  clearReply={() => setReplyToMessage(null)}
                  roomErr={roomErr}
                />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">
              <div className="bg-[#003366] p-5 text-white flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">CB</div>
                  <div>
                    <h2 className="font-bold text-sm">Hệ thống Tiếp dân Trực tuyến</h2>
                    <p className="text-[10px] text-blue-200 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" /> Sẵn sàng hỗ trợ
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                {staffMessages.map((m, i) => {
                  const isMine = m.from === "user" || m.from === "citizen";
                  return <Bubble key={i} from={isMine ? "user" : "staff"} text={m.content || m.text} isMine={isMine} label={isMine ? user.fullName : "Cán bộ trực"} />;
                })}
                <div ref={chatEndRef} />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!staffInput.trim()) return;
                  setStaffLoading(true);
                  try { await postStaffChat(staffInput); setStaffInput(""); loadStaff(); }
                  finally { setStaffLoading(false); }
                }}
                className="p-4 border-t border-slate-100 bg-white flex gap-3"
              >
                <input
                  value={staffInput} onChange={(e) => setStaffInput(e.target.value)}
                  placeholder="Nhập thắc mắc về thủ tục hành chính..."
                  className="flex-1 rounded-2xl bg-slate-100 border-none px-5 py-3 text-sm focus:ring-2 focus:ring-[#003366] transition-all"
                />
                <button type="submit" disabled={staffLoading}
                  className="rounded-2xl bg-[#003366] px-6 text-white font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                  {staffLoading ? <div className="h-4 w-4 animate-spin border-2 border-white border-t-transparent rounded-full" /> : <Send size={18} />}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* ── Overlays ── */}
      <GroupCreator
        showGroupModal={showGroupModal} setShowGroupModal={setShowGroupModal}
        groupName={groupName} setGroupName={setGroupName}
        groupAvatar={groupAvatar} setGroupAvatar={setGroupAvatar}
        groupMemberIds={groupMemberIds} setGroupMemberIds={setGroupMemberIds}
        contacts={contacts}
        createGroup={async () => {
          if (!groupName.trim()) return;
          await createGroupRoom({ ownerId: user.id, name: groupName, avatarUrl: groupAvatar, memberIds: groupMemberIds });
          setShowGroupModal(false); setGroupName(""); setGroupMemberIds([]);
          loadRooms();
        }}
      />

      {forwardingMessageId && (
        <ForwardModal
          rooms={rooms} activeRoomId={activeRoomId} userId={user.id}
          onClose={() => setForwardingMessageId(null)}
          doForward={async (tid) => {
            await forwardRoomMessage(activeRoomId, forwardingMessageId, tid);
            setForwardingMessageId(null); loadRooms();
          }}
        />
      )}

      {incomingCall && (
        <IncomingCallModal call={incomingCall} onAccept={() => acceptCall(incomingCall)} onReject={rejectCall} />
      )}

      {videoCallState && (
        <VideoCall
          roomId={videoCallState.roomId}
          targetUserId={videoCallState.targetUserId}
          targetUserIds={videoCallState.targetUserIds}
          isCallee={videoCallState.isCallee}
          callerOffer={videoCallState.callerOffer}
          callerOffers={videoCallState.callerOffers}
          currentUserName={user.fullName}
          activeRoom={activeRoom}
          onClose={() => setVideoCallState(null)}
        />
      )}

      {roomErr && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-right-10 flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-full"><X size={16} /></div>
          <span className="text-sm font-bold">{roomErr}</span>
          <button onClick={() => setRoomErr(null)} className="ml-4 text-xs underline opacity-80">Đóng</button>
        </div>
      )}
    </div>
  );
}