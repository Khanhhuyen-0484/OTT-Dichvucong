import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Send,
  ArrowLeft,
  Bot,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Trash2,
  X
} from "lucide-react";
import ContactList from "../components/ContactList.jsx";
import ChatMultiPurpose from "../components/ChatMultiPurpose.jsx";
import GroupCreator from "../components/GroupCreator.jsx";
import AddFriendModal from "../components/AddFriendModal.jsx";
import FriendHubModal from "../components/FriendHubModal.jsx";
import GovHeader from "../components/GovHeader.jsx";
import VideoCall from "../components/VideoCall.jsx";
import Bubble from "../components/Bubble.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  addGroupMember,
  assignGroupDeputy,
  clearRoomHistory,
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
  postAiAssistantChat,
  postFriendRequest,
  postFriendRequestResponse,
  postGroupInviteResponse,
  postGroupInvites,
  postUnblockFriend,
  postRoomMessage,
  postStaffChat,
  removeGroupDeputy,
  removeGroupMember,
  togglePinRoomMessage,
  unsendRoomMessage,
  updateGroupRoom,
} from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import { uploadToS3 } from "../lib/uploadToS3.js";
import { resolveMyGroupRole } from "../lib/groupRoles.js";
import { MAX_PINNED_MESSAGES, canPinMore } from "../lib/chatPinned.js";

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

const AI_ASSISTANT_ID = "AI_ASSISTANT";
const AI_QUICK_QUESTIONS = [
  "Tôi cần chuẩn bị giấy tờ gì?",
  "Hồ sơ của tôi đang ở đâu?",
  "Thanh toán lệ phí như thế nào?",
  "Tôi muốn gặp cán bộ hỗ trợ",
];
const AI_DEFAULT_QUESTIONS = AI_QUICK_QUESTIONS;
const AI_STAFF_CONFIRM_QUESTIONS = ["Chuyển tới chat cán bộ", "Ở lại chat AI"];
const AI_STAFF_CONFIRM_TEXT =
  "Bạn muốn tôi đưa bạn tới trang chat với cán bộ hỗ trợ, hoặc bạn cũng có thể vào phần Hỗ trợ trực tuyến để nhắn trực tiếp với cán bộ.";
const AI_STAY_TEXT =
  "Được, tôi sẽ tiếp tục hỗ trợ bạn tại đây. Bạn cần hỏi thêm về thủ tục, hồ sơ, thanh toán hay trạng thái hồ sơ?";

