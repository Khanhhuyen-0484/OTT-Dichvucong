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

      if (data.isGroupCall) {
        const chatRoomId = getChatRoomIdFromCallRoomId(data.roomId);
        loadCallRoom(chatRoomId, data.groupName);
        setIncomingCall((prev) => ({
          isGroupCall: true,
          groupName: data.groupName || prev?.groupName || "Cuộc gọi nhóm",
          roomId: data.roomId,
          chatRoomId: chatRoomId || prev?.chatRoomId || "",
          callerOffers: { ...(prev?.callerOffers || {}), [data.fromUserId]: data.offer },
          callerNames: (prev?.callerNames || []).includes(data.callerName)
            ? (prev?.callerNames || [])
            : [...(prev?.callerNames || []), data.callerName].filter(Boolean),
          callerUserId: prev?.callerUserId || data.fromUserId,
        }));
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
    const handleIncomingCallEnded = () => {
      setIncomingCall(null);
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

  const acceptCall = useCallback((call) => {
    if (!call) return;
    if (call.isGroupCall) {
      const offers = call.callerOffers || { [call.callerUserId]: call.offer };
      const roomMembers = activeCallRoom?.members || [];
      const groupTargetIds = roomMembers
        .map((member) => String(member?.id || member?.userId || member || "").trim())
        .filter((id) => id && id !== String(user?.id || ""));
      const offeredIds = Object.keys(offers).filter(Boolean);
      const targetUserIds = groupTargetIds.length
        ? Array.from(new Set([...groupTargetIds, ...offeredIds]))
        : offeredIds;
      setVideoCallState({
        roomId: call.roomId,
        chatRoomId: call.chatRoomId || getChatRoomIdFromCallRoomId(call.roomId),
        targetUserIds,
        isCallee: true,
        callerOffers: offers,
        isGroupCall: true,
      });
    } else {
      setVideoCallState({
        roomId: call.roomId,
        chatRoomId: call.chatRoomId || getChatRoomIdFromCallRoomId(call.roomId),
        targetUserId: call.callerUserId,
        isCallee: true,
        callerOffer: call.offer,
        isGroupCall: false,
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
