
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle, Users } from "lucide-react";
import { connectSocket } from "../lib/socket.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

const MISSED_CALL_TIMEOUT_SECONDS = 30;

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

// RemoteVideo: 1 khung hình cho 1 peer.
function RemoteVideo({ stream, label }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [trackState, setTrackState] = useState({
    hasAudioTrack: false,
    hasVideoTrack: false,
    hasLiveVideo: false,
  });

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    const audioEl = audioRef.current;

    const attachedTracks = new Set();
    let playTimer = null;
    let videoTrackKey = "";
    let audioTrackKey = "";
    const videoTracks = () => stream?.getVideoTracks?.() || [];
    const audioTracks = () => stream?.getAudioTracks?.() || [];
    const attachMediaElements = () => {
      const videos = videoTracks();
      const audios = audioTracks();
      const nextVideoKey = videos.map((track) => track.id).join("|");
      const nextAudioKey = audios.map((track) => track.id).join("|");
      if (nextVideoKey !== videoTrackKey) {
        videoTrackKey = nextVideoKey;
        el.srcObject = videos.length ? new MediaStream(videos) : null;
      }
      if (audioEl && nextAudioKey !== audioTrackKey) {
        audioTrackKey = nextAudioKey;
        audioEl.srcObject = audios.length ? new MediaStream(audios) : null;
      }
    };
    const syncTrackState = () => {
      const videos = videoTracks();
      const audios = audioTracks();
      attachMediaElements();
      setTrackState({
        hasAudioTrack: audios.some((track) => track.readyState === "live"),
        hasVideoTrack: videos.some((track) => track.readyState === "live"),
        hasLiveVideo: videos.some((track) => track.readyState === "live" && !track.muted),
      });
    };
    const playRemote = () => {
      if (!stream) return;
      if (playTimer) window.clearTimeout(playTimer);
      playTimer = window.setTimeout(() => {
        el.play().catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn("[VideoCall] Không autoplay được remote video:", err?.message || err);
          }
        });
        audioEl?.play?.().catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn("[VideoCall] Không autoplay được remote audio:", err?.message || err);
          }
        });
      }, 50);
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
      if (el.readyState >= 2) playRemote();
      el.onloadedmetadata = playRemote;
      stream.getTracks?.().forEach(attachTrackHandlers);
      stream.addEventListener?.("addtrack", handleTrackChange);
      stream.addEventListener?.("removetrack", handleTrackChange);
    }

    return () => {
      if (playTimer) window.clearTimeout(playTimer);
      el.onloadedmetadata = null;
      if (audioEl) audioEl.onloadedmetadata = null;
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
  }, [stream]);

  const waitingText = trackState.hasVideoTrack
    ? "Đã nhận video, đang mở khung hình..."
    : trackState.hasAudioTrack
      ? "Đã nhận âm thanh, chưa nhận video..."
      : "Đang chờ hình ảnh...";

  return (
    <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <audio ref={audioRef} autoPlay playsInline />
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
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    if (el.srcObject !== stream) {
      el.srcObject = stream || null;
    }
    return () => {
      if (el.srcObject === stream) el.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`w-full h-full object-cover scale-x-[-1] transform-gpu ${hidden ? "opacity-0" : "opacity-100"}`}
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
  currentUserName,
  activeRoom,
  onClose,
}) {
  const targets = targetUserIds?.length ? targetUserIds : targetUserId ? [targetUserId] : [];
  const isGroup = targets.length > 1;

  const [status,        setStatus]        = useState("connecting");
  const [localStream,   setLocalStream]   = useState(null);
  const [audioOnly,     setAudioOnly]     = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isVideoOff,    setIsVideoOff]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState(null);
  const [remoteStreams, setRemoteStreams]  = useState({});
  const [joinedPeerIds, setJoinedPeerIds] = useState([]);

  const socketRef       = useRef(connectSocket());
  const localStreamRef  = useRef(null);
  const pcsRef          = useRef({});
  const queuesRef       = useRef({});
  const remoteStreamsRef = useRef({});
  const statsTimersRef  = useRef({});
  const renegotiatedVideoRef = useRef({});
  const activeRef       = useRef(true);
  const callStartedAtRef = useRef(0);
  const joinedPeerIdsRef = useRef([]);
  const missedCallTimerRef = useRef(null);

  const onCloseRef      = useRef(onClose);
  const targetsRef      = useRef(targets);
  const callerOffersRef = useRef(callerOffers);
  const callerOfferRef  = useRef(callerOffer);
  const isGroupRef      = useRef(isGroup);
  const activeRoomRef   = useRef(activeRoom);

  useEffect(() => { onCloseRef.current      = onClose;      }, [onClose]);
  useEffect(() => { targetsRef.current      = targets;      }, [targets]);
  useEffect(() => { callerOffersRef.current = callerOffers; }, [callerOffers]);
  useEffect(() => { callerOfferRef.current  = callerOffer;  }, [callerOffer]);
  useEffect(() => { isGroupRef.current      = isGroup;      }, [isGroup]);
  useEffect(() => { activeRoomRef.current   = activeRoom;   }, [activeRoom]);
  useEffect(() => { joinedPeerIdsRef.current = joinedPeerIds; }, [joinedPeerIds]);

  // Helpers.
  const destroyPeer = useCallback((userId) => {
    const pc = pcsRef.current[userId];
    if (!pc) return;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
    if (statsTimersRef.current[userId]) {
      window.clearInterval(statsTimersRef.current[userId]);
      delete statsTimersRef.current[userId];
    }
    delete pcsRef.current[userId];
    delete queuesRef.current[userId];
    delete remoteStreamsRef.current[userId];
    delete renegotiatedVideoRef.current[userId];
    setRemoteStreams((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    setJoinedPeerIds((prev) => prev.filter((id) => id !== userId));
    debugVideoCall("[VideoCall] destroyPeer:", userId);
  }, []);

  const markPeerJoined = useCallback((userId) => {
    if (!userId) return;
    if (missedCallTimerRef.current) {
      window.clearTimeout(missedCallTimerRef.current);
      missedCallTimerRef.current = null;
    }
    setJoinedPeerIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  }, []);

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
  }, [destroyPeer]);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    destroyAll();
    onCloseRef.current();
  }, [destroyAll]);

  const clearMissedCallTimer = useCallback(() => {
    if (!missedCallTimerRef.current) return;
    window.clearTimeout(missedCallTimerRef.current);
    missedCallTimerRef.current = null;
  }, []);

  const emitMissedCall = useCallback(() => {
    const targetIds = targetsRef.current.filter(Boolean);
    socketRef.current.emit("call-missed", {
      toUserIds: targetIds,
      roomId,
      callerName: currentUserName,
    });
  }, [currentUserName, roomId]);

  const processQueue = useCallback(async (userId) => {
    const pc = pcsRef.current[userId];
    if (!pc?.remoteDescription) return;
    const q = queuesRef.current[userId] || [];
    while (q.length) {
      const c = q.shift();
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { console.warn("[VideoCall] Queue ICE:", e); }
    }
  }, []);

  const renegotiateVideoReceive = useCallback(async (userId, pc) => {
    if (!activeRef.current || !pc || renegotiatedVideoRef.current[userId]) return;
    if (pc.signalingState !== "stable") return;

    const hasVideoReceiver = pc.getReceivers?.().some((receiver) => receiver.track?.kind === "video");
    if (!hasVideoReceiver) return;

    renegotiatedVideoRef.current[userId] = true;
    try {
      debugVideoCall("[VideoCall] remote video chưa có frame, renegotiate video receive:", userId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current.emit("group-call-offer", {
        toUserId: userId,
        offer,
        roomId,
        callerName: currentUserName,
      });
    } catch (err) {
      renegotiatedVideoRef.current[userId] = false;
      console.error("[VideoCall] renegotiate video lỗi:", err);
    }
  }, [currentUserName, roomId]);

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

  const attachLocalTracks = useCallback(async (pc, userId, stream, { ensureVideoReceiver = false } = {}) => {
    if (!pc || !stream) return;
    for (const track of stream.getTracks()) {
      const senders = pc.getSenders();
      const alreadyAdded = senders.some((sender) => sender.track?.id === track.id);
      if (alreadyAdded) continue;

      const transceiver = pc.getTransceivers?.()
        ?.find((item) => {
          const kind = item.receiver?.track?.kind || item.sender?.track?.kind;
          return kind === track.kind && !item.sender?.track && item.mid !== null;
        });

      if (transceiver) {
        await transceiver.sender.replaceTrack(track);
        transceiver.direction = "sendrecv";
      } else {
        pc.addTrack(track, stream);
      }
    }

    if (ensureVideoReceiver && !stream.getVideoTracks().length) {
      const videoTransceiver = pc.getTransceivers?.()
        ?.find((transceiver) => transceiver.receiver?.track?.kind === "video" || transceiver.sender?.track?.kind === "video");
      if (videoTransceiver) {
        try {
          if (!videoTransceiver.sender?.track && videoTransceiver.direction !== "recvonly") {
            videoTransceiver.direction = "recvonly";
          }
        } catch (err) {
          console.warn("[VideoCall] Không set được video transceiver recvonly:", err?.message || err);
        }
      } else {
        pc.addTransceiver("video", { direction: "recvonly" });
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

  const createPeer = useCallback((userId) => {
    if (pcsRef.current[userId]) return pcsRef.current[userId];
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[userId] = pc;
    queuesRef.current[userId] = [];

    pc.ontrack = (e) => {
      if (!activeRef.current) return;
      markPeerJoined(userId);
      const remoteStream = remoteStreamsRef.current[userId] || new MediaStream();
      remoteStreamsRef.current[userId] = remoteStream;
      if (!remoteStream.getTracks().some((track) => track.id === e.track.id)) {
        remoteStream.addTrack(e.track);
      }
      const publishRemoteStream = () => {
        setRemoteStreams((prev) => ({
          ...prev,
          [userId]: new MediaStream(remoteStream.getTracks()),
        }));
      };
      debugVideoCall("[VideoCall] remote-track", userId, e.track.kind, {
        muted: e.track.muted,
        readyState: e.track.readyState,
        tracks: remoteStream.getTracks().map((track) => `${track.kind}:${track.readyState}`),
      });
      e.track.addEventListener?.("unmute", () => {
        debugVideoCall("[VideoCall] remote-track-unmute", userId, e.track.kind);
        publishRemoteStream();
      });
      e.track.addEventListener?.("ended", publishRemoteStream);
      publishRemoteStream();
      if (e.track.kind === "video") {
        startStatsMonitor(userId, pc);
        window.setTimeout(() => {
          if (!activeRef.current || !pcsRef.current[userId]) return;
          if (e.track.readyState === "live" && e.track.muted) {
            renegotiateVideoReceive(userId, pc);
          }
        }, 2500);
      }
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate || !activeRef.current) return;
      socketRef.current.emit("ice-candidate", { toUserId: userId, roomId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (!activeRef.current) return;
      const state = pc.connectionState;
      debugVideoCall("[VideoCall] peer-state", userId, state);
      if (state === "connected") {
        setStatus("connected");
        setErrorMsg(null);
        startStatsMonitor(userId, pc);
      }
      if (state === "connected" && !callStartedAtRef.current) {
        callStartedAtRef.current = Date.now();
      }
      if (state === "failed" || state === "closed") {
        // Chỉ xóa peer này, không đóng toàn bộ cuộc gọi.
        setTimeout(() => { if (activeRef.current) destroyPeer(userId); }, 1500);
      }
      if (state === "disconnected") {
        setTimeout(() => {
          if (activeRef.current && pcsRef.current[userId]?.connectionState === "disconnected")
            destroyPeer(userId);
        }, 5000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!activeRef.current) return;
      debugVideoCall("[VideoCall] ice-state", userId, pc.iceConnectionState);
      if (["connected", "completed"].includes(pc.iceConnectionState)) {
        startStatsMonitor(userId, pc);
      }
    };

    return pc;
  }, [roomId, destroyPeer, markPeerJoined, renegotiateVideoReceive, startStatsMonitor]);

  // Main effect.
  useEffect(() => {
    activeRef.current = true;
    const socket = socketRef.current;

    const handleAccepted = async ({ fromUserId, answer }) => {
      if (!activeRef.current) return;
      const pc = pcsRef.current[fromUserId];
      if (!pc) return;
      if (pc.signalingState !== "have-local-offer") {
        debugVideoCall("[VideoCall] Bỏ qua answer trễ/trùng", {
          fromUserId,
          signalingState: pc.signalingState,
        });
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await processQueue(fromUserId);
      } catch (e) { console.error("[VideoCall] setRemoteDesc:", e); }
    };

    const handleIceCandidate = async ({ fromUserId, candidate }) => {
      if (!activeRef.current || !candidate) return;
      const pc = pcsRef.current[fromUserId];
      if (!pc) return;
      if (pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn("[VideoCall] ICE:", e); }
      } else {
        (queuesRef.current[fromUserId] = queuesRef.current[fromUserId] || []).push(candidate);
      }
    };

    const handleGroupOffer = async ({ fromUserId, offer }) => {
      if (!activeRef.current || !localStreamRef.current) return;
      debugVideoCall("[VideoCall] group-call-offer", fromUserId);
      const pc = createPeer(fromUserId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await attachLocalTracks(pc, fromUserId, localStreamRef.current, { ensureVideoReceiver: true });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-accepted", { toUserId: fromUserId, answer, roomId });
        await processQueue(fromUserId);
      } catch (e) { console.error("[VideoCall] group-call-offer:", e); }
    };

    // call-ended nhận fromUserId để chỉ xóa peer đó trong nhóm.
    const handleCallEnded = ({ fromUserId } = {}) => {
      if (!activeRef.current) return;
      debugVideoCall("[VideoCall] call-ended", fromUserId);
      if (fromUserId && isGroupRef.current) {
        destroyPeer(fromUserId);
        // Đóng hẳn nếu không còn ai.
        if (Object.keys(pcsRef.current).length === 0) cleanup();
      } else {
        cleanup();
      }
    };

    // call-rejected trong nhóm chỉ hiện toast 3s, xóa peer, không đóng cuộc gọi.
    const handleCallRejected = ({ fromUserId } = {}) => {
      if (!activeRef.current) return;
      debugVideoCall("[VideoCall] call-rejected from", fromUserId);
      if (fromUserId && isGroupRef.current) {
        const name = activeRoomRef.current?.members?.find((m) => m.id === fromUserId)?.fullName || "Thành viên";
        setErrorMsg(`${name} từ chối cuộc gọi`);
        setTimeout(() => setErrorMsg(null), 3000);
        destroyPeer(fromUserId);
      } else {
        setErrorMsg("Cuộc gọi bị từ chối.");
        setTimeout(() => { if (activeRef.current) cleanup(); }, 2000);
      }
    };

    const handleCallUnavailable = ({ reason, targetUserId, isGroupCall } = {}) => {
      if (!activeRef.current) return;
      debugVideoCall("[VideoCall] call-unavailable", { reason, targetUserId, isGroupCall });
      if ((isGroupCall || isGroupRef.current) && targetUserId) {
        destroyPeer(targetUserId);
        return;
      }
      if (reason === "offline") {
        setErrorMsg("Người nhận hiện không trực tuyến.");
      } else {
        setErrorMsg("Không thể thực hiện cuộc gọi lúc này.");
      }
      setTimeout(() => { if (activeRef.current) cleanup(); }, 1800);
    };

    socket.on("call-accepted",    handleAccepted);
    socket.on("ice-candidate",    handleIceCandidate);
    socket.on("call-ended",       handleCallEnded);
    socket.on("call-rejected",    handleCallRejected);
    socket.on("call-unavailable", handleCallUnavailable);
    socket.on("group-call-offer", handleGroupOffer);

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
        if (!isCallee) {
          const permissions = await checkMediaPermissions();
            if (permissions.camera === "denied" || permissions.microphone === "denied") {
            setErrorMsg("Chưa có quyền Camera/Microphone. Vui lòng cấp quyền rồi thử lại.");
            return;
          }
        }

        const stream = await getMediaStream();
        if (!activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

        const hasVideo = stream.getVideoTracks().length > 0;
        if (!hasVideo) setAudioOnly(true);
        localStreamRef.current = stream;
        setLocalStream(stream);

        const currentTargets  = targetsRef.current;
        const currentIsGroup  = isGroupRef.current;

        if (isCallee) {
          const singleOffer = callerOfferRef.current;
          const offersMap   = callerOffersRef.current || {};

          if (!currentIsGroup && singleOffer && currentTargets.length === 1) {
            // Gọi đơn callee.
            const uid = currentTargets[0];
            const pc  = createPeer(uid);
            await pc.setRemoteDescription(new RTCSessionDescription(singleOffer));
            await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("call-accepted", { toUserId: uid, answer, roomId });
            await processQueue(uid);
          } else {
            // Gọi nhóm callee: xử lý cả 2 chiều.
            // - Answer cho người đã gửi offer.
            // - Gửi offer đến người trong nhóm chưa gửi offer cho mình.
            const offeredSet = new Set(Object.keys(offersMap));

            for (const [uid, offer] of Object.entries(offersMap)) {
              if (!activeRef.current) break;
              const pc = createPeer(uid);
              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("call-accepted", { toUserId: uid, answer, roomId });
              await processQueue(uid);
            }

            for (const uid of currentTargets) {
              if (!activeRef.current) break;
              if (offeredSet.has(uid)) continue;
              const pc    = createPeer(uid);
              await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit("group-call-offer", {
                toUserId: uid, offer, roomId, callerName: currentUserName,
              });
            }
          }
        } else {
          // Caller: gửi offer đến từng target.
          for (const uid of currentTargets) {
            if (!activeRef.current) break;
            const pc    = createPeer(uid);
            await attachLocalTracks(pc, uid, stream, { ensureVideoReceiver: true });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("call-user", {
              targetUserId: uid,
              roomId,
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

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsVideoOff((p) => !p);
  };

  const handleEndCall = () => {
    if (!isCallee && joinedPeerIdsRef.current.length === 0) {
      emitMissedCall();
      setErrorMsg("Cuộc gọi nhỡ");
      activeRef.current = false;
      destroyAll();
      window.setTimeout(() => onCloseRef.current(), 1200);
      return;
    }

    const durationSec = callStartedAtRef.current
      ? Math.max(0, Math.round((Date.now() - callStartedAtRef.current) / 1000))
      : 0;
    targetsRef.current.forEach((uid) => {
      socketRef.current.emit("end-call", {
        toUserId: uid,
        roomId,
        durationSec,
        fromUserId: socketRef.current.id,
        callerName: currentUserName
      });
    });
    cleanup();
  };

  const visibleRemoteIds = isGroup
    ? targets.filter((uid) => joinedPeerIds.includes(uid) && remoteStreams[uid])
    : targets;
  const total    = 1 + visibleRemoteIds.length;
  const gridCols = total <= 2 ? "md:grid-cols-2" : total <= 4 ? "md:grid-cols-2" : "md:grid-cols-3";
  const getMemberName = (uid) => activeRoom?.members?.find((m) => m.id === uid)?.fullName || "Thành viên";
  const showCallerCountdown = !isCallee && joinedPeerIds.length === 0;
  const shouldShowLocalPlaceholder = !localStream || audioOnly || isVideoOff;
  const localInitial = currentUserName?.[0]?.toUpperCase() || "B";

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

      {audioOnly && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-300 px-4 py-1.5 rounded-full border border-yellow-500/40 text-xs z-10">
          Camera không khả dụng — chỉ dùng âm thanh
        </div>
      )}

      {/* Video grid */}
      <div className={`w-full max-w-5xl grid grid-cols-1 ${gridCols} gap-3 md:gap-4`} style={{ height: "65vh" }}>

        {/* Local */}
        <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          {localStream && !audioOnly && (
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
        {visibleRemoteIds.map((uid) => (
          <RemoteVideo key={uid} stream={remoteStreams[uid] || null} label={getMemberName(uid)} />
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

        <button onClick={toggleVideo} title={isVideoOff ? "Bật camera" : "Tắt camera"} disabled={audioOnly}
          className={`p-4 rounded-full text-white transition-all active:scale-90 shadow-lg ${audioOnly ? "opacity-30 cursor-not-allowed bg-slate-800" : isVideoOff ? "bg-slate-600 hover:bg-slate-500" : "bg-slate-700 hover:bg-slate-600"}`}>
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
      </div>
    </div>
  );
}
