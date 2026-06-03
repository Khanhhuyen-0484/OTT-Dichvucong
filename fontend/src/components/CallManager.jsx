import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getChatRooms } from "../lib/api.js";
import { connectSocket } from "../lib/socket.js";
import IncomingCallModal from "./IncomingCallModal.jsx";
import VideoCall from "./VideoCall.jsx";

function getChatRoomIdFromCallRoomId(callRoomId) {
  const match = String(callRoomId || "").match(/^call_(.+)_\d+$/);
  return match?.[1] || "";
}

function fallbackRoomFromCall(call, user) {
  if (!call) return null;
  const callerIds = Object.keys(call.callerOffers || { [call.callerUserId]: call.offer }).filter(Boolean);
  const callerNames = call.callerNames || (call.callerName ? [call.callerName] : []);
  return {
    id: call.chatRoomId || getChatRoomIdFromCallRoomId(call.roomId),
    type: call.isGroupCall ? "group" : "direct",
    name: call.groupName || (call.isGroupCall ? "Cuộc gọi nhóm" : ""),
    members: [
      user ? { id: user.id, fullName: user.fullName || "Bạn", avatarUrl: user.avatarUrl || "" } : null,
      ...callerIds.map((id, index) => ({
        id,
        fullName: callerNames[index] || call.callerName || "Thành viên",
        avatarUrl: "",
      })),
    ].filter(Boolean),
  };
}

function normalizeId(value) {
  return String(value ?? "").trim();
}

function sameCallRoom(a, b) {
  return normalizeId(a) && normalizeId(a) === normalizeId(b);
}

