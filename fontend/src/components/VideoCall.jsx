
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle, Users } from "lucide-react";
import { connectSocket } from "../lib/socket.js";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
        "stun:stun.cloudflare.com:3478",
        "stun:global.stun.twilio.com:3478",
      ],
    },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

const ICE_CHECKING_TIMEOUT_MS = 12000;

const MISSED_CALL_TIMEOUT_SECONDS = 30;
const MAX_ICE_RESTART_ATTEMPTS = 3;

function isVideoCallDebugEnabled() {
  try {
    return localStorage.getItem("videoCallDebug") === "1";
  } catch {
    return false;
  }
}

function debugVideoCall(...args) {
  if (isVideoCallDebugEnabled()) console.log(...args);
}

function normalizeUserId(value) {
  return String(value ?? "").trim();
}

function normalizeRoomId(value) {
  return String(value ?? "").trim();
}

function logSignalDebug(event, payload = {}) {
  console.log("[SIGNAL_DEBUG]", { event, ...payload });
}

function logRoomDebug(payload = {}) {
  console.log("[ROOM_DEBUG]", payload);
}

function logUserIdDebug(userId) {
  console.log("[USERID_DEBUG]", { value: userId, type: typeof userId });
}

function logPeerDebug(userId, pc) {
  console.log("[PEER_DEBUG]", {
    userId,
    connectionState: pc?.connectionState,
    iceConnectionState: pc?.iceConnectionState,
    signalingState: pc?.signalingState,
  });
}

function logPeerRecovery(userId, payload = {}) {
  console.log("[PEER_RECOVERY]", { userId, ...payload });
}

function parseIceCandidate(candidateLike) {
  const raw = typeof candidateLike === "string"
    ? candidateLike
    : candidateLike?.candidate || "";
  const type = raw.match(/\styp\s([a-z0-9]+)/i)?.[1] || "unknown";
  const protocol = raw.match(/\s(udp|tcp)\s/i)?.[1]?.toLowerCase() || "unknown";
  const address = raw.match(/candidate:\S+\s+\d+\s+\S+\s+\d+\s+([^\s]+)\s+(\d+)/i);
  return {
    type,
    protocol,
    ip: address?.[1] || "",
    port: address?.[2] || "",
    isRelay: type === "relay",
  };
}

function logIceCandidateDebug(event, payload = {}) {
  console.log("[ICE_CANDIDATE_DEBUG]", { event, ...payload });
}

function getSdpMediaSection(sdp = "", kind) {
  const match = sdp.match(new RegExp(`m=${kind}[\\s\\S]*?(?=\\nm=|$)`));
  return match?.[0] || "";
}

function summarizeSdp(description) {
  const sdp = description?.sdp || "";
  const audioSection = getSdpMediaSection(sdp, "audio");
  const videoSection = getSdpMediaSection(sdp, "video");
  const directionOf = (section) => section.match(/a=(sendrecv|sendonly|recvonly|inactive)/)?.[1] || "unspecified";
  return {
    type: description?.type,
    hasAudioMLine: Boolean(audioSection),
    hasVideoMLine: Boolean(videoSection),
    audioDirection: directionOf(audioSection),
    videoDirection: directionOf(videoSection),
  };
}

function logSdpDebug(event, payload = {}) {
  console.log("[SDP_DEBUG]", { event, ...payload });
}

function logCameraDebug(event, payload = {}) {
  console.log("[CAMERA_DEBUG]", { event, ...payload });
}

async function optimizeGroupVideoTrack(stream) {
  const [videoTrack] = stream?.getVideoTracks?.() || [];
  if (!videoTrack?.applyConstraints) return;
  try {
    await videoTrack.applyConstraints({
      width: { ideal: 320, max: 424 },
      height: { ideal: 240, max: 320 },
      frameRate: { ideal: 10, max: 12 },
    });
    console.log("[MEDIA_DEBUG]", {
      event: "group-video-optimized",
      settings: videoTrack.getSettings?.(),
    });
  } catch (err) {
    console.warn("[VideoCall] Không giảm được chất lượng video nhóm:", err?.message || err);
  }
}

async function getVideoOnlyTrack() {
  const videoStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 },
      facingMode: "user",
    },
  });
  return videoStream.getVideoTracks()[0] || null;
}

async function getMediaStream() {
  const preferredConstraints = {
    audio: true,
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 },
      facingMode: "user",
    },
  };
  const basicVideoConstraints = { audio: true, video: true };
  const audioOnlyConstraints = { audio: true, video: false };

  try {
    return await navigator.mediaDevices.getUserMedia(preferredConstraints);
  } catch (err) {
    debugVideoCall("[VideoCall] Không lấy được camera với constraints ưu tiên:", err.name);
  }

  try {
    return await navigator.mediaDevices.getUserMedia(basicVideoConstraints);
  } catch (err) {
    debugVideoCall("[VideoCall] Camera vẫn không khả dụng với video:true, chuyển audio-only:", err.name);
  }

  try {
    const audioOnlyStream = await navigator.mediaDevices.getUserMedia(audioOnlyConstraints);
    debugVideoCall("[VideoCall] Đang dùng audio-only vì không tìm thấy camera.");
    return audioOnlyStream;
  } catch (err) {
    if (err.name === "NotAllowedError") {
      throw err;
    }
    throw new Error(`Không thể truy cập thiết bị âm thanh/video: ${err.name || err.message}`);
  }
}

async function checkMediaPermissions() {
  if (!navigator?.permissions?.query) return { camera: "prompt", microphone: "prompt" };
  try {
    const [camera, microphone] = await Promise.all([
      navigator.permissions.query({ name: "camera" }),
      navigator.permissions.query({ name: "microphone" }),
    ]);
    return { camera: camera.state, microphone: microphone.state };
  } catch {
    return { camera: "prompt", microphone: "prompt" };
  }
}

function VideoPlayer({ userId = "local", stream, streamVersion = 0, isLocal = false, hidden = false, className = "w-full h-full object-cover" }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    if (el.srcObject !== stream) {
      el.srcObject = stream || null;
    }
    el.muted = Boolean(isLocal);
    el.playsInline = true;
    el.autoplay = true;
    const play = () => {
      if (!stream) return;
      el.play?.().catch((err) => {
        if (err?.name !== "AbortError") {
          console.warn("[VideoCall] Không autoplay được video:", { userId, message: err?.message || err });
        }
      });
    };
    if (stream) {
      console.log("[VIDEO_ATTACH_DEBUG]", {
        userId,
        isLocal,
        streamId: stream.id,
        streamVersion,
        videoTracks: stream.getVideoTracks?.().map((track) => `${track.id}:${track.readyState}:${track.muted}:${track.enabled}`) || [],
        audioTracks: stream.getAudioTracks?.().map((track) => `${track.id}:${track.readyState}:${track.muted}:${track.enabled}`) || [],
      });
      if (el.readyState >= 2) play();
      el.onloadedmetadata = play;
      el.oncanplay = play;
      el.onplaying = () => {
        console.log("[VIDEO_ATTACH_DEBUG]", {
          event: "playing",
          userId,
          videoWidth: el.videoWidth,
          videoHeight: el.videoHeight,
          readyState: el.readyState,
        });
      };
      el.onerror = () => {
        console.warn("[VIDEO_ATTACH_DEBUG]", { event: "video-error", userId, error: el.error });
      };
      stream.addEventListener?.("addtrack", play);
      stream.addEventListener?.("removetrack", play);
      stream.getTracks?.().forEach((track) => {
        track.addEventListener?.("unmute", play);
      });
      window.requestAnimationFrame(play);
      window.setTimeout(play, 100);
    }

    return () => {
      el.onloadedmetadata = null;
      el.oncanplay = null;
      el.onplaying = null;
      el.onerror = null;
      stream?.removeEventListener?.("addtrack", play);
      stream?.removeEventListener?.("removetrack", play);
      stream?.getTracks?.().forEach((track) => {
        track.removeEventListener?.("unmute", play);
      });
      if (el.srcObject === stream) el.srcObject = null;
    };
  }, [isLocal, stream, streamVersion, userId]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`${className} ${hidden ? "opacity-0" : "opacity-100"}`}
    />
  );
}

