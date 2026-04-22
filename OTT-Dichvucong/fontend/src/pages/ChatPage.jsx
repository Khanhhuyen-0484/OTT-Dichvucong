import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  ArrowLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  X
} from "lucide-react";
import ContactList from "../components/ContactList.jsx";
import ChatMultiPurpose from "../components/ChatMultiPurpose.jsx";
import GroupCreator from "../components/GroupCreator.jsx";
import AddFriendModal from "../components/AddFriendModal.jsx";
import FriendHubModal from "../components/FriendHubModal.jsx";
import GovHeader from "../components/GovHeader.jsx";
import VideoCall from "../components/VideoCall.jsx";
import IncomingCallModal from "../components/IncomingCallModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  addGroupMember,
  assignGroupDeputy,
  createGroupRoom,
  deleteFriend,
  deleteFriendRequest,
  deleteRoomMessageForMe,
  dissolveGroup,
  ensureDirectRoom,
  forwardRoomMessage,
  getApiErrorMessage,
  getBlockedFriends,
  getChatContacts,
  getFriendDiscovery,
  getFriendRequests,
  getFriendSuggestions,
  getGroupInvites,
  getChatRooms,
  getStaffChat,
  postBlockFriend,
  postFriendRequest,
  postFriendRequestResponse,
  postGroupInviteResponse,
  postGroupInvites,
  postUnblockFriend,
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

  const [tabState, setTabState] = useState("multi"); // "multi" or "staff"
  const [contacts, setContacts] = useState([]);
  const [chatModeTab, setChatModeTab] = useState("rooms");
  const [contactQuery, setContactQuery] = useState("");
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [roomMedia, setRoomMedia] = useState(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomErr, setRoomErr] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [forwardingMessageId, setForwardingMessageId] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showFriendHubModal, setShowFriendHubModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendDiscovery, setFriendDiscovery] = useState([]);
  const [friendIncomingRequests, setFriendIncomingRequests] = useState([]);
  const [friendOutgoingRequests, setFriendOutgoingRequests] = useState([]);
  const [friendDirectory, setFriendDirectory] = useState([]);
  const [friendSuggestions, setFriendSuggestions] = useState([]);
  const [groupInvites, setGroupInvites] = useState([]);
  const [blockedFriends, setBlockedFriends] = useState([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendSearchNotice, setFriendSearchNotice] = useState("");
  const [toast, setToast] = useState(null);
  const [mobileRoomOpen, setMobileRoomOpen] = useState(false);

  // Staff chat states
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffErr, setStaffErr] = useState(null);
  const [staffUnread, setStaffUnread] = useState(0);

  const [videoCallState, setVideoCallState] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

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

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  // Load contacts
  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getChatContacts(contactQuery);
      setContacts(data.contacts || []);
    } catch (err) {
      console.error(err);
    }
  }, [user, contactQuery]);

  const loadFriendDiscovery = useCallback(async (query = "") => {
    if (!user) return;
    const raw = String(query || "").trim();
    const normalizedDigits = raw.replace(/\D/g, "");
    const isValidLookup = raw.includes("@") || normalizedDigits.length >= 8;
    if (!raw) {
      setFriendSearchNotice("Nhập email hoặc số điện thoại để tìm và kết bạn.");
      setFriendDiscovery([]);
      return;
    }
    if (!isValidLookup) {
      setFriendSearchNotice("Chỉ hỗ trợ tìm bạn bằng email hoặc số điện thoại để tránh trùng tên.");
      setFriendDiscovery([]);
      return;
    }
    try {
      const { data } = await getFriendDiscovery(query);
      setFriendDiscovery(data.users || []);
      setFriendSearchNotice("");
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

  const loadFriendRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getFriendRequests();
      setFriendIncomingRequests(data.incoming || data.requests || []);
      setFriendOutgoingRequests(data.outgoing || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

  const loadFriendSuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getFriendSuggestions(5);
      setFriendSuggestions(data.users || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

  const loadFriendDirectory = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getChatContacts("");
      setFriendDirectory(data.contacts || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

  const loadGroupInvites = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getGroupInvites();
      setGroupInvites(data.invites || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

  const loadBlockedFriends = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getBlockedFriends();
      setBlockedFriends(data.users || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

  const loadStaff = useCallback(async () => {
    try {
      const { data } = await getStaffChat();
      setStaffMessages(data.messages || []);
      setTimeout(scrollToBottom, 200);
    } catch (err) {
      console.error(err);
    }
  }, [scrollToBottom]);

  useEffect(() => { loadRoomsRef.current = loadRooms; }, [loadRooms]);
  useEffect(() => { loadStaffRef.current = loadStaff; }, [loadStaff]);
  useEffect(() => { scrollBotRef.current = scrollToBottom; }, [scrollToBottom]);

  // Load data based on tab
  useEffect(() => {
    if (!ready || !user) return;
    
    if (tabState === "staff") {
      loadStaff();
    } else {
      loadContacts();
      loadRooms();
      loadFriendRequests();
      loadFriendDirectory();
      loadGroupInvites();
      loadBlockedFriends();
    }
  }, [ready, user, tabState, loadContacts, loadRooms, loadStaff, loadFriendRequests, loadFriendDirectory, loadGroupInvites, loadBlockedFriends]);

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
    if (rooms.length > 0 && !activeRoomId) {
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const activeRoom = useMemo(() => {
    return rooms.find((r) => r.id === activeRoomId) || null;
  }, [rooms, activeRoomId]);

  const activeMessagesLength = activeRoom?.messages?.length || 0;

  const myGroupRole = useMemo(() => {
    if (!activeRoom || activeRoom.type !== "group") return null;
    return activeRoom.members?.find((m) => m.id === user?.id)?.role || null;
  }, [activeRoom, user]);

  const openDirectChat = useCallback(async (contactId) => {
    try {
      const { data } = await ensureDirectRoom(contactId);
      setActiveRoomId(data.room.id);
      setChatModeTab("rooms");
      setTabState("multi");
      loadRooms();
      loadContacts();
      if (tabState === "staff") loadStaff();
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [loadRooms]);

  const openStaffChat = useCallback(() => {
    setTabState("staff");
    setStaffUnread(0);
  }, []);

  const openAddFriendModal = useCallback(() => {
    setShowAddFriendModal(true);
    setFriendQuery("");
    setFriendSearchNotice("Nhập email hoặc số điện thoại để tìm và kết bạn.");
    setFriendDiscovery([]);
    loadFriendRequests();
    loadFriendSuggestions();
  }, [loadFriendRequests, loadFriendSuggestions]);

  const openFriendHubModal = useCallback(() => {
    setShowFriendHubModal(true);
    loadFriendDirectory();
    loadFriendRequests();
    loadFriendSuggestions();
    loadGroupInvites();
    loadBlockedFriends();
  }, [loadFriendDirectory, loadFriendRequests, loadFriendSuggestions, loadGroupInvites, loadBlockedFriends]);

  const handleSendFriendRequest = useCallback(async (targetUserId) => {
    setFriendLoading(true);
    try {
      await postFriendRequest(targetUserId);
      setToast({ type: "success", message: "Đã gửi lời mời kết bạn" });
      await Promise.all([
        loadFriendDiscovery(friendQuery),
        loadFriendRequests(),
        loadFriendSuggestions(),
        loadContacts(),
        loadFriendDirectory()
      ]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [friendQuery, loadContacts, loadFriendDiscovery, loadFriendRequests, loadFriendSuggestions, loadFriendDirectory]);

  const handleRespondFriendRequest = useCallback(async (targetUserId, action) => {
    setFriendLoading(true);
    try {
      await postFriendRequestResponse(targetUserId, action);
      setToast({
        type: "success",
        message: action === "accept" ? "Đã chấp nhận lời mời kết bạn" : "Đã từ chối lời mời kết bạn"
      });
      await Promise.all([
        loadFriendDiscovery(friendQuery),
        loadFriendRequests(),
        loadContacts(),
        loadFriendDirectory(),
        loadRooms()
      ]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [friendQuery, loadContacts, loadFriendDiscovery, loadFriendDirectory, loadFriendRequests, loadRooms]);

  const handleRevokeFriendRequest = useCallback(async (targetUserId) => {
    setFriendLoading(true);
    try {
      await deleteFriendRequest(targetUserId);
      setToast({ type: "success", message: "Đã thu hồi lời mời kết bạn" });
      await Promise.all([
        loadFriendDiscovery(friendQuery),
        loadFriendRequests(),
        loadFriendSuggestions(),
        loadContacts(),
        loadFriendDirectory()
      ]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [friendQuery, loadContacts, loadFriendDiscovery, loadFriendDirectory, loadFriendRequests, loadFriendSuggestions]);

  const handleRemoveFriend = useCallback(async (targetUserId) => {
    setFriendLoading(true);
    try {
      await deleteFriend(targetUserId);
      setToast({ type: "success", message: "Đã xóa bạn khỏi danh sách" });
      await Promise.all([loadContacts(), loadFriendDirectory(), loadFriendRequests(), loadRooms()]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [loadContacts, loadFriendDirectory, loadFriendRequests, loadRooms]);

  const handleBlockFriend = useCallback(async (targetUserId) => {
    setFriendLoading(true);
    try {
      await postBlockFriend(targetUserId);
      setToast({ type: "success", message: "Đã chặn người dùng" });
      await Promise.all([
        loadContacts(),
        loadFriendDirectory(),
        loadFriendRequests(),
        loadRooms(),
        loadGroupInvites(),
        loadBlockedFriends()
      ]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [loadContacts, loadFriendDirectory, loadFriendRequests, loadRooms, loadGroupInvites, loadBlockedFriends]);

  const handleInviteMembersToGroup = useCallback(async (roomId, memberIds) => {
    setFriendLoading(true);
    try {
      await postGroupInvites(roomId, memberIds);
      setToast({ type: "success", message: "Đã gửi lời mời vào nhóm" });
      await Promise.all([loadRooms(), loadGroupInvites()]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [loadRooms, loadGroupInvites]);

  const handleRespondGroupInvite = useCallback(async (roomId, action) => {
    setFriendLoading(true);
    try {
      await postGroupInviteResponse(roomId, action);
      setToast({
        type: "success",
        message: action === "accept" ? "Đã tham gia nhóm" : "Đã từ chối lời mời nhóm"
      });
      await Promise.all([loadRooms(), loadGroupInvites()]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [loadRooms, loadGroupInvites]);

  const handleUnblockFriend = useCallback(async (targetUserId) => {
    setFriendLoading(true);
    try {
      await postUnblockFriend(targetUserId);
      setToast({ type: "success", message: "Đã bỏ chặn người dùng" });
      await Promise.all([loadBlockedFriends(), loadFriendDiscovery(friendQuery)]);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [friendQuery, loadBlockedFriends, loadFriendDiscovery]);

  // Scroll xuống khi chọn room mới
  useEffect(() => {
    if (activeRoomId) setTimeout(scrollToBottom, 150);
  }, [activeRoomId, scrollToBottom]);

  useEffect(() => {
    if (!activeRoomId) return;
    setTimeout(scrollToBottom, 120);
  }, [activeRoomId, activeMessagesLength, scrollToBottom]);

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
    const text = roomInput.trim();
    const hasText = Boolean(text);
    const hasMedia = Boolean(roomMedia);
    if (!activeRoomId || roomLoading || (!hasText && !hasMedia)) return;
    setRoomLoading(true);
    try {
      let mediaPayload = null;
      if (roomMedia) {
        const uploaded = await uploadToS3(roomMedia);
        const mediaUrl = uploaded.publicUrl || uploaded.url;
        const isFile = /\.(pdf|doc|docx)$/i.test(roomMedia.name || "");
        mediaPayload = {
          type: isFile ? "file" : (roomMedia.type.startsWith("video") ? "video" : "image"),
          url: mediaUrl,
          name: roomMedia.name,
          fileUrl: isFile ? mediaUrl : undefined,
          fileType: isFile ? (roomMedia.name.split(".").pop() || "").toLowerCase() : undefined
        };
      }
      await postRoomMessage(activeRoomId, {
        text,
        media: mediaPayload,
        replyToMessageId: replyToMessage?.id || "",
        senderAvatar: user?.avatarUrl || user?.photoURL || user?.avatar || ""
      });
      connectSocket().emit("room-message:client", {
        roomId: activeRoomId,
        senderAvatar: user?.avatarUrl || user?.photoURL || user?.avatar || "",
        fileUrl: mediaPayload?.fileUrl || "",
        fileType: mediaPayload?.fileType || "",
      });
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

  // ─── Group and Message Actions ────────────────────────────────────────────────

  const performGroupAction = useCallback(async (action, memberId) => {
    if (!activeRoomId) return;
    setFriendLoading(true);
    try {
      switch (action) {
        case "add":
          if (!memberId) return;
          await addGroupMember(activeRoomId, memberId);
          setToast({ type: "success", message: "Đã thêm thành viên vào nhóm" });
          break;
        case "remove":
          if (!memberId) return;
          await removeGroupMember(activeRoomId, memberId);
          setToast({ type: "success", message: "Đã xóa thành viên khỏi nhóm" });
          break;
        case "promote":
          if (!memberId) return;
          await assignGroupDeputy(activeRoomId, memberId);
          setToast({ type: "success", message: "Đã phong phó nhóm" });
          break;
        case "demote":
          if (!memberId) return;
          await removeGroupDeputy(activeRoomId, memberId);
          setToast({ type: "success", message: "Đã hạ chức phó nhóm" });
          break;
        case "dissolve":
          await dissolveGroup(activeRoomId);
          setToast({ type: "success", message: "Đã giải tán nhóm" });
          break;
        default:
          return;
      }
      await loadRooms();
      setNewMemberId("");
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [activeRoomId, loadRooms]);

  const doMessageAction = useCallback(async (action, messageId) => {
    if (!activeRoomId || !messageId) return;
    setRoomLoading(true);
    try {
      switch (action) {
        case "unsend":
          await unsendRoomMessage(activeRoomId, messageId);
          setToast({ type: "success", message: "Đã thu hồi tin nhắn" });
          break;
        case "delete":
          await deleteRoomMessageForMe(activeRoomId, messageId);
          setToast({ type: "success", message: "Đã xóa tin nhắn" });
          break;
        default:
          return;
      }
      await loadRooms();
      setMessageMenuId(null);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  }, [activeRoomId, loadRooms]);

  const createGroup = useCallback(async () => {
    if (!groupName.trim() || groupMemberIds.length === 0) {
      setRoomErr("Vui lòng nhập tên nhóm và chọn thành viên");
      return;
    }
    setRoomLoading(true);
    try {
      await createGroupRoom({
        name: groupName,
        avatar: groupAvatar,
        memberIds: groupMemberIds
      });
      setToast({ type: "success", message: "Đã tạo nhóm thành công" });
      setGroupName("");
      setGroupAvatar("");
      setGroupMemberIds([]);
      setShowGroupModal(false);
      await loadRooms();
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  }, [groupName, groupAvatar, groupMemberIds, loadRooms]);

  const onPickMedia = useCallback((file) => {
    if (file) {
      setRoomMedia(file);
    }
  }, []);

  const onUpdateGroupMeta = useCallback(async ({ name, avatarFile }) => {
    if (!activeRoomId) return;
    let nextAvatar = null;
    if (avatarFile) {
      try {
        const uploaded = await uploadToS3(avatarFile);
        nextAvatar = uploaded?.publicUrl || uploaded?.url || null;
      } catch (err) {
        setRoomErr(getApiErrorMessage(err));
        return;
      }
    }
    setRooms((prev) => prev.map((room) => {
      if (room.id !== activeRoomId) return room;
      return {
        ...room,
        name: typeof name === "string" && name.trim() ? name.trim() : room.name,
        avatar: nextAvatar || room.avatar
      };
    }));
    if (name || nextAvatar) {
      setToast({ type: "success", message: "Đã cập nhật thông tin nhóm" });
    }
  }, [activeRoomId]);

  const doForward = useCallback(async (targetRoomId) => {
    if (!forwardingMessageId || !activeRoomId) return;
    setRoomLoading(true);
    try {
      await forwardRoomMessage(activeRoomId, forwardingMessageId, targetRoomId);
      setToast({ type: "success", message: "Đã chuyển tiếp tin nhắn" });
      await loadRooms();
      setForwardingMessageId(null);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  }, [activeRoomId, forwardingMessageId, loadRooms]);

  const sendStaff = useCallback(async () => {
    if (!staffInput.trim()) return;
    setStaffLoading(true);
    try {
      await postStaffChat(staffInput);
      setStaffInput("");
      await loadStaff();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setStaffErr(getApiErrorMessage(err));
    } finally {
      setStaffLoading(false);
    }
  }, [staffInput, loadStaff, scrollToBottom]);

  if (!ready) return <LoadingScreen />;
  if (!user)  return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <GovHeader />

      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
          <h1 className="text-xl font-bold text-slate-900">Hỗ trợ trực tuyến</h1>
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
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

        <div className="grid gap-4 lg:gap-6 lg:grid-cols-12">
          {tabState === "multi" ? (
            <>
              {/* Sidebar */}
              <div className={`${mobileRoomOpen ? "hidden" : "block"} lg:col-span-4 lg:block`}>
                <ContactList
                  chatModeTab={chatModeTab}
                  setChatModeTab={setChatModeTab}
                  contactQuery={contactQuery}
                  setContactQuery={setContactQuery}
                  contacts={contacts}
                  rooms={rooms}
                  activeRoomId={activeRoomId}
                  setActiveRoomId={setActiveRoomId}
                  openDirectChat={openDirectChat}
                  openStaffChat={openStaffChat}
                  setShowGroupModal={setShowGroupModal}
                  onOpenAddFriend={openAddFriendModal}
                  onOpenFriendHub={openFriendHubModal}
                  pendingHubCount={friendIncomingRequests.length + groupInvites.length}
                  user={user}
                  onSelectRoom={() => setMobileRoomOpen(true)}
                />
              </div>

              {/* Main Chat */}
              <div className={`${mobileRoomOpen ? "block" : "hidden"} lg:col-span-8 lg:block`}>
                <div className="mb-2 flex md:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileRoomOpen(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Quay lại danh sách
                  </button>
                </div>
                <div className="h-[calc(100vh-190px)] min-h-[460px] rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
                  <ChatMultiPurpose
                    roomErr={roomErr}
                    activeRoom={activeRoom}
                    user={user}
                    messageMenuId={messageMenuId}
                    setMessageMenuId={setMessageMenuId}
                    doMessageAction={doMessageAction}
                    roomMedia={roomMedia}
                    setRoomMedia={setRoomMedia}
                    myGroupRole={myGroupRole}
                    newMemberId={newMemberId}
                    setNewMemberId={setNewMemberId}
                    contacts={contacts}
                    performGroupAction={performGroupAction}
                    roomInput={roomInput}
                    setRoomInput={setRoomInput}
                    sendRoom={sendRoom}
                    roomLoading={roomLoading}
                    onPickMedia={onPickMedia}
                    forwardingMessageId={forwardingMessageId}
                    setForwardingMessageId={setForwardingMessageId}
                    doForward={doForward}
                    rooms={rooms}
                    onReplyMessage={setReplyToMessage}
                    onStartVideoCall={startVideoCall}
                    replyToMessage={replyToMessage}
                    clearReply={() => setReplyToMessage(null)}
                    chatEndRef={chatEndRef}
                    onUpdateGroupMeta={onUpdateGroupMeta}
                />
              </div>
            </div>
          </>
        ) : (
            // Staff chat tab
            <div className="lg:col-span-12">
              <div className="h-[calc(100vh-190px)] min-h-[460px] rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="border-b border-slate-200 bg-[#003366] text-white p-4">
                  <h2 className="font-bold text-sm">👤 Cán bộ hỗ trợ</h2>
                  <p className="text-xs text-emerald-400 mt-1">Hỗ trợ trực tuyến</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {staffErr && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                      {staffErr}
                    </div>
                  )}
                  
                  {staffMessages.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Hãy để lại tin nhắn, cán bộ sẽ phản hồi bạn sớm nhất.
                    </div>
                  ) : (
                    staffMessages.map((m, i) => {
                      const isMine = m.from === "user" || m.from === "citizen";
                      return (
                        <Bubble
                          key={i}
                          from={isMine ? "user" : "staff"}
                          text={m.content || m.text}
                          isMine={isMine}
                          label={isMine ? user.fullName : "Cán bộ"}
                          createdAt={m.createdAt}
                        />
                      );
                    })
                  )}
                </div>

                {/* Input */}
                <form onSubmit={(e) => { e.preventDefault(); sendStaff(); }} className="border-t border-slate-200 p-4">
                  <div className="flex gap-2">
                    <input
                      value={staffInput}
                      onChange={(e) => setStaffInput(e.target.value)}
                      placeholder="Nhắn tin cho cán bộ..."
                      disabled={staffLoading}
                      className="flex-1 text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#003366]"
                    />
                    <button
                      type="submit"
                      disabled={staffLoading || !staffInput.trim()}
                      className="bg-[#003366] text-white p-2.5 rounded-xl disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      <GroupCreator
        showGroupModal={showGroupModal}
        setShowGroupModal={setShowGroupModal}
        groupName={groupName}
        setGroupName={setGroupName}
        groupAvatar={groupAvatar}
        setGroupAvatar={setGroupAvatar}
        groupMemberIds={groupMemberIds}
        setGroupMemberIds={setGroupMemberIds}
        contacts={contacts}
        createGroup={createGroup}
      />

      <AddFriendModal
        open={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        query={friendQuery}
        setQuery={setFriendQuery}
        users={friendDiscovery}
        suggestions={friendSuggestions}
        requests={friendIncomingRequests}
        onSearch={() => loadFriendDiscovery(friendQuery)}
        onAdd={handleSendFriendRequest}
        onAccept={(userId) => handleRespondFriendRequest(userId, "accept")}
        onDecline={(userId) => handleRespondFriendRequest(userId, "decline")}
        loading={friendLoading}
        searchNotice={friendSearchNotice}
      />

      <FriendHubModal
        open={showFriendHubModal}
        onClose={() => setShowFriendHubModal(false)}
        currentUserId={user?.id}
        onOpenAddFriend={() => {
          setShowFriendHubModal(false);
          openAddFriendModal();
        }}
        friends={friendDirectory}
        blockedFriends={blockedFriends}
        groups={rooms.filter((room) => room.type === "group")}
        incomingGroupInvites={groupInvites}
        incomingRequests={friendIncomingRequests}
        outgoingRequests={friendOutgoingRequests}
        suggestions={friendSuggestions}
        loading={friendLoading}
        onOpenChat={async (friendId) => {
          setShowFriendHubModal(false);
          await openDirectChat(friendId);
        }}
        onOpenGroup={(roomId) => {
          setShowFriendHubModal(false);
          setActiveRoomId(roomId);
          setChatModeTab("rooms");
          setTabState("multi");
        }}
        onAccept={(userId) => handleRespondFriendRequest(userId, "accept")}
        onDecline={(userId) => handleRespondFriendRequest(userId, "decline")}
        onRevokeRequest={handleRevokeFriendRequest}
        onSendFriendRequest={handleSendFriendRequest}
        onRemoveFriend={handleRemoveFriend}
        onBlockFriend={handleBlockFriend}
        onInviteMembers={handleInviteMembersToGroup}
        onRespondGroupInvite={handleRespondGroupInvite}
        onUnblockFriend={handleUnblockFriend}
      />

      {toast ? (
        <div className="fixed right-4 top-4 z-[110]">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(15,23,42,0.28)]">
            {toast.message}
          </div>
        </div>
      ) : null}

      {forwardingMessageId && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4">
            <div className="text-sm font-bold mb-2">Chọn nơi chuyển tiếp</div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {rooms
                .filter((r) => r.id !== activeRoomId)
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