export default function CallManager() {
  const { user, ready } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [videoCallState, setVideoCallState] = useState(null);
  const [callRoom, setCallRoom] = useState(null);

  const loadCallRoom = useCallback(async (chatRoomId, fallbackName = "") => {
    if (!chatRoomId) return;
    setCallRoom((prev) =>
      prev?.id === chatRoomId
        ? prev
        : { id: chatRoomId, type: "group", name: fallbackName || "Cuộc gọi nhóm", members: [] }
    );

    try {
      const { data } = await getChatRooms();
      const found = (data.rooms || []).find((room) => room.id === chatRoomId);
      if (found) setCallRoom(found);
    } catch (err) {
      console.warn("[CallManager] Không tải được thông tin phòng gọi:", err?.message || err);
    }
  }, []);

  useEffect(() => {
    if (!ready || !user) return undefined;

    const socket = connectSocket();
    const reconnectVisibleSocket = () => {
      if (document.visibilityState === "visible") connectSocket();
    };
    const handleIncomingCall = (data) => {
      console.log("[CallManager] incoming-call:", data);
      console.log("[SIGNAL_DEBUG]", {
        event: "recv:incoming-call",
        fromUserId: data.fromUserId,
        toUserId: user.id,
        roomId: data.roomId,
        socketId: socket.id,
      });

      if (data.isGroupCall) {
        const chatRoomId = getChatRoomIdFromCallRoomId(data.roomId);
        console.log("[ROOM_DEBUG]", {
          event: "incoming-call",
          userId: user.id,
          roomId: data.roomId,
          activeRoomId: data.roomId,
          fromUserId: data.fromUserId,
        });
        loadCallRoom(chatRoomId, data.groupName);
        setIncomingCall((prev) => {
          const canMerge = prev?.isGroupCall && sameCallRoom(prev.roomId, data.roomId);
          const base = canMerge ? prev : null;
          if (prev?.roomId && !canMerge) {
            console.warn("[SIGNAL_DEBUG]", {
              event: "replace-incoming-call-room",
              previousRoomId: prev.roomId,
              nextRoomId: data.roomId,
              socketId: socket.id,
            });
          }

          return {
            isGroupCall: true,
            groupName: data.groupName || base?.groupName || "Cuộc gọi nhóm",
            roomId: data.roomId,
            chatRoomId: chatRoomId || base?.chatRoomId || "",
            callerOffers: { ...(base?.callerOffers || {}), [data.fromUserId]: data.offer },
            groupMemberIds: Array.from(new Set([
              ...(base?.groupMemberIds || []),
              ...(data.groupMemberIds || []),
              data.fromUserId,
              user.id,
            ].map(normalizeId).filter(Boolean))),
            callerNames: (base?.callerNames || []).includes(data.callerName)
              ? (base?.callerNames || [])
              : [...(base?.callerNames || []), data.callerName].filter(Boolean),
            callerUserId: base?.callerUserId || data.fromUserId,
          };
        });
        return;
      }

      const nextCall = {
        isGroupCall: false,
        callerName: data.callerName,
        callerUserId: data.fromUserId,
        roomId: data.roomId,
        chatRoomId: getChatRoomIdFromCallRoomId(data.roomId),
        offer: data.offer,
      };
      setCallRoom(fallbackRoomFromCall(nextCall, user));
      setIncomingCall(nextCall);
    };
    const handleIncomingCallEnded = ({ roomId } = {}) => {
      setIncomingCall((prev) => {
        if (!prev) return null;
        if (roomId && !sameCallRoom(prev.roomId, roomId)) return prev;
        return null;
      });
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-ended", handleIncomingCallEnded);
    window.addEventListener("focus", reconnectVisibleSocket);
    document.addEventListener("visibilitychange", reconnectVisibleSocket);
    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-ended", handleIncomingCallEnded);
      window.removeEventListener("focus", reconnectVisibleSocket);
      document.removeEventListener("visibilitychange", reconnectVisibleSocket);
    };
  }, [loadCallRoom, ready, user]);

  const activeCallRoom = useMemo(() => {
    return callRoom || fallbackRoomFromCall(incomingCall || videoCallState, user);
  }, [callRoom, incomingCall, user, videoCallState]);

  const acceptCall = useCallback(async (call) => {
    if (!call) return;
    if (call.isGroupCall) {
      const offers = call.callerOffers || { [call.callerUserId]: call.offer };
      const chatRoomId = call.chatRoomId || getChatRoomIdFromCallRoomId(call.roomId);
      let roomMembers = activeCallRoom?.members || [];

      if ((!roomMembers.length || roomMembers.length <= Object.keys(offers).length + 1) && chatRoomId) {
        try {
          const { data } = await getChatRooms();
          const found = (data.rooms || []).find((room) => room.id === chatRoomId);
          if (found) {
            roomMembers = found.members || [];
            setCallRoom(found);
          }
        } catch (err) {
          console.warn("[CallManager] Không tải kịp thành viên nhóm trước khi nhận cuộc gọi:", err?.message || err);
        }
      }

      const groupTargetIds = roomMembers
        .map((member) => normalizeId(member?.id || member?.userId || member))
        .filter((id) => id && id !== normalizeId(user?.id));
      const signaledMemberIds = (call.groupMemberIds || [])
        .map(normalizeId)
        .filter((id) => id && id !== normalizeId(user?.id));
      const offeredIds = Object.keys(offers).map(normalizeId).filter(Boolean);
      const targetUserIds = Array.from(new Set([...groupTargetIds, ...signaledMemberIds, ...offeredIds]))
        .filter((id) => id && id !== normalizeId(user?.id));

      console.log("[MESH_TARGET_DEBUG]", {
        selfUserId: normalizeId(user?.id),
        callRoomId: call.roomId,
        roomMemberIds: groupTargetIds,
        signaledMemberIds,
        offeredIds,
        targetUserIds,
      });
      console.log("[ROOM_DEBUG]", {
        event: "joinGroupCall",
        userId: user.id,
        roomId: call.roomId,
        activeRoomId: call.roomId,
        targetUserIds,
      });

      setVideoCallState({
        roomId: call.roomId,
        chatRoomId,
        targetUserIds,
        isCallee: true,
        callerOffers: offers,
        isGroupCall: true,
        isCallCreator: false,
      });
    } else {
      setVideoCallState({
        roomId: call.roomId,
        chatRoomId: call.chatRoomId || getChatRoomIdFromCallRoomId(call.roomId),
        targetUserId: call.callerUserId,
        isCallee: true,
        callerOffer: call.offer,
        isGroupCall: false,
        isCallCreator: false,
      });
    }
    setIncomingCall(null);
  }, [activeCallRoom?.members, user?.id]);

  const rejectCall = useCallback((callArg) => {
    const activeCall = callArg || incomingCall;
    if (activeCall) {
      const callerIds = activeCall.isGroupCall
        ? Object.keys(activeCall.callerOffers || {}).filter(Boolean)
        : [activeCall.callerUserId].filter(Boolean);

      callerIds.forEach((callerId) => {
        connectSocket().emit("call-rejected", {
          toUserId: callerId,
          roomId: activeCall.roomId,
          callerId,
          callerName: activeCall.callerName || activeCall.callerNames?.[0] || "",
        });
      });
    }
    setIncomingCall(null);
  }, [incomingCall]);

  if (!ready || !user) return null;

  return (
    <>
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={() => acceptCall(incomingCall)}
          onReject={rejectCall}
        />
      )}

      {videoCallState && (
        <VideoCall
          roomId={videoCallState.roomId}
          targetUserId={videoCallState.targetUserId}
          targetUserIds={videoCallState.targetUserIds}
          isCallee={videoCallState.isCallee}
          callerOffer={videoCallState.callerOffer}
          callerOffers={videoCallState.callerOffers}
          isCallCreator={Boolean(videoCallState.isCallCreator)}
          currentUserId={user.id}
          currentUserName={user.fullName || "Bạn"}
          activeRoom={activeCallRoom}
          onClose={() => {
            setVideoCallState(null);
            setCallRoom(null);
          }}
        />
      )}
    </>
  );
}
