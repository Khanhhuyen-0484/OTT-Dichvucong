import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function RemoteVideoTile({ peerId, stream }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play?.().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[10px] text-white">{peerId}</div>
    </div>
  );
}
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
import GovHeader from "../components/GovHeader.jsx";
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
  reactRoomMessage,
  leaveGroup,
  removeGroupDeputy,
  removeGroupMember,
  unsendRoomMessage,
  updateGroupInfo
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
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [roomUnreadMap, setRoomUnreadMap] = useState({});
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("idle");
  const [remoteStreams, setRemoteStreams] = useState({});
  const videoConstraints = { video: true, audio: true };
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerMapRef = useRef(new Map());
  const peerRef = useRef(null);

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
    }
  }, [ready, user, tabState, loadContacts, loadRooms, loadStaff]);

  // Socket connection
  useEffect(() => {
    if (!ready || !user) return;
    
    const socket = connectSocket();

    if (tabState === "multi") {
      const handleMultiChatMessage = (data) => {
        if (!data || !data.roomId) return;
        if (data.roomId !== activeRoomId) {
          setRoomUnreadMap((prev) => ({
            ...prev,
            [data.roomId]: (prev[data.roomId] || 0) + 1
          }));
        }
        loadRooms();
        if (data.roomId === activeRoomId) {
          setTimeout(scrollToBottom, 100);
        }
      };

      const handleRoomUpdated = (payload) => {
        loadRooms();
        if (payload?.dissolved || payload?.action === "dissolved") {
          if (payload?.roomId === activeRoomId) {
            setActiveRoomId(null);
          }
          return;
        }
        if (payload?.roomId === activeRoomId || payload?.action?.includes("member_") || payload?.action?.includes("deputy_")) {
          getChatRooms()
            .then(({ data }) => {
              const nextRooms = data.rooms || [];
              setRooms(nextRooms);
              const refreshed = nextRooms.find((r) => r.id === activeRoomId);
              if (!refreshed) {
                setActiveRoomId(nextRooms[0]?.id || null);
              }
            })
            .catch((err) => setRoomErr(getApiErrorMessage(err)));
        }
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

  useEffect(() => {
    if (!activeRoomId) return;
    setRoomUnreadMap((prev) => ({ ...prev, [activeRoomId]: 0 }));
  }, [activeRoomId]);

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
        // Determine media type based on MIME type and file extension
        const fileName = roomMedia.name.toLowerCase();
        const isDocFile =
          roomMedia.type === "application/pdf" ||
          roomMedia.type === "application/msword" ||
          roomMedia.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileName.endsWith(".pdf") ||
          fileName.endsWith(".doc") ||
          fileName.endsWith(".docx");
        const isVideo = roomMedia.type.startsWith("video/");
        const mediaType = isDocFile ? "file" : isVideo ? "video" : "image";
        mediaPayload = {
          type: mediaType,
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
        case "leave":
          await leaveGroup(activeRoomId);
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

  const updateActiveGroupInfo = useCallback(
    async ({ name, avatarFile }) => {
      if (!activeRoomId) return;
      try {
        let avatarUrl = undefined;
        if (avatarFile instanceof File) {
          const uploaded = await uploadToS3(avatarFile);
          avatarUrl = uploaded?.url || "";
        }
        await updateGroupInfo(activeRoomId, { name, avatarUrl });
        loadRooms();
      } catch (err) {
        setRoomErr(getApiErrorMessage(err));
      }
    },
    [activeRoomId, loadRooms]
  );

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

  const attachLocalStreamToVideo = useCallback((stream) => {
    if (!localVideoRef.current || !stream) return;
    const video = localVideoRef.current;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.onloadedmetadata = () => {
      video.play?.().catch((err) => console.warn("local video play error", err));
    };
    video.play?.().catch((err) => console.warn("local video play error", err));
  }, []);

  useEffect(() => {
    if (!showVideoCall || !localStreamRef.current) return;
    attachLocalStreamToVideo(localStreamRef.current);
  }, [showVideoCall, attachLocalStreamToVideo]);

  const setupPeerConnection = useCallback((socket, roomId, targetUserId, isCaller, peerCount = 1) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceCandidatePoolSize: 4
    });
    pc.onicecandidate = (e) => {
      console.log("ICE:", e.candidate);
      if (e.candidate) {
        socket.emit("webrtc:ice-candidate", {
          roomId,
          toUserId: targetUserId,
          candidate: e.candidate
        });
      }
    };
    pc.onconnectionstatechange = () => console.log("STATE:", pc.connectionState);
    pc.oniceconnectionstatechange = () => console.log("ICE STATE:", pc.iceConnectionState);
    peerMapRef.current.set(targetUserId, pc);
    peerRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
      attachLocalStreamToVideo(localStreamRef.current);
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetUserId]: remoteStream
        }));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc:ice-candidate", {
          roomId,
          toUserId: targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setCallStatus("in-call");
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        setCallStatus("ended");
      }
    };

    if (isCaller) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit("webrtc:offer", {
            roomId,
            toUserId: targetUserId,
            sdp: pc.localDescription,
            peerCount
          });
        })
        .catch((err) => setRoomErr(err.message || "Không thể tạo offer"));
    }

    return pc;
  }, []);

  const endCall = useCallback(() => {
    if (peerMapRef.current.size) {
      for (const pc of peerMapRef.current.values()) {
        try {
          pc.ontrack = null;
          pc.onicecandidate = null;
          pc.close();
        } catch {}
      }
      peerMapRef.current.clear();
    }
    peerRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setRemoteStreams({});
    setShowVideoCall(false);
    setCallStatus("idle");
  }, []);

  const startVideoCall = useCallback(async () => {
    if (!activeRoom || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log("STREAM:", stream);
      localStreamRef.current = stream;
      setShowVideoCall(true);
      setMicMuted(false);
      setCamMuted(false);
      setCallStatus("ringing");
      attachLocalStreamToVideo(stream);

      const socket = connectSocket();
      const peerUser = activeRoom.members?.find((m) => m.id !== user.id);
      if (!peerUser) {
        setRoomErr("Không tìm thấy người nhận cuộc gọi");
        return;
      }

      const peerCount = activeRoom.type === "group" ? Math.max((activeRoom.members || []).length - 1, 1) : 1;
      socket.emit("call:invite", { roomId: activeRoom.id, callType: activeRoom.type === "group" ? "group" : "direct", peerCount });
      if (activeRoom.type === "group") {
        (activeRoom.members || [])
          .filter((m) => m.id !== user.id)
          .forEach((m) => {
            setupPeerConnection(socket, activeRoom.id, m.id, true, peerCount);
          });
      } else {
        setupPeerConnection(socket, activeRoom.id, peerUser.id, true, 1);
      }
    } catch (err) {
      setRoomErr(err.message || "Không thể bắt đầu cuộc gọi video");
      endCall();
    }
  }, [activeRoom, user, setupPeerConnection, endCall]);

  useEffect(() => {
    if (!ready || !user || tabState !== "multi") return;
    const socket = connectSocket();

    const handleOffer = async ({ roomId, fromUserId, sdp, peerCount }) => {
      if (!roomId || roomId !== activeRoomId || !sdp) return;
      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          console.log("STREAM:", stream);
          localStreamRef.current = stream;
          setShowVideoCall(true);
          attachLocalStreamToVideo(stream);
        }
        setCallStatus("ringing");
        const pc = setupPeerConnection(socket, roomId, fromUserId, false, peerCount || 1);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { roomId, toUserId: fromUserId, sdp: pc.localDescription });
        socket.emit("call:accept", { roomId });
      } catch (err) {
        setRoomErr(err.message || "Không thể xử lý offer cuộc gọi");
      }
    };

    const handleAnswer = async ({ roomId, fromUserId, sdp }) => {
      if (!roomId || roomId !== activeRoomId || !sdp) return;
      const pc = peerMapRef.current.get(fromUserId) || peerRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        setCallStatus("in-call");
      } catch (err) {
        setRoomErr(err.message || "Không thể xử lý answer cuộc gọi");
      }
    };

    const handleCandidate = async ({ roomId, fromUserId, candidate }) => {
      if (!roomId || roomId !== activeRoomId || !candidate) return;
      const pc = peerMapRef.current.get(fromUserId) || peerRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("ICE error", err);
      }
    };

    const handleEnd = ({ roomId }) => {
      if (!roomId || roomId !== activeRoomId) return;
      endCall();
    };

    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleCandidate);
    socket.on("call:end", handleEnd);

    return () => {
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleCandidate);
      socket.off("call:end", handleEnd);
    };
  }, [ready, user, tabState, activeRoomId, setupPeerConnection, endCall, videoConstraints]);

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

        <main className="mx-auto max-w-7xl px-2 sm:px-4 py-4 md:py-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
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
                  user={user}
                  unreadMap={roomUnreadMap}
                />
              </div>

              {/* Main Chat */}
              <div className="lg:col-span-8">
                <div className="h-screen max-h-[80vh] sm:h-[calc(100vh-220px)] min-h-[500px] rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
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
                    onSendLocation={async () => {
                      if (!activeRoomId) return;
                      if (!navigator.geolocation) {
                        setRoomErr("Trình duyệt không hỗ trợ định vị");
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        async (position) => {
                          try {
                            const lat = Number(position.coords.latitude);
                            const lng = Number(position.coords.longitude);
                            const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
                            await postRoomMessage(activeRoomId, {
                              text: "",
                              location: { lat, lng, mapUrl }
                            });
                            loadRooms();
                          } catch (err) {
                            setRoomErr(getApiErrorMessage(err));
                          }
                        },
                        (error) => {
                          setRoomErr(error?.message || "Không thể lấy vị trí hiện tại");
                        },
                        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
                      );
                    }}
                    forwardingMessageId={forwardingMessageId}
                    setForwardingMessageId={setForwardingMessageId}
                    doForward={doForward}
                    rooms={rooms}
                    onReplyMessage={setReplyToMessage}
                    onStartVideoCall={startVideoCall}
                    replyToMessage={replyToMessage}
                    clearReply={() => setReplyToMessage(null)}
                    onUpdateGroupInfo={updateActiveGroupInfo}
                    onReactMessage={async (messageId, reaction) => {
                      if (!activeRoomId) return;
                      try {
                        await reactRoomMessage(activeRoomId, messageId, reaction);
                        loadRooms();
                      } catch (err) {
                        setRoomErr(getApiErrorMessage(err));
                      }
                    }}
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md">
          <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f] shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-white sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-bold shadow-lg shadow-sky-500/30">
                  VC
                </div>
                <div>
                  <div className="text-sm font-semibold sm:text-base">Video Call - Dịch vụ công</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/75">
                    <span className="rounded-full bg-white/10 px-2.5 py-1">Trạng thái: {callStatus}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">Đang bảo mật</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{1 + Object.keys(remoteStreams).length} người</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={endCall}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Đóng
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto bg-[#08101d] p-3 sm:p-4 xl:grid-cols-12">
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 xl:col-span-7">
                <div className="absolute left-4 top-4 z-10 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                  Bạn • {micMuted ? "Mic tắt" : "Mic bật"} • {camMuted ? "Cam tắt" : "Cam bật"}
                </div>
                <video ref={localVideoRef} autoPlay playsInline muted className="h-full min-h-[340px] w-full object-cover sm:min-h-[420px]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <div className="text-sm font-semibold">Camera của bạn</div>
                      <div className="text-xs text-white/70">Hình ảnh sẽ hiển thị ngay khi mở cuộc gọi</div>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Local</div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-5 flex flex-col gap-3">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Người tham gia</div>
                      <div className="text-xs text-white/60">Video từ các user khác</div>
                    </div>
                    <div className="rounded-full bg-sky-500/15 px-3 py-1 text-xs text-sky-200">
                      {Object.keys(remoteStreams).length} remote
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
                    {Object.entries(remoteStreams).map(([peerId, stream]) => (
                      <RemoteVideoTile key={peerId} peerId={peerId} stream={stream} />
                    ))}
                    {Object.keys(remoteStreams).length === 0 && (
                      <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/65">
                        <div>
                          <div className="font-medium text-white">Đang chờ người khác tham gia</div>
                          <div className="mt-1 text-xs text-white/55">Khi có người vào, video sẽ hiện tại đây</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white">
                  <div className="mb-3 text-sm font-semibold">Điều khiển cuộc gọi</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMicMuted((v) => {
                          const next = !v;
                          if (localStreamRef.current) {
                            localStreamRef.current.getAudioTracks().forEach((track) => {
                              track.enabled = !next;
                            });
                          }
                          return next;
                        });
                      }}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${micMuted ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30" : "bg-white/10 text-white hover:bg-white/15"}`}
                      title={micMuted ? "Bật mic" : "Tắt mic"}
                    >
                      {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      <span>{micMuted ? "Bật mic" : "Tắt mic"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCamMuted((v) => {
                          const next = !v;
                          if (localStreamRef.current) {
                            localStreamRef.current.getVideoTracks().forEach((track) => {
                              track.enabled = !next;
                            });
                          }
                          return next;
                        });
                      }}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${camMuted ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30" : "bg-white/10 text-white hover:bg-white/15"}`}
                      title={camMuted ? "Bật camera" : "Tắt camera"}
                    >
                      {camMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                      <span>{camMuted ? "Bật cam" : "Tắt cam"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (!localStreamRef.current) return;
                          const [videoTrack] = localStreamRef.current.getVideoTracks();
                          if (!videoTrack) return;
                          const enabled = !videoTrack.enabled;
                          videoTrack.enabled = enabled;
                          setCamMuted(!enabled);
                        } catch (err) {
                          setRoomErr(err.message || "Không thể đổi camera");
                        }
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                      title="Bật/tắt video nhanh"
                    >
                      <Video className="h-5 w-5" />
                      <span>Đảo cam</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const socket = connectSocket();
                        socket.emit("call:end", { roomId: activeRoomId });
                        endCall();
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
                      title="Kết thúc cuộc gọi"
                    >
                      <PhoneOff className="h-5 w-5" />
                      <span>End</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}