function normalizeAiIntent(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function isAiStaffIntent(text) {
  const value = normalizeAiIntent(text);
  return /(gap|chat|noi chuyen|lien he).*(can bo|ho tro|nhan vien|tu van)|can bo ho tro/.test(value);
}

function isAiTransferToStaff(text) {
  const value = normalizeAiIntent(text);
  return /^chuyen toi chat can bo$|(?:chuyen|dua|sang|mo).*(?:chat )?(can bo|ho tro)|\btoi (?:trang|phan|chat)\b.*(can bo|ho tro)/.test(value);
}

function isAiStay(text) {
  const value = normalizeAiIntent(text);
  return /^(o lai|khong|thoi|tiep tuc).*(ai|tro ly)?|^o lai chat ai$/.test(value);
}

function getGeolocationErrorMessage(err) {
  if (err?.message) return err.message;
  if (err?.code === 1) {
    return "Bạn đang chặn quyền vị trí. Hãy bấm biểu tượng vị trí/cài đặt cạnh thanh địa chỉ và cho phép localhost:5173 truy cập vị trí.";
  }
  if (err?.code === 2) {
    return "Không lấy được vị trí hiện tại. Hãy kiểm tra GPS/Wi-Fi rồi thử lại.";
  }
  if (err?.code === 3) {
    return "Lấy vị trí quá lâu. Hãy thử lại hoặc bật định vị chính xác hơn.";
  }
  return "Không thể lấy vị trí hiện tại.";
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function createAiWelcomeMessage() {
  return {
    id: "ai-welcome",
    senderId: AI_ASSISTANT_ID,
    senderType: "AI",
    senderName: "Trợ lý AI",
    text: "Xin chào, tôi là trợ lý AI dịch vụ công. Bạn có thể hỏi về thủ tục, hồ sơ cần chuẩn bị, thanh toán hoặc trạng thái hồ sơ.",
    createdAt: new Date().toISOString(),
  };
}

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
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
  const location = useLocation();
  const { user, ready } = useAuth();
  const chatEndRef = useRef(null);
  const staffScrollRef = useRef(null);

  const [tabState, setTabState] = useState(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    return tab === "staff" || tab === "ai" || tab === "multi" ? tab : "multi";
  });
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
  const [locationSending, setLocationSending] = useState(false);
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
  const [deleteRoomTarget, setDeleteRoomTarget] = useState(null);
  const [deleteRoomBusy, setDeleteRoomBusy] = useState(false);

  // Staff chat states
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffErr, setStaffErr] = useState(null);
  const [staffUnread, setStaffUnread] = useState(0);
  const [aiMessages, setAiMessages] = useState(() => [createAiWelcomeMessage()]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState(null);
  const [aiQuickQuestions, setAiQuickQuestions] = useState(AI_DEFAULT_QUESTIONS);

  const [videoCallState, setVideoCallState] = useState(null);
  const [isCalling, setIsCalling] = useState(false);

  // ─── Refs: cho phép socket handler đọc giá trị mới nhất
  //           mà không cần re-register listener ────────────────────────────────
  const activeRoomIdRef = useRef(activeRoomId);
  const tabStateRef     = useRef(tabState);
  const loadRoomsRef    = useRef(null);
  const loadStaffRef    = useRef(null);
  const scrollBotRef    = useRef(null);

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { tabStateRef.current     = tabState;     }, [tabState]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab === "staff" || tab === "ai" || tab === "multi") {
      setTabState(tab);
      if (tab === "staff") setStaffUnread(0);
    }
  }, [location.search]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollStaffToBottom = useCallback((behavior = "smooth") => {
    const node = staffScrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior });
    chatEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const normalizeRoom = useCallback((room) => {
    if (!room) return room;
    const avatar = room.avatar || room.avatarUrl || "";
    return { ...room, avatar, avatarUrl: room.avatarUrl || avatar };
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const { data } = await getChatRooms();
      const list = (data.rooms || []).map(normalizeRoom);
      setRooms(list);
      return list;
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
      return [];
    }
  }, [normalizeRoom]);

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

  const loadStaff = useCallback(async (options = {}) => {
    try {
      const { data } = await getStaffChat();
      setStaffMessages(data.messages || []);
      const shouldScroll = options.scroll ?? tabStateRef.current === "staff";
      if (shouldScroll) setTimeout(() => scrollStaffToBottom("auto"), 250);
    } catch (err) {
      console.error(err);
    }
  }, [scrollStaffToBottom]);

  useEffect(() => { loadRoomsRef.current = loadRooms; }, [loadRooms]);
  useEffect(() => { loadStaffRef.current = loadStaff; }, [loadStaff]);
  useEffect(() => { scrollBotRef.current = scrollToBottom; }, [scrollToBottom]);

  // Load data based on tab
  useEffect(() => {
    if (!ready || !user) return;
    
    loadStaff({ scroll: tabState === "staff" });
    if (tabState !== "staff") {
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

      if (msg?.chatType === "AI" || msg?.roomId === AI_ASSISTANT_ID || msg?.message?.senderType === "AI") {
        const aiMessage = msg?.message;
        if (aiMessage) {
          if (aiMessage?.meta?.action === "OPEN_STAFF_CHAT") {
            setAiQuickQuestions(AI_STAFF_CONFIRM_QUESTIONS);
            setAiMessages((prev) => [
              ...prev,
              {
                ...aiMessage,
                text: AI_STAFF_CONFIRM_TEXT,
              },
            ]);
          } else {
            setAiMessages((prev) => [...prev, aiMessage]);
          }
          setTimeout(() => scrollBotRef.current(), 100);
        }
        return;
      }

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
        loadStaffRef.current({ scroll: true });
      } else if (msg?.from === "staff") {
        loadStaffRef.current({ scroll: false });
        setStaffUnread((prev) => prev + 1);
      }
    };

    socket.on("new-message", handleNewMessage);

    return () => {
      socket.off("new-message", handleNewMessage);
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

  const videoActiveRoom = useMemo(() => {
    return rooms.find((r) => r.id === videoCallState?.chatRoomId) || activeRoom;
  }, [activeRoom, rooms, videoCallState?.chatRoomId]);

  const activeMessagesLength = activeRoom?.messages?.length || 0;

  const staffMessagesSorted = useMemo(() => {
    const getTime = (message) => {
      const value = message?.createdAt || message?.at || message?.updatedAt || 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    return [...(Array.isArray(staffMessages) ? staffMessages.filter(Boolean) : [])].sort((a, b) => getTime(a) - getTime(b));
  }, [staffMessages]);

  const staffLatestMessage = useMemo(() => {
    return staffMessagesSorted[staffMessagesSorted.length - 1] || null;
  }, [staffMessagesSorted]);

  useEffect(() => {
    if (tabState !== "staff") return;
    const timer = window.setTimeout(() => scrollStaffToBottom("auto"), 80);
    return () => window.clearTimeout(timer);
  }, [tabState, staffMessagesSorted.length, scrollStaffToBottom]);

  const myGroupRole = useMemo(() => {
    return resolveMyGroupRole(activeRoom, user?.id);
  }, [activeRoom, user?.id]);

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
    if (isCalling || videoCallState) return;
    const currentRoom = rooms.find((r) => r.id === activeRoomId);
    if (!currentRoom) return;
    const callRoomId = `call_${activeRoomId}_${Date.now()}`;

    if (currentRoom.type === "group") {
      const otherMembers = (currentRoom.members || []).filter((m) => m.id !== user.id);
      if (!otherMembers.length) return;
      setIsCalling(true);
      setVideoCallState({ roomId: callRoomId, chatRoomId: activeRoomId, targetUserIds: otherMembers.map((m) => m.id), isCallee: false, isGroupCall: true });
    } else {
      const other = currentRoom.members?.find((m) => m.id !== user.id);
      if (!other) return;
      setIsCalling(true);
      setVideoCallState({ roomId: callRoomId, chatRoomId: activeRoomId, targetUserId: other.id, isCallee: false, isGroupCall: false });
    }
  }, [activeRoomId, rooms, user, isCalling, videoCallState]);

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
        const isFile =
          /\.(pdf|doc|docx)$/i.test(roomMedia.name || "") ||
          /application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/i.test(roomMedia.type || "");
        mediaPayload = {
          type: isFile ? "document" : (roomMedia.type.startsWith("video") ? "video" : "image"),
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

  const sendLocationMessage = useCallback(async () => {
    if (!navigator.geolocation) {
      setRoomErr("Trình duyệt của bạn không hỗ trợ gửi vị trí.");
      return;
    }
    if (window.isSecureContext === false && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setRoomErr("Trình duyệt chỉ cho phép gửi vị trí trên HTTPS hoặc localhost. Vui lòng mở hệ thống bằng HTTPS để dùng tính năng này.");
      return;
    }
    if (!activeRoomId) {
      setRoomErr("Vui lòng chọn một cuộc trò chuyện trước khi gửi vị trí.");
      return;
    }
    if (roomLoading) return;
    setRoomLoading(true);
    try {
      let position;
      try {
        position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      } catch (firstError) {
        if (firstError?.code !== 3) throw firstError;
        position = await getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        });
      }
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const { data } = await postRoomMessage(activeRoomId, {
        text: "Vị trí đã gửi",
        location: {
          latitude,
          longitude,
          mapsUrl,
          label: "Vị trí hiện tại"
        },
        replyToMessageId: replyToMessage?.id || "",
        senderAvatar: user?.avatarUrl || user?.photoURL || user?.avatar || ""
      });
      if (data?.room) {
        const nextRoom = normalizeRoom(data.room);
        setRooms((prev) => {
          const exists = prev.some((room) => room.id === nextRoom.id);
          return exists ? prev.map((room) => (room.id === nextRoom.id ? nextRoom : room)) : [nextRoom, ...prev];
        });
      } else if (data?.message) {
        setRooms((prev) => prev.map((room) => (
          room.id === activeRoomId
            ? { ...room, messages: [...(room.messages || []), data.message], latestMessage: data.message, updatedAt: data.message.createdAt || new Date().toISOString() }
            : room
        )));
      }
      setReplyToMessage(null);
      await loadRooms();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setRoomErr(getGeolocationErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  }, [activeRoomId, loadRooms, normalizeRoom, replyToMessage, roomLoading, scrollToBottom, user]);

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
        case "leave":
          if (!user?.id) return;
          await removeGroupMember(activeRoomId, user.id);
          setToast({ type: "success", message: "Bạn đã rời khỏi nhóm" });
          setActiveRoomId(null);
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
          setActiveRoomId(null);
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
  }, [activeRoomId, loadRooms, user?.id]);

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
        case "pin": {
          const room = rooms.find((r) => r.id === activeRoomId);
          const target = room?.messages?.find((m) => m.id === messageId);
          const wasPinned = Boolean(target?.isPinned ?? target?.pinned);
          if (!wasPinned && !canPinMore(room?.messages || [], messageId)) {
            setRoomErr(`Chỉ ghim tối đa ${MAX_PINNED_MESSAGES} tin nhắn`);
            break;
          }
          await togglePinRoomMessage(activeRoomId, messageId);
          await loadRooms();
          setToast({
            type: "success",
            message: wasPinned ? "Đã bỏ ghim tin nhắn" : "Đã ghim tin nhắn",
          });
          break;
        }
        default:
          return;
      }
      if (action !== "pin") await loadRooms();
      setMessageMenuId(null);
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setRoomLoading(false);
    }
  }, [activeRoomId, loadRooms, rooms]);

  const clearDirectChatHistory = useCallback(async () => {
    if (!activeRoomId || activeRoom?.type !== "direct") return;

    setRoomLoading(true);
    try {
      await clearRoomHistory(activeRoomId);
      await loadRooms();
      setActiveRoomId(null);
      setToast({ type: "success", message: "Đã xóa lịch sử cuộc trò chuyện" });
    } catch (err) {
      setRoomErr(getApiErrorMessage(err) || "Không thể xóa lịch sử cuộc trò chuyện");
    } finally {
      setRoomLoading(false);
    }
  }, [activeRoom, activeRoomId, loadRooms]);

  const deleteConversationFromList = useCallback(async () => {
    if (!deleteRoomTarget?.id) return;

    setDeleteRoomBusy(true);
    try {
      await clearRoomHistory(deleteRoomTarget.id);
      setRooms((prev) => prev.filter((room) => room.id !== deleteRoomTarget.id));
      if (activeRoomId === deleteRoomTarget.id) {
        setActiveRoomId(null);
        setMobileRoomOpen(false);
      }
      setDeleteRoomTarget(null);
      await loadRooms();
      setToast({ type: "success", message: "Đã xóa hội thoại" });
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setDeleteRoomBusy(false);
    }
  }, [activeRoomId, deleteRoomTarget, loadRooms]);

  const createGroup = useCallback(async () => {
    if (!groupName.trim() || groupMemberIds.length < 2) {
      setRoomErr("Vui lòng nhập tên nhóm và chọn ít nhất 2 thành viên");
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
    setFriendLoading(true);
    try {
      const payload = {};
      if (typeof name === "string" && name.trim()) payload.name = name.trim();

      if (avatarFile) {
        const uploaded = await uploadToS3(avatarFile);
        const url = uploaded?.publicUrl || uploaded?.url || "";
        if (!/^https?:\/\//i.test(url)) {
          throw new Error("Ảnh nhóm phải được lưu trên server (cấu hình S3). Không dùng link tạm.");
        }
        payload.avatarUrl = url;
      }

      if (!Object.keys(payload).length) return;

      await updateGroupRoom(activeRoomId, payload);
      await loadRooms();
      setToast({ type: "success", message: "Đã lưu thông tin nhóm" });
    } catch (err) {
      setRoomErr(getApiErrorMessage(err));
    } finally {
      setFriendLoading(false);
    }
  }, [activeRoomId, loadRooms]);

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

  const sendAi = useCallback(async (value) => {
    const text = String(value ?? aiInput).trim();
    if (!text || aiLoading) return;

    if (isAiTransferToStaff(text)) {
      setTabState("staff");
      setStaffUnread(0);
      navigate("/chat?tab=staff");
      return;
    }

    const userMessage = {
      id: `ai-user-${Date.now()}`,
      senderId: user?.id || "me",
      senderType: "USER",
      senderName: user?.fullName || "Bạn",
      text,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...aiMessages, userMessage];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiErr(null);

    if (isAiStay(text)) {
      setAiQuickQuestions(AI_DEFAULT_QUESTIONS);
      setAiMessages([
        ...nextMessages,
        {
          id: `ai-${Date.now()}`,
          senderId: AI_ASSISTANT_ID,
          senderType: "AI",
          senderName: "Trợ lý AI",
          text: AI_STAY_TEXT,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTimeout(scrollToBottom, 100);
      return;
    }

    if (isAiStaffIntent(text)) {
      setAiQuickQuestions(AI_STAFF_CONFIRM_QUESTIONS);
      setAiMessages([
        ...nextMessages,
        {
          id: `ai-${Date.now()}`,
          senderId: AI_ASSISTANT_ID,
          senderType: "AI",
          senderName: "Trợ lý AI",
          text: AI_STAFF_CONFIRM_TEXT,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTimeout(scrollToBottom, 100);
      return;
    }

    setAiLoading(true);
    setAiQuickQuestions(AI_DEFAULT_QUESTIONS);

    try {
      const { data } = await postAiAssistantChat({
        message: text,
        chatType: "AI",
        receiverId: AI_ASSISTANT_ID,
        messages: nextMessages.map((message) => ({
          role: message.senderType === "AI" ? "assistant" : "user",
          content: message.text || "",
        })),
      });

      const aiMessage = data?.message || {
        id: `ai-${Date.now()}`,
        senderId: AI_ASSISTANT_ID,
        senderType: "AI",
        senderName: "Trợ lý AI",
          text: data?.reply || "Trợ lý AI hiện đang bận, vui lòng thử lại sau.",
        createdAt: new Date().toISOString(),
      };

      if (data?.action === "OPEN_STAFF_CHAT" || aiMessage?.meta?.action === "OPEN_STAFF_CHAT") {
        setAiQuickQuestions(AI_STAFF_CONFIRM_QUESTIONS);
        setAiMessages((prev) => [
          ...prev,
          {
            ...aiMessage,
            text: AI_STAFF_CONFIRM_TEXT,
          },
        ]);
      } else {
        setAiMessages((prev) => [...prev, aiMessage]);
      }
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setAiErr("Trợ lý AI hiện đang bận, vui lòng thử lại sau.");
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, aiMessages, navigate, scrollToBottom, user?.fullName, user?.id]);

  if (!ready) return <LoadingScreen />;
  if (!user)  return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <GovHeader />

      <main className="mx-auto flex w-full max-w-384 min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3 sm:px-4">
        <div className="mb-2 flex w-full shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại
          </button>

          <div className="flex min-w-0 flex-1 gap-1 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setTabState("multi")}
              className={`flex h-7 flex-1 items-center justify-center rounded-md px-2 text-xs font-bold transition-all sm:text-sm
                ${tabState === "multi" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
            >
              Chat & Nhóm
            </button>
            <button
              type="button"
              onClick={() => setTabState("ai")}
              className={`flex h-7 flex-1 items-center justify-center rounded-md px-2 text-xs font-bold transition-all sm:text-sm
                ${tabState === "ai" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
            >
              Trợ lý AI
            </button>
            <button
              type="button"
              onClick={() => { setTabState("staff"); setStaffUnread(0); }}
              className={`relative flex h-7 flex-1 items-center justify-center rounded-md px-2 text-xs font-bold transition-all sm:text-sm
                ${tabState === "staff" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
            >
              Cán bộ
              {staffUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">!</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col pb-[5px]">
          {tabState === "multi" ? (
            <>
              <div className="mb-2 flex shrink-0 lg:hidden">
                {mobileRoomOpen ? (
                  <button
                    type="button"
                    onClick={() => setMobileRoomOpen(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Quay lại danh sách
                  </button>
                ) : null}
              </div>

              {/* Container ngoài: danh sách trái + khung chat phải */}
              <div
                id="chat-room-shell"
                className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
              >
                {/* Sidebar danh sách — rộng hơn cho dễ đọc */}
                <div
                  className={`${
                    mobileRoomOpen ? "hidden" : "flex"
                  } w-full shrink-0 flex-col border-r border-slate-200 bg-slate-50/40 lg:flex lg:w-[340px] lg:max-w-[340px]`}
                >
                  <ContactList
                    embedded
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
                    roomCount={rooms.length}
                    contactCount={contacts.length}
                    staffLatestMessage={staffLatestMessage}
                    staffUnread={staffUnread}
                    onRequestDeleteRoom={setDeleteRoomTarget}
                  />
                </div>

                {/* Chat — chiếm phần còn lại */}
                <div
                  className={`${
                    mobileRoomOpen ? "flex" : "hidden"
                  } min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex`}
                >
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
                    onSendLocation={sendLocationMessage}
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
                    groupActionBusy={friendLoading}
                    onClearDirectHistory={clearDirectChatHistory}
                  />
                </div>
              </div>
            </>
          ) : tabState === "ai" ? (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div
                id="chat-room-shell"
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
              >
                <div className="shrink-0 border-b border-slate-200 bg-[#003366] p-4 text-white">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <h2 className="font-bold text-sm">Trợ lý AI</h2>
                  </div>
                  <p className="text-xs text-emerald-400 mt-1">Hỗ trợ thủ tục dịch vụ công</p>
                </div>

                <div ref={staffScrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                  {aiErr && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                      {aiErr}
                    </div>
                  )}

                  {aiMessages.map((m) => {
                    const isMine = m.senderType !== "AI" && m.senderId !== AI_ASSISTANT_ID;
                    return (
                      <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div>
                          {!isMine && (
                            <div className="mb-1 text-[11px] font-semibold text-slate-500">
                              {m.senderName || "Trợ lý AI"}
                            </div>
                          )}
                          <Bubble
                            from={isMine ? "user" : "staff"}
                            text={m.text}
                            isMine={isMine}
                            createdAt={m.createdAt}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {aiLoading && (
                    <div className="text-xs font-semibold text-slate-400">
                      AI đang trả lời...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
                  <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    {aiQuickQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => sendAi(question)}
                        disabled={aiLoading}
                        className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#003366]/30 hover:text-[#003366] disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendAi();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Nhắn tin với trợ lý AI..."
                      disabled={aiLoading}
                      className="flex-1 text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#003366]"
                    />
                    <button
                      type="submit"
                      disabled={aiLoading || !aiInput.trim()}
                      className="bg-[#003366] text-white p-2.5 rounded-xl disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div
                id="chat-room-shell"
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
              >
                {/* Header */}
                <div className="shrink-0 border-b border-slate-200 bg-[#003366] p-4 text-white">
                  <h2 className="font-bold text-sm">👤 Cán bộ hỗ trợ</h2>
                  <p className="text-xs text-emerald-400 mt-1">Hỗ trợ trực tuyến</p>
                </div>

                {/* Messages */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                  {staffErr && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                      {staffErr}
                    </div>
                  )}
                  
                  {staffMessagesSorted.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Hãy để lại tin nhắn, cán bộ sẽ phản hồi bạn sớm nhất.
                    </div>
                  ) : (
                    staffMessagesSorted.map((m, i) => {
                      const isMine = m.from === "user" || m.from === "citizen";
                      const staffName =
                        m.sender?.fullName ||
                        m.senderName ||
                        m.fullName ||
                        "Cán bộ hỗ trợ";
                      return (
                        <div key={m.id || `${m.from}-${m.createdAt || i}`} className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
                          {!isMine && (
                            <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#003366]">
                              {String(staffName || "CB").slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className={`flex max-w-[80%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                            {!isMine && (
                              <div className="mb-1 px-1 text-xs font-semibold text-slate-500">
                                {staffName}
                              </div>
                            )}
                            <Bubble
                              from={isMine ? "user" : "staff"}
                              text={m.content || m.text}
                              isMine={isMine}
                              label={isMine ? user.fullName : staffName}
                              createdAt={m.createdAt}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendStaff();
                  }}
                  className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]"
                >
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
        <div className="fixed right-4 top-4 z-110">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(15,23,42,0.28)]">
            {toast.message}
          </div>
        </div>
      ) : null}

      {deleteRoomTarget ? (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-500">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-black text-slate-950">Xóa hội thoại này?</h3>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
              Bạn sẽ không còn thấy lịch sử trò chuyện trên thiết bị này.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteRoomTarget(null)}
                disabled={deleteRoomBusy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={deleteConversationFromList}
                disabled={deleteRoomBusy}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteRoomBusy ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {forwardingMessageId && (
        <div className="fixed inset-0 z-60 bg-black/30 flex items-center justify-center p-4">
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

      {videoCallState && (
        <VideoCall
          roomId={videoCallState.roomId}
          targetUserId={videoCallState.targetUserId}
          targetUserIds={videoCallState.targetUserIds}
          isCallee={videoCallState.isCallee}
          callerOffer={videoCallState.callerOffer}
          callerOffers={videoCallState.callerOffers}
          currentUserName={user.fullName}
          activeRoom={videoActiveRoom}
          onClose={() => {
            setVideoCallState(null);
            setIsCalling(false);
          }}
        />
      )}

      {roomErr && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-100 animate-in slide-in-from-right-10 flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-full"><X size={16} /></div>
          <span className="text-sm font-bold">{roomErr}</span>
          <button onClick={() => setRoomErr(null)} className="ml-4 text-xs underline opacity-80">Đóng</button>
        </div>
      )}
    </div>
  );
}
