import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  ArrowLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff
} from "lucide-react";
import ContactList from "../components/ContactList.jsx";
import ChatMultiPurpose from "../components/ChatMultiPurpose.jsx";
import GroupCreator from "../components/GroupCreator.jsx";
import AddFriendModal from "../components/AddFriendModal.jsx";
import FriendHubModal from "../components/FriendHubModal.jsx";
import GovHeader from "../components/GovHeader.jsx";
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
  unsendRoomMessage
} from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import { uploadToS3 } from "../lib/uploadToS3.js";

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();

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

  // Staff chat states
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffErr, setStaffErr] = useState(null);
  const [staffUnread, setStaffUnread] = useState(0);

  const chatEndRef = useRef(null);
  const prevRoomRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Load staff chat
  const loadStaff = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getStaffChat();
      setStaffMessages(data.messages || []);
    } catch (err) {
      setStaffErr(getApiErrorMessage(err));
    }
  }, [user]);

  // Load contacts
  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getChatContacts(contactQuery);
      setContacts(data.contacts || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
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

  // Load rooms
  const loadRooms = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getChatRooms();
      setRooms(data.rooms || []);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [user]);

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

  // Socket connection
  useEffect(() => {
    if (!ready || !user) return;
    
    const socket = connectSocket();

    if (tabState === "multi") {
      const handleMultiChatMessage = (data) => {
        if (!data || !data.roomId) return;
        loadRooms();
        if (data.roomId === activeRoomId) {
          setTimeout(scrollToBottom, 100);
        }
      };

      const handleRoomUpdated = () => {
        loadRooms();
      };

      socket.on("multiChatMessage", handleMultiChatMessage);
      socket.on("multiChatRoomUpdated", handleRoomUpdated);

      return () => {
        socket.off("multiChatMessage", handleMultiChatMessage);
        socket.off("multiChatRoomUpdated", handleRoomUpdated);
      };
    } else {
      const handleSupportMessage = (payload) => {
        if (!payload || payload.userId !== user.id) return;
        const message = payload.message;
        if (!message || !message.id) return;
        setStaffMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        if (tabState !== "staff") {
          setStaffUnread((prev) => prev + 1);
        }
      };

      socket.on("supportConversationMessage", handleSupportMessage);

      return () => {
        socket.off("supportConversationMessage", handleSupportMessage);
      };
    }
  }, [ready, user, tabState, activeRoomId, loadRooms, scrollToBottom]);

  useEffect(() => {
    if (!ready || !user) return;
    const socket = connectSocket();
    const roomName = tabState === "multi" && activeRoomId ? `chat_${activeRoomId}` : null;

    if (prevRoomRef.current && prevRoomRef.current !== roomName) {
      socket.emit("leaveRoom", { room: prevRoomRef.current });
      prevRoomRef.current = null;
    }

    if (roomName) {
      socket.emit("joinRoom", { room: roomName });
      prevRoomRef.current = roomName;
    }

    return () => {
      if (roomName) {
        socket.emit("leaveRoom", { room: roomName });
      }
    };
  }, [ready, user, tabState, activeRoomId]);

  // Auto-select first room if none selected
  useEffect(() => {
    if (rooms.length > 0 && !activeRoomId) {
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const activeRoom = useMemo(() => {
    return rooms.find((r) => r.id === activeRoomId) || null;
  }, [rooms, activeRoomId]);

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
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [loadRooms]);

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
    loadGroupInvites();
    loadBlockedFriends();
  }, [loadFriendDirectory, loadFriendRequests, loadGroupInvites, loadBlockedFriends]);

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

  const sendRoom = useCallback(async (e) => {
    e?.preventDefault();
    if (!activeRoomId || roomLoading || !user) return;
    if (!roomInput.trim() && !roomMedia) return;

    setRoomLoading(true);
    setRoomErr(null);
    try {
      let mediaPayload = null;
      if (roomMedia instanceof File) {
        const uploaded = await uploadToS3(roomMedia);
        mediaPayload = {
          type: roomMedia.type.startsWith("video/") ? "video" : "image",
          url: uploaded.url,
          name: roomMedia.name
        };
      } else if (roomMedia && typeof roomMedia === "object") {
        mediaPayload = roomMedia;
      }
      await postRoomMessage(activeRoomId, {
        text: roomInput.trim(),
        media: mediaPayload,
        replyToMessageId: replyToMessage?.id || ""
      });
      setRoomInput("");
      setRoomMedia(null);
      setReplyToMessage(null);
      loadRooms();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  }, [activeRoomId, roomInput, roomMedia, replyToMessage, roomLoading, user, loadRooms, scrollToBottom]);

  const sendStaff = useCallback(async () => {
    if (!staffInput.trim() || staffLoading || !user) return;
    
    setStaffLoading(true);
    setStaffErr(null);
    try {
      const { data } = await postStaffChat(staffInput.trim());
      setStaffMessages(data.messages || []);
      setStaffInput("");
    } catch (err) {
      setStaffErr(getApiErrorMessage(err));
    } finally {
      setStaffLoading(false);
    }
  }, [staffInput, staffLoading, user]);

  const doMessageAction = useCallback(async (action, messageId) => {
    if (!activeRoomId) return;
    try {
      switch (action) {
        case "unsend":
          await unsendRoomMessage(activeRoomId, messageId);
          break;
        case "delete":
          await deleteRoomMessageForMe(activeRoomId, messageId);
          break;
        case "forward":
          setForwardingMessageId(messageId);
          return;
      }
      loadRooms();
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
    setMessageMenuId(null);
  }, [activeRoomId, loadRooms]);

  const doForward = useCallback(async (targetRoomId) => {
    if (!activeRoomId || !forwardingMessageId) return;
    try {
      await forwardRoomMessage(activeRoomId, forwardingMessageId, targetRoomId);
      loadRooms();
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
    setForwardingMessageId(null);
  }, [activeRoomId, forwardingMessageId, loadRooms]);

  const performGroupAction = useCallback(async (action, targetUserId) => {
    if (!activeRoomId) return;
    try {
      switch (action) {
        case "add":
          if (newMemberId) {
            await addGroupMember(activeRoomId, newMemberId);
            setNewMemberId("");
          }
          break;
        case "remove":
          await removeGroupMember(activeRoomId, targetUserId);
          break;
        case "promote":
          await assignGroupDeputy(activeRoomId, targetUserId);
          break;
        case "demote":
          await removeGroupDeputy(activeRoomId, targetUserId);
          break;
        case "dissolve":
          await dissolveGroup(activeRoomId);
          setActiveRoomId(null);
          break;
      }
      loadRooms();
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [activeRoomId, newMemberId, loadRooms]);

  const createGroup = useCallback(async () => {
    if (!groupName.trim()) return;
    try {
      await createGroupRoom({
        ownerId: user.id,
        name: groupName.trim(),
        avatarUrl: groupAvatar,
        memberIds: groupMemberIds
      });
      setShowGroupModal(false);
      setGroupName("");
      setGroupAvatar("");
      setGroupMemberIds([]);
      loadRooms();
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    }
  }, [groupName, groupAvatar, groupMemberIds, user, loadRooms]);

  const onPickMedia = useCallback((file) => {
    setRoomMedia(file);
  }, []);

  const openStaffChat = useCallback(() => {
    setTabState("staff");
    setStaffUnread(0);
  }, []);

  const startVideoCall = useCallback(() => {
    setShowVideoCall(true);
    setMicMuted(false);
    setCamMuted(false);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-600">
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-600">
        Vui lòng đăng nhập để sử dụng tính năng chat.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              tabState === "multi"
                ? "bg-white text-[#003366] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            💬 Chat đa năng
          </button>
          <button
            onClick={() => {
              setTabState("staff");
              setStaffUnread(0);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              tabState === "staff"
                ? "bg-white text-[#003366] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👤 Cán bộ hỗ trợ
            {staffUnread > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] px-1 rounded-full">
                {staffUnread > 99 ? "99+" : staffUnread}
              </span>
            )}
          </button>
        </div>

        <div className="grid gap-4 lg:gap-6 lg:grid-cols-12">
          {tabState === "multi" ? (
            <>
              {/* Sidebar */}
              <div className="lg:col-span-4">
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
                />
              </div>

              {/* Main Chat */}
              <div className="lg:col-span-8">
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

      {showVideoCall && (
        <div className="fixed inset-0 z-[70] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="bg-[#003366] px-4 py-3 text-white">
              <div className="text-sm font-bold">Video Call - Dịch vụ công</div>
              <div className="text-xs text-white/80">Cuộc gọi mô phỏng</div>
            </div>
            <div className="h-56 bg-slate-900 flex items-center justify-center text-slate-300 text-sm">
              {camMuted ? "Camera đang tắt" : "Đang kết nối video..."}
            </div>
            <div className="flex items-center justify-center gap-3 p-4">
              <button
                type="button"
                onClick={() => setMicMuted((v) => !v)}
                className="rounded-full bg-slate-100 p-3 hover:bg-slate-200"
              >
                {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setCamMuted((v) => !v)}
                className="rounded-full bg-slate-100 p-3 hover:bg-slate-200"
              >
                {camMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setShowVideoCall(false)}
                className="rounded-full bg-red-600 p-3 text-white hover:bg-red-700"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