// RemoteVideo: 1 khung hình cho 1 peer.
function RemoteVideo({ userId, stream, streamVersion = 0, label }) {
  const [trackState, setTrackState] = useState({
    hasAudioTrack: false,
    hasVideoTrack: false,
    hasLiveVideo: false,
  });

  useEffect(() => {
    const attachedTracks = new Set();

    const videoTracks = () => stream?.getVideoTracks?.() || [];
    const audioTracks = () => stream?.getAudioTracks?.() || [];

    const syncTrackState = () => {
      const videos = videoTracks();
      const audios = audioTracks();
      setTrackState({
        hasAudioTrack: audios.some((track) => track.readyState === "live"),
        hasVideoTrack: videos.some((track) => track.readyState === "live"),
        hasLiveVideo: videos.some((track) => track.readyState === "live" && !track.muted),
      });
    };

    const playRemote = () => {
      if (!stream) return;
      console.log("[REMOTE_VIDEO_STATE]", {
        userId,
        streamId: stream.id,
        streamVersion,
        videoTracks: videoTracks().map((track) => `${track.id}:${track.readyState}:${track.muted}:${track.enabled}`),
        audioTracks: audioTracks().map((track) => `${track.id}:${track.readyState}:${track.muted}:${track.enabled}`),
      });
    };

    const attachTrackHandlers = (track) => {
      if (!track || attachedTracks.has(track)) return;
      attachedTracks.add(track);
      const handleUnmute = () => {
        syncTrackState();
        playRemote();
      };
      track.addEventListener?.("unmute", handleUnmute);
      track.addEventListener?.("mute", syncTrackState);
      track.addEventListener?.("ended", syncTrackState);
      track.__videoCallHandlers = { handleUnmute, syncTrackState };
    };
    const handleTrackChange = () => {
      stream?.getTracks?.().forEach(attachTrackHandlers);
      syncTrackState();
      playRemote();
    };

    syncTrackState();
    if (stream) {
      stream.getTracks?.().forEach(attachTrackHandlers);
      stream.addEventListener?.("addtrack", handleTrackChange);
      stream.addEventListener?.("removetrack", handleTrackChange);
      playRemote();
    }

    return () => {
      attachedTracks.forEach((track) => {
        const handlers = track.__videoCallHandlers;
        if (handlers) {
          track.removeEventListener?.("unmute", handlers.handleUnmute);
          track.removeEventListener?.("mute", handlers.syncTrackState);
          track.removeEventListener?.("ended", handlers.syncTrackState);
        }
      });
      stream?.removeEventListener?.("addtrack", handleTrackChange);
      stream?.removeEventListener?.("removetrack", handleTrackChange);
    };
  }, [stream, streamVersion, userId]);

  const waitingText = trackState.hasVideoTrack
    ? "Đã nhận video, đang mở khung hình..."
    : trackState.hasAudioTrack
      ? "Đã nhận âm thanh, chưa nhận video..."
      : "Đang chờ hình ảnh...";

  return (
    <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {stream ? (
        <>
          <VideoPlayer
            userId={userId}
            stream={stream}
            streamVersion={streamVersion}
            isLocal={false}
            className="w-full h-full object-cover"
          />
          {!trackState.hasVideoTrack ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-slate-500">
              <div className="w-16 h-16 rounded-full bg-linear-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl font-bold text-slate-400">
                {label?.[0]?.toUpperCase() || "?"}
              </div>
              <p className="px-4 text-center text-sm italic text-slate-500">{waitingText}</p>
            </div>
          ) : !trackState.hasLiveVideo ? (
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
              Đang mở hình ảnh...
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl font-bold text-slate-400">
            {label?.[0]?.toUpperCase() || "?"}
          </div>
          <p className="text-sm italic text-slate-500">Đang chờ kết nối...</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded-lg text-xs text-white font-medium">
        {label || "Thành viên"}
      </div>
    </div>
  );
}

const LocalVideo = React.memo(function LocalVideo({ stream, hidden = false }) {
  return (
    <VideoPlayer
      userId="local"
      stream={stream}
      isLocal
      hidden={hidden}
      className="w-full h-full object-cover scale-x-[-1] transform-gpu"
    />
  );
});

function CallerWaitingAvatar({ active, initial }) {
  const [remaining, setRemaining] = useState(MISSED_CALL_TIMEOUT_SECONDS);

  useEffect(() => {
    if (!active) {
      setRemaining(MISSED_CALL_TIMEOUT_SECONDS);
      return undefined;
    }

    const startedAt = Date.now();
    setRemaining(MISSED_CALL_TIMEOUT_SECONDS);
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRemaining(Math.max(0, MISSED_CALL_TIMEOUT_SECONDS - elapsed));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active]);

  const progress = remaining / MISSED_CALL_TIMEOUT_SECONDS;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative h-28 w-28">
      {active && (
        <svg className="absolute inset-0 h-28 w-28 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
          <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke={remaining <= 8 ? "#ef4444" : "#22c55e"}
            strokeLinecap="round"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-linear"
          />
        </svg>
      )}
      <div className="absolute inset-4 rounded-full bg-linear-to-br from-blue-600 to-blue-800 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
        {initial || "B"}
      </div>
      {active && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-black text-white ring-1 ring-white/10">
          {remaining}s
        </div>
      )}
    </div>
  );
}

// Main component.
export default function VideoCall({
  roomId,
  targetUserId,
  targetUserIds,
  isCallee = false,
  callerOffer = null,
  callerOffers = null,
  isCallCreator = false,
  currentUserId,
  currentUserName,
  activeRoom,
  onClose,
}) {
  const targets = useMemo(
    () => (targetUserIds?.length ? targetUserIds : targetUserId ? [targetUserId] : [])
      .map(normalizeUserId)
      .filter(Boolean),
    [targetUserId, targetUserIds]
  );
  const isGroup = targets.length > 1;

  const [status,        setStatus]        = useState("connecting");
  const [localStream,   setLocalStream]   = useState(null);
  const [audioOnly,     setAudioOnly]     = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isVideoOff,    setIsVideoOff]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState(null);
  const [endNotice,     setEndNotice]     = useState(null);
  const [remoteStreams, setRemoteStreams]  = useState([]);
  const [joinedPeerIds, setJoinedPeerIds] = useState([]);

  const socketRef       = useRef(connectSocket());
  const localStreamRef  = useRef(null);
  const pcsRef          = useRef({});
  const queuesRef       = useRef({});
  const remoteStreamsRef = useRef({});
  const statsTimersRef  = useRef({});
  const recoveryTimersRef = useRef({});
  const iceCheckingTimersRef = useRef({});
  const missingVideoTimersRef = useRef({});
  const iceRestartAttemptsRef = useRef({});
  const iceRestartingRef = useRef({});
  const relayCandidateSeenRef = useRef({});
  const renegotiatedVideoRef = useRef({});
  const activeRef       = useRef(true);
  const closingRef      = useRef(false);
  const callStartedAtRef = useRef(0);
  const joinedPeerIdsRef = useRef([]);
  const firstJoinTimeRef = useRef(null);
  const missedCallTimerRef = useRef(null);

  const onCloseRef      = useRef(onClose);
  const targetsRef      = useRef(targets);
  const roomIdRef       = useRef(normalizeRoomId(roomId));
  const currentUserIdRef = useRef(normalizeUserId(currentUserId));
  const callerOffersRef = useRef(callerOffers);
  const callerOfferRef  = useRef(callerOffer);
  const isGroupRef      = useRef(isGroup);
  const activeRoomRef   = useRef(activeRoom);

  useEffect(() => { onCloseRef.current      = onClose;      }, [onClose]);
  useEffect(() => { targetsRef.current      = targets;      }, [targets]);
  useEffect(() => {
    const nextRoomId = normalizeRoomId(roomId);
    if (!roomIdRef.current && nextRoomId) {
      roomIdRef.current = nextRoomId;
      return;
    }
    if (nextRoomId && roomIdRef.current && nextRoomId !== roomIdRef.current) {
      console.warn("[SIGNAL_DEBUG]", {
        event: "ignore-prop-room-change",
        activeRoomId: roomIdRef.current,
        nextRoomId,
        socketId: socketRef.current?.id,
      });
    }
  }, [roomId]);
  useEffect(() => { currentUserIdRef.current = normalizeUserId(currentUserId); }, [currentUserId]);
  useEffect(() => { callerOffersRef.current = callerOffers; }, [callerOffers]);
  useEffect(() => { callerOfferRef.current  = callerOffer;  }, [callerOffer]);
  useEffect(() => { isGroupRef.current      = isGroup;      }, [isGroup]);
  useEffect(() => { activeRoomRef.current   = activeRoom;   }, [activeRoom]);
  useEffect(() => { joinedPeerIdsRef.current = joinedPeerIds; }, [joinedPeerIds]);

  // Helpers.
  const getActiveRoomId = useCallback(() => roomIdRef.current || normalizeRoomId(roomId), [roomId]);

  const debugRoom = useCallback((event, roomIdValue = getActiveRoomId(), extra = {}) => {
    logRoomDebug({
      event,
      userId: currentUserIdRef.current,
      roomId: normalizeRoomId(roomIdValue),
      activeRoomId: getActiveRoomId(),
      ...extra,
    });
  }, [getActiveRoomId]);

  const isCurrentRoomEvent = useCallback((event, eventRoomId, payload = {}) => {
    const activeRoomId = getActiveRoomId();
    const incomingRoomId = normalizeRoomId(eventRoomId);
    if (!activeRoomId || !incomingRoomId) return true;
    if (incomingRoomId === activeRoomId) return true;

    debugRoom(`drop:${event}:room-mismatch`, incomingRoomId, payload);
    logSignalDebug(`drop:${event}:room-mismatch`, {
      ...payload,
      roomId: incomingRoomId,
      activeRoomId,
      socketId: socketRef.current?.id,
    });
    return false;
  }, [debugRoom, getActiveRoomId]);

  const logCallState = useCallback((status) => {
    console.log("[CALL_ROOM_STATE]", {
      roomId: getActiveRoomId(),
      participantCount: targetsRef.current.length,
      joinedCount: joinedPeerIdsRef.current.length,
      joinedParticipants: joinedPeerIdsRef.current,
      firstJoinTime: firstJoinTimeRef.current,
      status,
    });
  }, [getActiveRoomId]);

  const destroyPeer = useCallback((userId) => {
    const peerId = normalizeUserId(userId);
    const pc = pcsRef.current[peerId];
    if (!pc) return;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.onicegatheringstatechange = null;
    pc.onsignalingstatechange = null;
    pc.close();
    if (statsTimersRef.current[peerId]) {
      window.clearInterval(statsTimersRef.current[peerId]);
      delete statsTimersRef.current[peerId];
    }
    if (recoveryTimersRef.current[peerId]) {
      window.clearTimeout(recoveryTimersRef.current[peerId]);
      delete recoveryTimersRef.current[peerId];
    }
    if (iceCheckingTimersRef.current[peerId]) {
      window.clearTimeout(iceCheckingTimersRef.current[peerId]);
      delete iceCheckingTimersRef.current[peerId];
    }
    if (missingVideoTimersRef.current[peerId]) {
      window.clearTimeout(missingVideoTimersRef.current[peerId]);
      delete missingVideoTimersRef.current[peerId];
    }
    delete pcsRef.current[peerId];
    delete queuesRef.current[peerId];
    delete remoteStreamsRef.current[peerId];
    delete iceRestartAttemptsRef.current[peerId];
    delete iceRestartingRef.current[peerId];
    delete relayCandidateSeenRef.current[peerId];
    delete renegotiatedVideoRef.current[peerId];
    setRemoteStreams((prev) => prev.filter((item) => item.userId !== peerId));
    setJoinedPeerIds((prev) => prev.filter((id) => id !== peerId));
    console.log("[GROUP_CALL_DEBUG]", {
      action: "destroy peer",
      userId: currentUserIdRef.current,
      leftUserId: peerId,
      participantCount: Object.keys(pcsRef.current).length,
      participants: Object.keys(pcsRef.current),
      roomId: getActiveRoomId(),
    });
    console.log("[REMOTE_STREAM_DEBUG]", { action: "destroyPeer", userId: peerId, remoteKeys: Object.keys(remoteStreamsRef.current) });
    debugVideoCall("[VideoCall] destroyPeer:", peerId);
  }, [getActiveRoomId]);

  const markPeerJoined = useCallback((userId) => {
    const peerId = normalizeUserId(userId);
    if (!peerId) return;
    logUserIdDebug(peerId);
    if (missedCallTimerRef.current) {
      window.clearTimeout(missedCallTimerRef.current);
      missedCallTimerRef.current = null;
    }
    setJoinedPeerIds((prev) => {
      if (prev.includes(peerId)) return prev;
      const next = [...prev, peerId];
      joinedPeerIdsRef.current = next;
      if (!firstJoinTimeRef.current) firstJoinTimeRef.current = new Date().toISOString();
      logCallState("joined");
      console.log("[GROUP_CALL_DEBUG]", {
        action: "join",
        userId: currentUserIdRef.current,
        joinedUserId: peerId,
        participantCount: next.length,
        participants: next,
        roomId: getActiveRoomId(),
      });
      return next;
    });
  }, [getActiveRoomId, logCallState]);

  const destroyAll = useCallback(() => {
    if (missedCallTimerRef.current) {
      window.clearTimeout(missedCallTimerRef.current);
      missedCallTimerRef.current = null;
    }
    Object.keys(pcsRef.current).forEach(destroyPeer);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStreams([]);
    setJoinedPeerIds([]);
    joinedPeerIdsRef.current = [];
  }, [destroyPeer]);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    destroyAll();
    onCloseRef.current();
  }, [destroyAll]);

  const finishAndClose = useCallback((message = "Cuộc gọi đã kết thúc", delayMs = 1400) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setEndNotice(message);
    setErrorMsg(null);
    setStatus("ended");
    activeRef.current = false;
    destroyAll();
    window.setTimeout(() => {
      onCloseRef.current();
    }, delayMs);
  }, [destroyAll]);

  const clearMissedCallTimer = useCallback(() => {
    if (!missedCallTimerRef.current) return;
    window.clearTimeout(missedCallTimerRef.current);
    missedCallTimerRef.current = null;
  }, []);

  const emitMissedCall = useCallback(() => {
    const targetIds = targetsRef.current.filter(Boolean);
    const activeRoomId = getActiveRoomId();
    if (joinedPeerIdsRef.current.length > 0) {
      logCallState("skip-missed-has-joined");
      return;
    }
    logCallState("missed");
    logSignalDebug("emit:call-missed", {
      fromUserId: currentUserIdRef.current,
      toUserId: targetIds,
      roomId: activeRoomId,
      socketId: socketRef.current?.id,
    });
    socketRef.current.emit("call-missed", {
      toUserIds: targetIds,
      roomId: activeRoomId,
      callerName: currentUserName,
    });
  }, [currentUserName, getActiveRoomId, logCallState]);

  const processQueue = useCallback(async (userId) => {
    const peerId = normalizeUserId(userId);
    const pc = pcsRef.current[peerId];
    if (!pc?.remoteDescription) return;
    const q = queuesRef.current[peerId] || [];
    while (q.length) {
      const c = q.shift();
      try {
        const candidateInfo = parseIceCandidate(c);
        relayCandidateSeenRef.current[peerId] = relayCandidateSeenRef.current[peerId] || { local: false, remote: false };
        if (candidateInfo.isRelay) relayCandidateSeenRef.current[peerId].remote = true;
        logIceCandidateDebug("add-queued-remote-candidate", {
          userId: peerId,
          roomId: getActiveRoomId(),
          ...candidateInfo,
          relaySeen: relayCandidateSeenRef.current[peerId],
        });
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      catch (e) { console.warn("[VideoCall] Queue ICE:", e); }
    }
    console.log("[SIGNAL_DEBUG]", {
      event: "ice-queue:processed",
      fromUserId: peerId,
      toUserId: currentUserIdRef.current,
      roomId: getActiveRoomId(),
      socketId: socketRef.current?.id,
      remaining: q.length,
    });
  }, [getActiveRoomId]);

  const renegotiateVideoReceive = useCallback(async (userId, pc) => {
    const peerId = normalizeUserId(userId);
    if (!activeRef.current || !pc || renegotiatedVideoRef.current[peerId]) return;
    if (pc.signalingState !== "stable") return;

    const videoTransceiver = pc.getTransceivers?.()
      ?.find((transceiver) => transceiver.receiver?.track?.kind === "video" || transceiver.sender?.track?.kind === "video");
    if (!videoTransceiver) {
      pc.addTransceiver("video", { direction: "recvonly" });
    } else if (!videoTransceiver.sender?.track && videoTransceiver.direction !== "recvonly") {
      videoTransceiver.direction = "recvonly";
    }

    renegotiatedVideoRef.current[peerId] = true;
    try {
      const activeRoomId = getActiveRoomId();
      debugRoom("renegotiate video receive", activeRoomId, { toUserId: peerId });
      debugVideoCall("[VideoCall] remote video chưa có frame, renegotiate video receive:", peerId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      logSdpDebug("local-offer:renegotiate-video", {
        userId: peerId,
        summary: summarizeSdp(pc.localDescription),
      });
      logSignalDebug("emit:group-call-offer:renegotiate", {
        fromUserId: currentUserIdRef.current,
        toUserId: peerId,
        roomId: activeRoomId,
        socketId: socketRef.current?.id,
      });
      socketRef.current.emit("group-call-offer", {
        toUserId: peerId,
        offer,
        roomId: activeRoomId,
        callerName: currentUserName,
      });
    } catch (err) {
      renegotiatedVideoRef.current[peerId] = false;
      console.error("[VideoCall] renegotiate video lỗi:", err);
    }
  }, [currentUserName, debugRoom, getActiveRoomId]);

  const startStatsMonitor = useCallback((userId, pc) => {
    if (statsTimersRef.current[userId]) return;
    statsTimersRef.current[userId] = window.setInterval(async () => {
      if (!activeRef.current || !pc || !["connecting", "connected"].includes(pc.connectionState)) return;
      try {
        const stats = await pc.getStats();
        const inboundVideo = [];
        const outboundVideo = [];
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            inboundVideo.push({
              packetsReceived: report.packetsReceived || 0,
              bytesReceived: report.bytesReceived || 0,
              framesDecoded: report.framesDecoded || 0,
            });
          }
          if (report.type === "outbound-rtp" && report.kind === "video") {
            outboundVideo.push({
              packetsSent: report.packetsSent || 0,
              bytesSent: report.bytesSent || 0,
              framesEncoded: report.framesEncoded || 0,
            });
          }
        });
        if (inboundVideo.length || outboundVideo.length) {
          const videoReceivers = pc.getReceivers?.()
            .filter((receiver) => receiver.track?.kind === "video")
            .map((receiver) => ({
              muted: receiver.track.muted,
              readyState: receiver.track.readyState,
            })) || [];

          const hasDecodedFrame = inboundVideo.some((item) => item.framesDecoded > 0);
          const hasMutedVideoReceiver = videoReceivers.some((item) => item.readyState === "live" && item.muted);
          if (hasDecodedFrame) {
            debugVideoCall("[VideoCall] video-stats", userId, JSON.stringify({ inboundVideo, outboundVideo, videoReceivers }));
            window.clearInterval(statsTimersRef.current[userId]);
            delete statsTimersRef.current[userId];
            return;
          }
          debugVideoCall("[VideoCall] video-stats", userId, JSON.stringify({ inboundVideo, outboundVideo, videoReceivers }));
          if (!hasDecodedFrame && hasMutedVideoReceiver) {
            await renegotiateVideoReceive(userId, pc);
          }
        }
      } catch (err) {
        console.warn("[VideoCall] getStats lỗi:", err?.message || err);
      }
    }, 3000);
  }, [renegotiateVideoReceive]);

  const scheduleMissingVideoRepair = useCallback((userId, delayMs = 4500) => {
    const peerId = normalizeUserId(userId);
    if (!peerId || missingVideoTimersRef.current[peerId]) return;

    missingVideoTimersRef.current[peerId] = window.setTimeout(() => {
      delete missingVideoTimersRef.current[peerId];
      if (!activeRef.current) return;

      const pc = pcsRef.current[peerId];
      const stream = remoteStreamsRef.current[peerId];
      const tracks = stream?.getTracks?.() || [];
      const hasLiveAudio = tracks.some((track) => track.kind === "audio" && track.readyState === "live");
      const hasLiveVideo = tracks.some((track) => track.kind === "video" && track.readyState === "live");
      console.log("[VIDEO_REPAIR]", {
        userId: peerId,
        hasLiveAudio,
        hasLiveVideo,
        trackSummary: tracks.map((track) => `${track.kind}:${track.readyState}:${track.muted}`),
        connectionState: pc?.connectionState,
        iceConnectionState: pc?.iceConnectionState,
        signalingState: pc?.signalingState,
      });

      if (hasLiveVideo) {
        setRemoteStreams((prev) => prev.map((item) => (
          item.userId === peerId ? { ...item, version: (item.version || 0) + 1 } : item
        )));
        console.log("[VIDEO_REPAIR]", {
          userId: peerId,
          action: "reattach-live-video-stream",
          trackSummary: tracks.map((track) => `${track.kind}:${track.readyState}:${track.muted}`),
        });
        return;
      }

      if (pc && hasLiveAudio && !hasLiveVideo) {
        renegotiatedVideoRef.current[peerId] = false;
        renegotiateVideoReceive(peerId, pc);
      }
    }, delayMs);
  }, [renegotiateVideoReceive]);

  const attachLocalTracks = useCallback(async (pc, userId, stream, { ensureVideoReceiver = false } = {}) => {
    if (!pc || !stream) return;
    for (const track of stream.getTracks()) {
      const senders = pc.getSenders();
      const alreadyAdded = senders.some((sender) => sender.track?.id === track.id);
      if (alreadyAdded) continue;

      const reusableSender = senders.find((sender) =>
        sender.track?.kind === track.kind && sender.track.readyState === "ended"
      );
      if (reusableSender) {
        await reusableSender.replaceTrack(track);
        const reusableTransceiver = pc.getTransceivers?.()
          ?.find((item) => item.sender === reusableSender);
        if (reusableTransceiver) reusableTransceiver.direction = "sendrecv";
        continue;
      }

      const transceiver = pc.getTransceivers?.()
        ?.find((item) => {
          const kind = item.receiver?.track?.kind || item.sender?.track?.kind;
          return kind === track.kind && !item.sender?.track;
        });

      if (transceiver) {
        await transceiver.sender.replaceTrack(track);
        transceiver.direction = "sendrecv";
      } else {
        pc.addTrack(track, stream);
      }
    }

    if (ensureVideoReceiver) {
      const videoTransceiver = pc.getTransceivers?.()
        ?.find((transceiver) => transceiver.receiver?.track?.kind === "video" || transceiver.sender?.track?.kind === "video");
      if (videoTransceiver) {
        try {
          videoTransceiver.direction = videoTransceiver.sender?.track ? "sendrecv" : "recvonly";
        } catch (err) {
          console.warn("[VideoCall] Không set được video transceiver recvonly:", err?.message || err);
        }
      } else {
        pc.addTransceiver("video", { direction: "recvonly" });
      }
    }

    if (isGroupRef.current) {
      const videoSenders = pc.getSenders?.().filter((sender) => sender.track?.kind === "video") || [];
      for (const sender of videoSenders) {
        try {
          const params = sender.getParameters();
          params.encodings = params.encodings?.length ? params.encodings : [{}];
          params.encodings = params.encodings.map((encoding) => ({
            ...encoding,
            maxBitrate: Math.min(encoding.maxBitrate || 160000, 160000),
            maxFramerate: Math.min(encoding.maxFramerate || 12, 12),
            scaleResolutionDownBy: Math.max(encoding.scaleResolutionDownBy || 1, 1.5),
          }));
          await sender.setParameters(params);
          console.log("[MEDIA_DEBUG]", {
            event: "group-sender-optimized",
            userId,
            trackId: sender.track?.id,
            encodings: params.encodings,
          });
        } catch (err) {
          console.warn("[VideoCall] Không set được bitrate video nhóm:", err?.message || err);
        }
      }
    }

    debugVideoCall("[VideoCall] local-tracks", userId, stream.getTracks().map((track) => `${track.kind}:${track.readyState}`));
    debugVideoCall("[VideoCall] transceivers", userId, pc.getTransceivers?.().map((item) => ({
      mid: item.mid,
      direction: item.direction,
      currentDirection: item.currentDirection,
      sender: item.sender?.track?.kind || null,
      receiver: item.receiver?.track?.kind || null,
    })));
  }, []);

  const restartPeerIce = useCallback(async (userId, reason = "unknown") => {
    const peerId = normalizeUserId(userId);
    const pc = pcsRef.current[peerId];
    if (!activeRef.current || !peerId || !pc || pc.connectionState === "closed") return;
    if (!localStreamRef.current || iceRestartingRef.current[peerId]) return;

    const attempts = (iceRestartAttemptsRef.current[peerId] || 0) + 1;
    iceRestartAttemptsRef.current[peerId] = attempts;
    if (attempts > MAX_ICE_RESTART_ATTEMPTS) {
      logPeerRecovery(peerId, {
        event: "ice-restart-give-up",
        reason,
        attempts,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState,
      });
      return;
    }

    if (pc.signalingState !== "stable") {
      logPeerRecovery(peerId, {
        event: "ice-restart-wait-stable",
        reason,
        attempts,
        signalingState: pc.signalingState,
      });
      return;
    }

    iceRestartingRef.current[peerId] = true;
    try {
      const activeRoomId = getActiveRoomId();
      debugRoom("renegotiate ice restart", activeRoomId, { toUserId: peerId, reason });
      logPeerRecovery(peerId, {
        event: "ice-restart-start",
        reason,
        attempts,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      pc.restartIce?.();
      await attachLocalTracks(pc, peerId, localStreamRef.current, { ensureVideoReceiver: true });
      const offer = await pc.createOffer({ iceRestart: true, offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      logSdpDebug("local-offer:ice-restart", {
        userId: peerId,
        summary: summarizeSdp(pc.localDescription),
      });
      logSignalDebug("emit:group-call-offer:ice-restart", {
        fromUserId: currentUserIdRef.current,
        toUserId: peerId,
        roomId: activeRoomId,
        socketId: socketRef.current?.id,
      });
      socketRef.current.emit("group-call-offer", {
        toUserId: peerId,
        offer,
        roomId: activeRoomId,
        callerName: currentUserName,
      });
    } catch (err) {
      console.error("[VideoCall] ICE restart lỗi:", err);
      logPeerRecovery(peerId, { event: "ice-restart-error", reason, message: err?.message || String(err) });
    } finally {
      iceRestartingRef.current[peerId] = false;
    }
  }, [attachLocalTracks, currentUserName, debugRoom, getActiveRoomId]);

  const scheduleIceCheckingTimeout = useCallback((userId, pc) => {
    const peerId = normalizeUserId(userId);
    if (!peerId || iceCheckingTimersRef.current[peerId]) return;
    iceCheckingTimersRef.current[peerId] = window.setTimeout(() => {
      delete iceCheckingTimersRef.current[peerId];
      const latestPc = pcsRef.current[peerId];
      if (!activeRef.current || !latestPc || latestPc.connectionState === "closed") return;
      if (latestPc.iceConnectionState === "checking") {
        logPeerRecovery(peerId, {
          event: "ice-checking-timeout",
          timeoutMs: ICE_CHECKING_TIMEOUT_MS,
          relaySeen: relayCandidateSeenRef.current[peerId] || { local: false, remote: false },
          connectionState: latestPc.connectionState,
          iceConnectionState: latestPc.iceConnectionState,
          signalingState: latestPc.signalingState,
        });
        restartPeerIce(peerId, "iceConnectionState:checking-timeout");
      }
    }, ICE_CHECKING_TIMEOUT_MS);
  }, [restartPeerIce]);

  const clearIceCheckingTimeout = useCallback((userId) => {
    const peerId = normalizeUserId(userId);
    if (!peerId || !iceCheckingTimersRef.current[peerId]) return;
    window.clearTimeout(iceCheckingTimersRef.current[peerId]);
    delete iceCheckingTimersRef.current[peerId];
  }, []);

  const schedulePeerRecovery = useCallback((userId, pc, reason, delayMs = 1500) => {
    const peerId = normalizeUserId(userId);
    if (!activeRef.current || !peerId || !pc || pc.connectionState === "closed") return;
    if (recoveryTimersRef.current[peerId]) return;

    logPeerRecovery(peerId, {
      event: "schedule",
      reason,
      delayMs,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
    });

    recoveryTimersRef.current[peerId] = window.setTimeout(() => {
      delete recoveryTimersRef.current[peerId];
      const latestPc = pcsRef.current[peerId];
      if (!activeRef.current || !latestPc || latestPc.connectionState === "closed") return;
      if (["connected", "completed"].includes(latestPc.iceConnectionState) || latestPc.connectionState === "connected") {
        return;
      }
      restartPeerIce(peerId, reason);
    }, delayMs);
  }, [restartPeerIce]);

  const renegotiatePeerAfterLocalVideoChange = useCallback(async (userId, reason = "local-video-change") => {
    const peerId = normalizeUserId(userId);
    const pc = pcsRef.current[peerId];
    if (!activeRef.current || !peerId || !pc || pc.connectionState === "closed" || !localStreamRef.current) return;

    if (pc.signalingState !== "stable") {
      logCameraDebug("renegotiate-wait-stable", {
        userId: peerId,
        reason,
        signalingState: pc.signalingState,
      });
      window.setTimeout(() => renegotiatePeerAfterLocalVideoChange(peerId, reason), 700);
      return;
    }

    try {
      const activeRoomId = getActiveRoomId();
      debugRoom("renegotiate camera change", activeRoomId, { toUserId: peerId, reason });
      await attachLocalTracks(pc, peerId, localStreamRef.current, { ensureVideoReceiver: true });
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      logCameraDebug("renegotiate-offer", {
        userId: peerId,
        reason,
        senders: pc.getSenders?.().map((sender) => ({
          kind: sender.track?.kind || null,
          readyState: sender.track?.readyState || null,
          enabled: sender.track?.enabled ?? null,
        })),
      });
      logSdpDebug("local-offer:camera-change", {
        userId: peerId,
        summary: summarizeSdp(pc.localDescription),
      });
      logSignalDebug("emit:group-call-offer:camera-change", {
        fromUserId: currentUserIdRef.current,
        toUserId: peerId,
        roomId: activeRoomId,
        socketId: socketRef.current?.id,
      });
      socketRef.current.emit("group-call-offer", {
        toUserId: peerId,
        offer,
        roomId: activeRoomId,
        callerName: currentUserName,
      });
    } catch (err) {
      console.error("[VideoCall] Không renegotiate được video sau khi bật camera:", err);
      logCameraDebug("renegotiate-error", { userId: peerId, reason, message: err?.message || String(err) });
    }
  }, [attachLocalTracks, currentUserName, debugRoom, getActiveRoomId]);

  const renegotiateAllPeersAfterLocalVideoChange = useCallback((reason = "local-video-change") => {
    Object.keys(pcsRef.current).forEach((peerId) => {
      renegotiatePeerAfterLocalVideoChange(peerId, reason);
    });
  }, [renegotiatePeerAfterLocalVideoChange]);

  const ensureLocalVideoTrack = useCallback(async () => {
    const currentStream = localStreamRef.current;
    if (!currentStream) return null;

    const existingLiveVideo = currentStream.getVideoTracks().find((track) => track.readyState === "live");
    if (existingLiveVideo) {
      existingLiveVideo.enabled = true;
      logCameraDebug("reuse-live-video-track", {
        trackId: existingLiveVideo.id,
        settings: existingLiveVideo.getSettings?.(),
      });
      return existingLiveVideo;
    }

    const nextVideoTrack = await getVideoOnlyTrack();
    if (!nextVideoTrack) throw new Error("Không lấy được video track mới.");
    if (isGroupRef.current) {
      await optimizeGroupVideoTrack(new MediaStream([nextVideoTrack]));
    }

    currentStream.getVideoTracks().forEach((track) => {
      track.stop();
      currentStream.removeTrack(track);
    });
    currentStream.addTrack(nextVideoTrack);

    const nextStream = new MediaStream(currentStream.getTracks());
    localStreamRef.current = nextStream;
    setLocalStream(nextStream);
    setAudioOnly(false);
    logCameraDebug("add-new-video-track", {
      trackId: nextVideoTrack.id,
      settings: nextVideoTrack.getSettings?.(),
      peerIds: Object.keys(pcsRef.current),
    });
    return nextVideoTrack;
  }, []);

  const createPeer = useCallback((userId) => {
    const peerId = normalizeUserId(userId);
    logUserIdDebug(peerId);
    if (pcsRef.current[peerId]?.connectionState === "closed") {
      destroyPeer(peerId);
    }
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[peerId] = pc;
    queuesRef.current[peerId] = queuesRef.current[peerId] || [];
    relayCandidateSeenRef.current[peerId] = { local: false, remote: false };
    console.log("[ICE_CONFIG_DEBUG]", {
      userId: peerId,
      iceServers: ICE_SERVERS.iceServers.map((item) => item.urls),
      iceTransportPolicy: ICE_SERVERS.iceTransportPolicy,
      bundlePolicy: ICE_SERVERS.bundlePolicy,
    });
    logPeerDebug(peerId, pc);

    pc.ontrack = (e) => {
      if (!activeRef.current) return;
      markPeerJoined(peerId);
      console.log("[TRACK_DEBUG]", {
        message: `✅ Received remote track from ${peerId}`,
        userId: peerId,
        kind: e.track.kind,
        muted: e.track.muted,
        readyState: e.track.readyState,
        streamIds: e.streams?.map((stream) => stream.id) || [],
      });
      const incomingStream = e.streams?.[0] || null;
      const remoteStream = remoteStreamsRef.current[peerId] || incomingStream || new MediaStream();
      remoteStreamsRef.current[peerId] = remoteStream;
      if (!remoteStream.getTracks().some((track) => track.id === e.track.id)) {
        remoteStream.addTrack(e.track);
      }
      const publishRemoteStream = () => {
        setRemoteStreams((prev) => {
          const existing = prev.find((item) => item.userId === peerId);
          if (existing) {
            return prev.map((item) => (
              item.userId === peerId
                ? { userId: peerId, stream: remoteStream, version: (item.version || 0) + 1 }
                : item
            ));
          }
          return [...prev, { userId: peerId, stream: remoteStream, version: 1 }];
        });
        console.log("[REMOTE_STREAM_DEBUG]", {
          action: "publish",
          userId: peerId,
          remoteKeys: Object.keys({ ...remoteStreamsRef.current, [peerId]: remoteStream }),
          tracks: remoteStream.getTracks().map((track) => `${track.kind}:${track.readyState}:${track.muted}`),
        });
      };
      debugVideoCall("[VideoCall] remote-track", peerId, e.track.kind, {
        muted: e.track.muted,
        readyState: e.track.readyState,
        tracks: remoteStream.getTracks().map((track) => `${track.kind}:${track.readyState}`),
      });
      e.track.addEventListener?.("unmute", () => {
        console.log("[TRACK_DEBUG]", {
          userId: peerId,
          kind: e.track.kind,
          muted: e.track.muted,
          readyState: e.track.readyState,
          event: "unmute",
        });
        debugVideoCall("[VideoCall] remote-track-unmute", peerId, e.track.kind);
        publishRemoteStream();
      });
      e.track.addEventListener?.("ended", publishRemoteStream);
      publishRemoteStream();
      scheduleMissingVideoRepair(peerId);
      if (e.track.kind === "video") {
        startStatsMonitor(peerId, pc);
        window.setTimeout(() => {
          if (!activeRef.current || !pcsRef.current[peerId]) return;
          if (e.track.readyState === "live" && e.track.muted) {
            renegotiateVideoReceive(peerId, pc);
          }
        }, 2500);
      }
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate || !activeRef.current) return;
      const activeRoomId = getActiveRoomId();
      const candidateInfo = parseIceCandidate(e.candidate);
      relayCandidateSeenRef.current[peerId] = relayCandidateSeenRef.current[peerId] || { local: false, remote: false };
      if (candidateInfo.isRelay) relayCandidateSeenRef.current[peerId].local = true;
      logIceCandidateDebug("emit-local-candidate", {
        userId: peerId,
        roomId: activeRoomId,
        ...candidateInfo,
        relaySeen: relayCandidateSeenRef.current[peerId],
      });
      debugRoom("emit ice candidate", activeRoomId, { toUserId: peerId });
      logSignalDebug("emit:ice-candidate", {
        fromUserId: currentUserIdRef.current,
        toUserId: peerId,
        roomId: activeRoomId,
        socketId: socketRef.current?.id,
      });
      socketRef.current.emit("ice-candidate", { toUserId: peerId, roomId: activeRoomId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (!activeRef.current) return;
      const state = pc.connectionState;
      logPeerDebug(peerId, pc);
      console.log("[PEER_EVENT_DEBUG]", {
        event: "connectionstatechange",
        userId: peerId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
      });
      debugVideoCall("[VideoCall] peer-state", peerId, state);
      if (state === "connected") {
        clearIceCheckingTimeout(peerId);
        iceRestartAttemptsRef.current[peerId] = 0;
        if (recoveryTimersRef.current[peerId]) {
          window.clearTimeout(recoveryTimersRef.current[peerId]);
          delete recoveryTimersRef.current[peerId];
        }
        setStatus("connected");
        setErrorMsg(null);
        scheduleMissingVideoRepair(peerId);
        startStatsMonitor(peerId, pc);
      }
      if (state === "connected" && !callStartedAtRef.current) {
        callStartedAtRef.current = Date.now();
      }
      if (state === "failed") {
        schedulePeerRecovery(peerId, pc, "connectionState:failed", 300);
      }
      if (state === "disconnected") {
        schedulePeerRecovery(peerId, pc, "connectionState:disconnected", 3500);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!activeRef.current) return;
      logPeerDebug(peerId, pc);
      console.log("[PEER_EVENT_DEBUG]", {
        event: "iceconnectionstatechange",
        userId: peerId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
        relaySeen: relayCandidateSeenRef.current[peerId] || { local: false, remote: false },
      });
      debugVideoCall("[VideoCall] ice-state", peerId, pc.iceConnectionState);
      if (["connected", "completed"].includes(pc.iceConnectionState)) {
        clearIceCheckingTimeout(peerId);
        iceRestartAttemptsRef.current[peerId] = 0;
        if (recoveryTimersRef.current[peerId]) {
          window.clearTimeout(recoveryTimersRef.current[peerId]);
          delete recoveryTimersRef.current[peerId];
        }
        scheduleMissingVideoRepair(peerId);
        startStatsMonitor(peerId, pc);
      }
      if (pc.iceConnectionState === "failed") {
        clearIceCheckingTimeout(peerId);
        schedulePeerRecovery(peerId, pc, "iceConnectionState:failed", 300);
      }
      if (pc.iceConnectionState === "disconnected") {
        clearIceCheckingTimeout(peerId);
        schedulePeerRecovery(peerId, pc, "iceConnectionState:disconnected", 3500);
      }
      if (pc.iceConnectionState === "checking") {
        scheduleIceCheckingTimeout(peerId, pc);
      }
    };

    pc.onicegatheringstatechange = () => {
      if (!activeRef.current) return;
      console.log("[PEER_EVENT_DEBUG]", {
        event: "icegatheringstatechange",
        userId: peerId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
        relaySeen: relayCandidateSeenRef.current[peerId] || { local: false, remote: false },
      });
    };

    pc.onsignalingstatechange = () => {
      if (!activeRef.current) return;
      console.log("[PEER_EVENT_DEBUG]", {
        event: "signalingstatechange",
        userId: peerId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
      });
    };

    return pc;
  }, [clearIceCheckingTimeout, debugRoom, destroyPeer, getActiveRoomId, markPeerJoined, renegotiateVideoReceive, scheduleIceCheckingTimeout, scheduleMissingVideoRepair, schedulePeerRecovery, startStatsMonitor]);

  // Main effect.
  useEffect(() => {
    activeRef.current = true;
    const socket = socketRef.current;

    const handleAccepted = async ({ fromUserId, answer, roomId: eventRoomId }) => {
      if (!activeRef.current) return;
      const peerId = normalizeUserId(fromUserId);
      if (!isCurrentRoomEvent("call-accepted", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;
      debugRoom("receive answer", eventRoomId || getActiveRoomId(), { fromUserId: peerId });
      logSignalDebug("recv:call-accepted", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || getActiveRoomId(),
        socketId: socket.id,
      });
      const pc = pcsRef.current[peerId];
      if (!pc) {
        logSignalDebug("drop:call-accepted:no-peer", {
          fromUserId: peerId,
          toUserId: currentUserIdRef.current,
          roomId: eventRoomId || getActiveRoomId(),
          socketId: socket.id,
        });
        return;
      }
      if (pc.signalingState !== "have-local-offer") {
        logSignalDebug("drop:call-accepted:wrong-state", {
          fromUserId: peerId,
          toUserId: currentUserIdRef.current,
          roomId: eventRoomId || getActiveRoomId(),
          socketId: socket.id,
          signalingState: pc.signalingState,
        });
        debugVideoCall("[VideoCall] Bỏ qua answer trễ/trùng", {
          fromUserId: peerId,
          signalingState: pc.signalingState,
        });
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        logSdpDebug("remote-answer:call-accepted", {
          userId: peerId,
          summary: summarizeSdp(answer),
        });
        logPeerDebug(peerId, pc);
        await processQueue(peerId);
      } catch (e) { console.error("[VideoCall] setRemoteDesc:", e); }
    };

    const handleIceCandidate = async ({ fromUserId, candidate, roomId: eventRoomId }) => {
      if (!activeRef.current || !candidate) return;
      const peerId = normalizeUserId(fromUserId);
      if (!isCurrentRoomEvent("ice-candidate", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;
      debugRoom("receive ice candidate", eventRoomId || getActiveRoomId(), { fromUserId: peerId });
      logSignalDebug("recv:ice-candidate", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || getActiveRoomId(),
        socketId: socket.id,
      });
      const pc = pcsRef.current[peerId];
      if (!pc) {
        queuesRef.current[peerId] = queuesRef.current[peerId] || [];
        queuesRef.current[peerId].push(candidate);
        logSignalDebug("queue:ice-before-peer", {
          fromUserId: peerId,
          toUserId: currentUserIdRef.current,
          roomId: eventRoomId || getActiveRoomId(),
          socketId: socket.id,
          queueLength: queuesRef.current[peerId].length,
        });
        return;
      }
      if (pc.remoteDescription) {
        try {
          const candidateInfo = parseIceCandidate(candidate);
          relayCandidateSeenRef.current[peerId] = relayCandidateSeenRef.current[peerId] || { local: false, remote: false };
          if (candidateInfo.isRelay) relayCandidateSeenRef.current[peerId].remote = true;
          logIceCandidateDebug("add-remote-candidate", {
            userId: peerId,
            roomId: eventRoomId || getActiveRoomId(),
            ...candidateInfo,
            relaySeen: relayCandidateSeenRef.current[peerId],
          });
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        catch (e) { console.warn("[VideoCall] ICE:", e); }
      } else {
        queuesRef.current[peerId] = queuesRef.current[peerId] || [];
        queuesRef.current[peerId].push(candidate);
        logSignalDebug("queue:ice-before-remote-description", {
          fromUserId: peerId,
          toUserId: currentUserIdRef.current,
          roomId: eventRoomId || getActiveRoomId(),
          socketId: socket.id,
          queueLength: queuesRef.current[peerId].length,
        });
      }
    };

    const handleGroupOffer = async ({ fromUserId, offer, roomId: eventRoomId }) => {
      if (!activeRef.current || !localStreamRef.current) return;
      const peerId = normalizeUserId(fromUserId);
      if (!isCurrentRoomEvent("group-call-offer", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;
      const activeRoomId = getActiveRoomId();
      debugRoom("receive offer", eventRoomId || activeRoomId, { fromUserId: peerId });
      logSignalDebug("recv:group-call-offer", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || activeRoomId,
        socketId: socket.id,
      });
      debugVideoCall("[VideoCall] group-call-offer", peerId);
      const pc = createPeer(peerId);
      try {
        logSdpDebug("remote-offer:group-call-offer", {
          userId: peerId,
          summary: summarizeSdp(offer),
        });
        const hasOfferCollision = pc.signalingState !== "stable";
        if (hasOfferCollision) {
          const localUserId = currentUserIdRef.current;
          const politePeer = !localUserId || localUserId > peerId;
          logSignalDebug("offer-collision", {
            fromUserId: peerId,
            toUserId: localUserId,
            roomId: activeRoomId,
            socketId: socket.id,
            signalingState: pc.signalingState,
            politePeer,
          });
          if (!politePeer) return;
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        logPeerDebug(peerId, pc);
        await attachLocalTracks(pc, peerId, localStreamRef.current, { ensureVideoReceiver: true });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        logSdpDebug("local-answer:group-call-offer", {
          userId: peerId,
          summary: summarizeSdp(pc.localDescription),
        });
        logSignalDebug("emit:call-accepted", {
          fromUserId: currentUserIdRef.current,
          toUserId: peerId,
          roomId: activeRoomId,
          socketId: socket.id,
        });
        socket.emit("call-accepted", { toUserId: peerId, answer, roomId: activeRoomId });
        await processQueue(peerId);
      } catch (e) { console.error("[VideoCall] group-call-offer:", e); }
    };

    // call-ended có thể là 1 peer rời, hoặc creator kết thúc toàn bộ group call.
    const handleCallEnded = ({ fromUserId, roomId: eventRoomId, endedForAll = false, status: endedStatus = "" } = {}) => {
      if (!activeRef.current) return;
      const peerId = normalizeUserId(fromUserId);
      if (!isCurrentRoomEvent("call-ended", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;
      logSignalDebug("recv:call-ended", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || getActiveRoomId(),
        socketId: socket.id,
      });
      debugVideoCall("[VideoCall] call-ended", peerId);
      if (endedForAll || endedStatus === "ended") {
        finishAndClose("Cuộc gọi đã kết thúc");
        return;
      }
      if (peerId && isGroupRef.current) {
        destroyPeer(peerId);
        console.log("[GROUP_CALL_DEBUG]", {
          action: "call-ended peer only",
          userId: currentUserIdRef.current,
          leftUserId: peerId,
          participantCount: Object.keys(pcsRef.current).length,
          participants: Object.keys(pcsRef.current),
          roomId: getActiveRoomId(),
        });
      } else {
        cleanup();
      }
    };

    // call-rejected trong nhóm chỉ hiện toast 3s, xóa peer, không đóng cuộc gọi.
    const handleCallRejected = ({ fromUserId, roomId: eventRoomId } = {}) => {
      if (!activeRef.current) return;
      const peerId = normalizeUserId(fromUserId);
      if (!isCurrentRoomEvent("call-rejected", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;
      logSignalDebug("recv:call-rejected", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || getActiveRoomId(),
        socketId: socket.id,
      });
      debugVideoCall("[VideoCall] call-rejected from", peerId);
      if (peerId && isGroupRef.current) {
        const name = activeRoomRef.current?.members?.find((m) => normalizeUserId(m.id) === peerId)?.fullName || "Thành viên";
        setErrorMsg(`${name} từ chối cuộc gọi`);
        setTimeout(() => setErrorMsg(null), 3000);
        destroyPeer(peerId);
      } else {
        setErrorMsg("Cuộc gọi bị từ chối.");
        setTimeout(() => { if (activeRef.current) cleanup(); }, 2000);
      }
    };

    const handleCallUnavailable = ({ reason, targetUserId, isGroupCall, roomId: eventRoomId, activeRoomId } = {}) => {
      if (!activeRef.current) return;
      const peerId = normalizeUserId(targetUserId);
      if (!isCurrentRoomEvent("call-unavailable", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;
      logSignalDebug("recv:call-unavailable", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || getActiveRoomId(),
        socketId: socket.id,
        reason,
        activeRoomId,
      });
      debugVideoCall("[VideoCall] call-unavailable", { reason, targetUserId: peerId, isGroupCall });
      if ((isGroupCall || isGroupRef.current) && reason === "active-call") {
        setErrorMsg("Nhóm đang có cuộc gọi khác đang diễn ra.");
        window.setTimeout(() => {
          if (activeRef.current) cleanup();
        }, 1200);
        return;
      }
      if ((isGroupCall || isGroupRef.current) && peerId) {
        destroyPeer(peerId);
        return;
      }
      if (reason === "offline") {
        setErrorMsg("Người nhận hiện không trực tuyến.");
      } else {
        setErrorMsg("Không thể thực hiện cuộc gọi lúc này.");
      }
      setTimeout(() => { if (activeRef.current) cleanup(); }, 1800);
    };

    const handleUserLeftGroupCall = ({ leftUserId, roomId: eventRoomId, participantCount, participants = [] } = {}) => {
      if (!activeRef.current) return;
      const peerId = normalizeUserId(leftUserId);
      if (!peerId || peerId === currentUserIdRef.current) return;
      if (!isCurrentRoomEvent("user-left-group-call", eventRoomId, {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
      })) return;

      logSignalDebug("recv:user-left-group-call", {
        fromUserId: peerId,
        toUserId: currentUserIdRef.current,
        roomId: eventRoomId || getActiveRoomId(),
        socketId: socket.id,
        participantCount,
        participants,
      });

      destroyPeer(peerId);
      window.setTimeout(() => {
        if (!activeRef.current || !isGroupRef.current) return;
        const remainingPeerIds = Object.keys(pcsRef.current);
        const remainingRemoteStreams = Object.keys(remoteStreamsRef.current);
        console.log("[GROUP_CALL_DEBUG]", {
          roomId: getActiveRoomId(),
          action: "participant left",
          userId: currentUserIdRef.current,
          leftUserId: peerId,
          participantCount: Number.isFinite(participantCount) ? participantCount : remainingPeerIds.length,
          participants: participants.length ? participants : remainingPeerIds,
          remainingPeerIds,
          remainingRemoteStreams,
        });
      }, 0);
    };

    socket.on("call-accepted",    handleAccepted);
    socket.on("ice-candidate",    handleIceCandidate);
    socket.on("call-ended",       handleCallEnded);
    socket.on("call-rejected",    handleCallRejected);
    socket.on("call-unavailable", handleCallUnavailable);
    socket.on("group-call-offer", handleGroupOffer);
    socket.on("user-left-group-call", handleUserLeftGroupCall);

    if (!isCallee) {
      missedCallTimerRef.current = window.setTimeout(() => {
        if (!activeRef.current || joinedPeerIdsRef.current.length > 0) return;
        emitMissedCall();
        setErrorMsg("Cuộc gọi nhỡ");
        activeRef.current = false;
        destroyAll();
        window.setTimeout(() => onCloseRef.current(), 1800);
      }, MISSED_CALL_TIMEOUT_SECONDS * 1000);
    }

    const init = async () => {
      try {
        const activeRoomId = getActiveRoomId();
        const currentTargets  = targetsRef.current;
        const currentIsGroup  = isGroupRef.current;
        debugRoom(isCallee ? "join room" : "create room", activeRoomId, {
          isCallee,
          targets: currentTargets,
        });
        if (!isCallee) {
          const permissions = await checkMediaPermissions();
            if (permissions.camera === "denied" || permissions.microphone === "denied") {
            setErrorMsg("Chưa có quyền Camera/Microphone. Vui lòng cấp quyền rồi thử lại.");
            return;
          }
        }

        const stream = await getMediaStream();
        if (!activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (currentIsGroup) await optimizeGroupVideoTrack(stream);

        const hasVideo = stream.getVideoTracks().length > 0;
        if (!hasVideo) setAudioOnly(true);
        localStreamRef.current = stream;
        setLocalStream(stream);

        if (isCallee) {
          const singleOffer = callerOfferRef.current;
          const offersMap   = callerOffersRef.current || {};

          if (!currentIsGroup && singleOffer && currentTargets.length === 1) {
            // Gọi đơn callee.
            const uid = normalizeUserId(currentTargets[0]);
            const pc  = createPeer(uid);
            await pc.setRemoteDescription(new RTCSessionDescription(singleOffer));
            await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            logSdpDebug("local-answer:single", {
              userId: uid,
              summary: summarizeSdp(pc.localDescription),
            });
            logSignalDebug("emit:call-accepted", {
              fromUserId: currentUserIdRef.current,
              toUserId: uid,
              roomId: activeRoomId,
              socketId: socket.id,
            });
            socket.emit("call-accepted", { toUserId: uid, answer, roomId: activeRoomId });
            await processQueue(uid);
          } else {
            // Gọi nhóm callee: xử lý cả 2 chiều.
            // - Answer cho người đã gửi offer.
            // - Gửi offer đến người trong nhóm chưa gửi offer cho mình.
            const offeredSet = new Set(Object.keys(offersMap).map(normalizeUserId));

            for (const [rawUid, offer] of Object.entries(offersMap)) {
              if (!activeRef.current) break;
              const uid = normalizeUserId(rawUid);
              const pc = createPeer(uid);
              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              logSdpDebug("local-answer:group-initial", {
                userId: uid,
                summary: summarizeSdp(pc.localDescription),
              });
              logSignalDebug("emit:call-accepted", {
                fromUserId: currentUserIdRef.current,
                toUserId: uid,
                roomId: activeRoomId,
                socketId: socket.id,
              });
              socket.emit("call-accepted", { toUserId: uid, answer, roomId: activeRoomId });
              await processQueue(uid);
            }

            for (const rawUid of currentTargets) {
              if (!activeRef.current) break;
              const uid = normalizeUserId(rawUid);
              if (offeredSet.has(uid)) continue;
              const pc    = createPeer(uid);
              await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              logSdpDebug("local-offer:group-member", {
                userId: uid,
                summary: summarizeSdp(pc.localDescription),
              });
              logSignalDebug("emit:group-call-offer", {
                fromUserId: currentUserIdRef.current,
                toUserId: uid,
                roomId: activeRoomId,
                socketId: socket.id,
              });
              socket.emit("group-call-offer", {
                toUserId: uid, offer, roomId: activeRoomId, callerName: currentUserName,
              });
            }
          }
        } else {
          // Caller: gửi offer đến từng target.
          for (const rawUid of currentTargets) {
            if (!activeRef.current) break;
            const uid = normalizeUserId(rawUid);
            const pc    = createPeer(uid);
            await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            logSdpDebug("local-offer:call-user", {
              userId: uid,
              summary: summarizeSdp(pc.localDescription),
            });
            logSignalDebug("emit:call-user", {
              fromUserId: currentUserIdRef.current,
              toUserId: uid,
              roomId: activeRoomId,
              socketId: socket.id,
            });
            socket.emit("call-user", {
              targetUserId: uid,
              roomId: activeRoomId,
              signalData: offer,
              offer,
              callerName:  currentUserName,
              isGroupCall: currentTargets.length > 1,
              groupName:   activeRoomRef.current?.name,
            });
            debugVideoCall("[VideoCall] offer", uid);
          }
        }
      } catch (err) {
        if (!activeRef.current) return;
        const msgs = {
          NotAllowedError:  "Trình duyệt chặn camera/micro. Hãy cấp quyền.",
          NotFoundError:    "Không tìm thấy thiết bị âm thanh/video.",
          NotReadableError: "Camera/micro đang dùng bởi ứng dụng khác.",
        };
        setErrorMsg(msgs[err.name] ?? `Lỗi: ${err.name} - ${err.message}`);
      }
    };

    const initTimer = window.setTimeout(init, 0);

    return () => {
      activeRef.current = false;
      window.clearTimeout(initTimer);
      socket.off("call-accepted",    handleAccepted);
      socket.off("ice-candidate",    handleIceCandidate);
      socket.off("call-ended",       handleCallEnded);
      socket.off("call-rejected",    handleCallRejected);
      socket.off("call-unavailable", handleCallUnavailable);
      socket.off("group-call-offer", handleGroupOffer);
      socket.off("user-left-group-call", handleUserLeftGroupCall);
      clearMissedCallTimer();
      destroyAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((p) => !p);
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const shouldTurnOn = isVideoOff || !localStreamRef.current.getVideoTracks().some((track) => track.readyState === "live" && track.enabled);

    try {
      if (shouldTurnOn) {
        const videoTrack = await ensureLocalVideoTrack();
        if (!videoTrack) return;
        setIsVideoOff(false);
        setAudioOnly(false);
        logCameraDebug("camera-on", {
          trackId: videoTrack.id,
          peerIds: Object.keys(pcsRef.current),
        });
        renegotiateAllPeersAfterLocalVideoChange("camera-on");
        return;
      }

      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      setIsVideoOff(true);
      logCameraDebug("camera-off", {
        peerIds: Object.keys(pcsRef.current),
        trackIds: localStreamRef.current.getVideoTracks().map((track) => track.id),
      });
    } catch (err) {
      console.error("[VideoCall] Không bật được camera:", err);
      setErrorMsg("Không bật được camera. Vui lòng kiểm tra quyền camera.");
      window.setTimeout(() => setErrorMsg(null), 2500);
    }
  };

  const handleEndCall = () => {
    if (!isCallee && joinedPeerIdsRef.current.length === 0) {
      logCallState("missed");
      emitMissedCall();
      finishAndClose("Cuộc gọi nhỡ", 1200);
      return;
    }

    const durationSec = callStartedAtRef.current
      ? Math.max(0, Math.round((Date.now() - callStartedAtRef.current) / 1000))
      : 0;
    const activeRoomId = getActiveRoomId();
    logCallState("ended");
    if (isGroupRef.current) {
      logSignalDebug("emit:leave-group-call", {
        fromUserId: currentUserIdRef.current,
        roomId: activeRoomId,
        socketId: socketRef.current?.id,
        isCallCreator,
      });
      console.log("[GROUP_CALL_DEBUG]", {
        action: "leave",
        userId: currentUserIdRef.current,
        participantCount: Object.keys(pcsRef.current).length,
        participants: Object.keys(pcsRef.current),
        roomId: activeRoomId,
        isCallCreator,
      });
      socketRef.current.emit("leave-group-call", {
        roomId: activeRoomId,
        durationSec,
        callerName: currentUserName,
        isCallCreator,
      });
      cleanup();
      return;
    }

    targetsRef.current.forEach((uid) => {
      const peerId = normalizeUserId(uid);
      logSignalDebug("emit:end-call", {
        fromUserId: currentUserIdRef.current,
        toUserId: peerId,
        roomId: activeRoomId,
        socketId: socketRef.current?.id,
      });
      socketRef.current.emit("end-call", {
        toUserId: peerId,
        roomId: activeRoomId,
        durationSec,
        fromUserId: currentUserIdRef.current,
        callerName: currentUserName
      });
    });
    cleanup();
  };

  const visibleRemoteStreams = useMemo(() => {
    if (isGroup) {
      return remoteStreams.filter((item) => joinedPeerIds.includes(item.userId));
    }
    return targets.map((uid) => (
      remoteStreams.find((item) => item.userId === uid) || { userId: uid, stream: null }
    ));
  }, [isGroup, joinedPeerIds, remoteStreams, targets]);
  const visibleRemoteIds = useMemo(
    () => visibleRemoteStreams.map((item) => item.userId),
    [visibleRemoteStreams]
  );
  const total    = 1 + visibleRemoteStreams.length;
  const gridCols = total <= 2 ? "md:grid-cols-2" : total <= 4 ? "md:grid-cols-2" : "md:grid-cols-3";
  const getMemberName = (uid) => activeRoom?.members?.find((m) => normalizeUserId(m.id) === normalizeUserId(uid))?.fullName || "Thành viên";
  const showCallerCountdown = !isCallee && joinedPeerIds.length === 0;
  const localInitial = currentUserName?.[0]?.toUpperCase() || "B";
  const expectedPeerCount = targets.length;
  const hasEnabledLocalVideo = localStream?.getVideoTracks?.()
    ?.some((track) => track.readyState === "live" && track.enabled);
  const effectiveAudioOnly = audioOnly && !hasEnabledLocalVideo;
  const shouldShowLocalPlaceholder = !localStream || effectiveAudioOnly || isVideoOff || !hasEnabledLocalVideo;
  const isCameraButtonOff = effectiveAudioOnly || isVideoOff || !hasEnabledLocalVideo;

  useEffect(() => {
    const remoteStreamKeys = remoteStreams.map((item) => item.userId);
    console.log("[RENDER_DEBUG]", {
      targets,
      joinedPeerIds,
      remoteStreamKeys,
      visibleRemoteIds,
      visibleRemoteCount: visibleRemoteStreams.length,
    });
    console.log("[MESH_DEBUG]", {
      peerCount: Object.keys(pcsRef.current).length,
      expectedPeerCount,
      missingPeerIds: targets.filter((uid) => !pcsRef.current[uid]),
    });
  }, [expectedPeerCount, joinedPeerIds, remoteStreams, targets, visibleRemoteIds, visibleRemoteStreams.length]);

  return (
    <div className="fixed inset-0 z-9999 bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6">

      {/* Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-300 text-sm bg-slate-800/70 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
        {isGroup ? <Users size={15} /> : <Video size={15} />}
        <span>
          {isGroup
            ? `Cuộc gọi nhóm • ${activeRoom?.name || "Nhóm"} • ${visibleRemoteIds.length + 1} người đang tham gia`
            : `Cuộc gọi với ${getMemberName(targets[0])}`}
        </span>
        <span className={`ml-1 h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-yellow-400 animate-bounce"}`} />
      </div>

      {/* Error toast */}
      {errorMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-500/20 text-red-300 px-4 py-2 rounded-full border border-red-500/40 flex items-center gap-2 z-10 whitespace-nowrap text-sm backdrop-blur-sm">
          <AlertCircle size={15} /> {errorMsg}
        </div>
      )}

      {endNotice && !isGroupRef.current && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-emerald-500/20 text-emerald-200 px-5 py-2 rounded-full border border-emerald-400/40 flex items-center gap-2 z-20 whitespace-nowrap text-sm font-semibold backdrop-blur-sm">
          <AlertCircle size={15} /> {endNotice}
        </div>
      )}

      {effectiveAudioOnly && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-300 px-4 py-1.5 rounded-full border border-yellow-500/40 text-xs z-10">
          Camera không khả dụng — chỉ dùng âm thanh
        </div>
      )}

      {/* Video grid */}
      <div className={`w-full max-w-5xl grid grid-cols-1 ${gridCols} gap-3 md:gap-4`} style={{ height: "65vh" }}>

        {/* Local */}
        <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          {localStream && !effectiveAudioOnly && (
            <LocalVideo stream={localStream} hidden={shouldShowLocalPlaceholder} />
          )}

          {shouldShowLocalPlaceholder && (
            <div className="absolute inset-0 flex flex-col items-center justify-center h-full text-slate-400 gap-3 bg-slate-900">
              <CallerWaitingAvatar active={showCallerCountdown} initial={localInitial} />
              <p className="text-sm">
                {showCallerCountdown
                  ? "Đang chờ người tham gia..."
                  : isVideoOff
                    ? "Camera đang tắt"
                    : localStream
                      ? "Có âm thanh"
                      : "Đang khởi tạo..."}
              </p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded-lg text-xs text-white font-medium">
            Bạn {isMuted && "(Tắt mic)"}{isVideoOff && " (Tắt video)"}
          </div>
        </div>

        {/* Chỉ render remote khi người đó thực sự tham gia cuộc gọi. */}
        {visibleRemoteStreams.map(({ userId, stream, version }) => (
          <RemoteVideo
            key={userId}
            userId={userId}
            stream={stream || null}
            streamVersion={version || 0}
            label={getMemberName(userId)}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="mt-6 md:mt-8 flex items-center gap-5 md:gap-6">
        <button onClick={toggleMic} title={isMuted ? "Bật mic" : "Tắt mic"}
          className={`p-4 rounded-full text-white transition-all active:scale-90 shadow-lg ${isMuted ? "bg-slate-600 hover:bg-slate-500" : "bg-slate-700 hover:bg-slate-600"}`}>
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button onClick={handleEndCall} title="Kết thúc"
          className="p-5 md:p-6 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg shadow-red-600/30 transition-all active:scale-90">
          <PhoneOff size={28} />
        </button>

        <button onClick={toggleVideo} title={isCameraButtonOff ? "Bật camera" : "Tắt camera"} disabled={!localStream}
          className={`p-4 rounded-full text-white transition-all active:scale-90 shadow-lg ${!localStream ? "opacity-30 cursor-not-allowed bg-slate-800" : isCameraButtonOff ? "bg-slate-600 hover:bg-slate-500" : "bg-slate-700 hover:bg-slate-600"}`}>
          {isCameraButtonOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
      </div>
    </div>
  );
}
