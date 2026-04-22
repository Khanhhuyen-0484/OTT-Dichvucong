// import React, { useCallback, useEffect, useRef, useState } from "react";
// import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle } from "lucide-react";
// import { connectSocket } from "../lib/socket.js";

// // STUN: tìm địa chỉ IP public
// // TURN: relay traffic khi 2 thiết bị không kết nối trực tiếp được (khác mạng, qua ngrok)
// // Thiếu TURN → ICE failed sau ~15s khi dùng ngrok hoặc mạng có symmetric NAT
// const ICE_SERVERS = {
//   iceServers: [
//     { urls: "stun:stun.l.google.com:19302" },
//     { urls: "stun:stun1.l.google.com:19302" },
//     // TURN server công khai của Open Relay (freeturn.net)
//     {
//       urls: "turn:openrelay.metered.ca:80",
//       username: "openrelayproject",
//       credential: "openrelayproject",
//     },
//     {
//       urls: "turn:openrelay.metered.ca:443",
//       username: "openrelayproject",
//       credential: "openrelayproject",
//     },
//     {
//       urls: "turn:openrelay.metered.ca:443?transport=tcp",
//       username: "openrelayproject",
//       credential: "openrelayproject",
//     },
//   ],
//   // Ưu tiên thử TURN ngay nếu STUN thất bại, không chờ hết timeout
//   iceCandidatePoolSize: 10,
// };

// async function getMediaStream() {
//   try {
//     return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//   } catch (err) {
//     if (
//       err.name === "NotReadableError" ||
//       err.name === "NotFoundError" ||
//       err.name === "OverconstrainedError"
//     ) {
//       console.warn("[VideoCall] Camera không khả dụng, thử audio-only:", err.name);
//       return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
//     }
//     throw err;
//   }
// }

// export default function VideoCall({
//   roomId,
//   targetUserId,
//   isCallee = false,
//   callerOffer = null,
//   currentUserName,
//   onClose,
// }) {
//   const [status, setStatus]             = useState("connecting");
//   const [localStream, setLocalStream]   = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [errorMsg, setErrorMsg]         = useState(null);
//   const [isMuted, setIsMuted]           = useState(false);
//   const [isVideoOff, setIsVideoOff]     = useState(false);
//   const [audioOnly, setAudioOnly]       = useState(false);

//   const socketRef       = useRef(null);
//   const pcRef           = useRef(null);
//   const localStreamRef  = useRef(null);
//   const candidatesQueue = useRef([]);

//   // Dùng ref để luôn đọc được giá trị mới nhất trong closure
//   const onCloseRef      = useRef(onClose);
//   const targetUserIdRef = useRef(targetUserId);
//   const callerOfferRef  = useRef(callerOffer);

//   useEffect(() => { onCloseRef.current      = onClose;      }, [onClose]);
//   useEffect(() => { targetUserIdRef.current  = targetUserId; }, [targetUserId]);
//   useEffect(() => { callerOfferRef.current   = callerOffer;  }, [callerOffer]);

//   if (!socketRef.current) {
//     socketRef.current = connectSocket();
//   }

//   // Hàm dọn dẹp WebRTC resources, KHÔNG gọi onClose (để tách biệt)
//   const destroyPeer = useCallback(() => {
//     if (pcRef.current) {
//       pcRef.current.ontrack                 = null;
//       pcRef.current.onicecandidate          = null;
//       pcRef.current.onconnectionstatechange = null;
//       pcRef.current.close();
//       pcRef.current = null;
//     }
//     if (localStreamRef.current) {
//       localStreamRef.current.getTracks().forEach((t) => t.stop());
//       localStreamRef.current = null;
//     }
//     candidatesQueue.current = [];
//   }, []);

//   // Hàm cleanup đầy đủ: dọn WebRTC + đóng UI
//   const cleanup = useCallback(() => {
//     console.log("[VideoCall] --- CLEANING UP ---");
//     destroyPeer();
//     onCloseRef.current();
//   }, [destroyPeer]);

//   useEffect(() => {
//     const socket = socketRef.current;

//     // FIX: Dùng "active" flag thay vì ref boolean để kiểm soát lifecycle.
//     // Mỗi lần useEffect chạy (kể cả sau remount) đều tạo ra một "active" scope
//     // mới hoàn toàn độc lập. Khi cleanup chạy, nó set active=false để các
//     // async callback đang chờ (getUserMedia, createOffer...) biết mà dừng lại,
//     // không ghi vào state/ref của lần mount cũ.
//     // Không dùng useRef vì ref tồn tại xuyên suốt lifetime của component instance,
//     // còn closure variable "active" reset về true mỗi lần effect chạy lại.
//     let active = true;

//     const processQueuedCandidates = async () => {
//       if (!pcRef.current?.remoteDescription) return;
//       while (candidatesQueue.current.length > 0) {
//         const candidate = candidatesQueue.current.shift();
//         try {
//           await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
//           console.log("[VideoCall] 🧊 Queued ICE candidate added");
//         } catch (e) {
//           console.warn("[VideoCall] Queue ICE error:", e);
//         }
//       }
//     };

//     const handleAccepted = async (data) => {
//       console.log("[VideoCall] ✅ call-accepted");
//       if (!active || !pcRef.current) return;
//       try {
//         await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
//         await processQueuedCandidates();
//       } catch (e) {
//         console.error("[VideoCall] ❌ setRemoteDescription:", e);
//       }
//     };

//     const handleIceCandidate = async (data) => {
//       if (!active || !data?.candidate) return;
//       if (pcRef.current?.remoteDescription) {
//         try {
//           await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
//         } catch (e) {
//           console.warn("[VideoCall] ICE error:", e);
//         }
//       } else {
//         candidatesQueue.current.push(data.candidate);
//       }
//     };

//     const handleCallEnded = () => {
//       console.log("[VideoCall] 📵 call-ended");
//       if (!active) return;
//       cleanup();
//     };

//     const handleCallRejected = () => {
//       console.log("[VideoCall] 🚫 call-rejected");
//       if (!active) return;
//       setErrorMsg("Cuộc gọi bị từ chối.");
//       setTimeout(() => { if (active) cleanup(); }, 2000);
//     };

//     socket.on("call-accepted",  handleAccepted);
//     socket.on("ice-candidate",  handleIceCandidate);
//     socket.on("call-ended",     handleCallEnded);
//     socket.on("call-rejected",  handleCallRejected);

//     const init = async () => {
//       try {
//         console.log("[VideoCall] 🎬 Xin quyền media...");
//         const stream = await getMediaStream();

//         // Sau mỗi await, kiểm tra active — StrictMode có thể đã cleanup
//         if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }

//         const hasVideo = stream.getVideoTracks().length > 0;
//         if (!hasVideo) setAudioOnly(true);

//         localStreamRef.current = stream;
//         setLocalStream(stream);

//         const pc = new RTCPeerConnection(ICE_SERVERS);
//         pcRef.current = pc;

//         // QUAN TRỌNG: ontrack phải đăng ký TRƯỚC addTrack và setRemoteDescription.
//         // Nếu đăng ký sau (đặc biệt với callee), track event có thể đã bắn trước
//         // khi listener được gán → miss hoàn toàn → remote video không bao giờ hiện.
//         pc.ontrack = (e) => {
//           console.log("[VideoCall] 🎥 remote track:", e.track.kind, "streams:", e.streams?.length);
//           if (!active) return;
//           if (e.streams?.[0]) {
//             setRemoteStream(e.streams[0]);
//           } else {
//             // Fallback: Safari và một số mobile browser không đính stream vào event
//             const fallback = new MediaStream([e.track]);
//             setRemoteStream(fallback);
//           }
//         };

//         stream.getTracks().forEach((track) => pc.addTrack(track, stream));

//         // Nếu không có camera: khai báo recvonly transceiver để SDP có m=video
//         // → đối phương mới biết gửi video track về, nếu không SDP thiếu m=video
//         // → remote video bị drop dù đối phương có camera
//         if (!hasVideo) {
//           pc.addTransceiver("video", { direction: "recvonly" });
//         }

//         pc.onicecandidate = (e) => {
//           if (e.candidate && active) {
//             socket.emit("ice-candidate", {
//               toUserId:  targetUserIdRef.current,
//               roomId,
//               candidate: e.candidate,
//             });
//           }
//         };

//         pc.onconnectionstatechange = () => {
//           if (!active) return;
//           const state = pc.connectionState;
//           console.log("[VideoCall] 🌐 connectionState:", state);
//           if (state === "connected")    { setStatus("connected"); setErrorMsg(null); }
//           if (state === "failed")       { setErrorMsg("Kết nối thất bại."); setTimeout(() => { if (active) cleanup(); }, 2000); }
//           if (state === "disconnected") { setTimeout(() => { if (active && pcRef.current?.connectionState === "disconnected") cleanup(); }, 5000); }
//         };

//         if (!active) return; // kiểm tra lần cuối trước khi signal

//         const currentCallerOffer = callerOfferRef.current;

//         if (isCallee && currentCallerOffer) {
//           console.log("[VideoCall] 📥 CALLEE: tạo Answer...");
//           await pc.setRemoteDescription(new RTCSessionDescription(currentCallerOffer));
//           if (!active) return;
//           const answer = await pc.createAnswer();
//           await pc.setLocalDescription(answer);
//           socket.emit("call-accepted", { toUserId: targetUserIdRef.current, answer, roomId });
//           await processQueuedCandidates();
//         } else {
//           console.log("[VideoCall] 📤 CALLER: tạo Offer tới", targetUserIdRef.current);
//           const offer = await pc.createOffer();
//           if (!active) return;
//           await pc.setLocalDescription(offer);
//           socket.emit("call-user", {
//             targetUserId: targetUserIdRef.current,
//             roomId,
//             offer,
//             callerName: currentUserName,
//           });
//         }
//       } catch (err) {
//         if (!active) return;
//         console.error("[VideoCall] ❌", err.name, err.message);
//         const messages = {
//           NotAllowedError:  "Trình duyệt chặn camera/micro. Hãy cấp quyền truy cập.",
//           NotFoundError:    "Không tìm thấy thiết bị âm thanh/video.",
//           NotReadableError: "Camera/micro đang được dùng bởi ứng dụng khác.",
//         };
//         setErrorMsg(messages[err.name] ?? `Lỗi: ${err.name} – ${err.message}`);
//       }
//     };

//     init();

//     return () => {
//       // Đây chạy khi: (1) StrictMode unmount giả, (2) user đóng call, (3) remount
//       // Trong mọi trường hợp: đánh dấu scope này đã chết và dọn dẹp resources
//       active = false;
//       socket.off("call-accepted",  handleAccepted);
//       socket.off("ice-candidate",  handleIceCandidate);
//       socket.off("call-ended",     handleCallEnded);
//       socket.off("call-rejected",  handleCallRejected);
//       destroyPeer();
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []); // deps rỗng: mỗi mount instance chạy 1 lần, dùng closure "active" để guard

//   const toggleMic = () => {
//     if (!localStreamRef.current) return;
//     localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
//     setIsMuted((p) => !p);
//   };

//   const toggleVideo = () => {
//     if (!localStreamRef.current) return;
//     localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
//     setIsVideoOff((p) => !p);
//   };

//   const handleEndCall = () => {
//     socketRef.current.emit("end-call", { toUserId: targetUserIdRef.current, roomId });
//     cleanup();
//   };

//   return (
//     <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 backdrop-blur-xl">
//       {errorMsg && (
//         <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full border border-red-500/50 flex items-center gap-2 z-10 whitespace-nowrap">
//           <AlertCircle size={16} /> {errorMsg}
//         </div>
//       )}

//       {audioOnly && (
//         <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full border border-yellow-500/50 text-xs z-10">
//           📷 Camera không khả dụng — chỉ dùng âm thanh
//         </div>
//       )}

//       <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 h-[70vh]">
//         {/* Local */}
//         <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
//           {localStream && !audioOnly ? (
//             <video
//               autoPlay muted playsInline
//               className="w-full h-full object-cover scale-x-[-1]"
//               ref={(el) => { if (el) el.srcObject = localStream; }}
//             />
//           ) : (
//             <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
//               <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">
//                 🎙️
//               </div>
//               <p className="text-sm">{localStream ? "Chỉ âm thanh" : "Đang khởi tạo..."}</p>
//             </div>
//           )}
//           <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg text-xs text-white">
//             Bạn {isMuted && "🔇"}{isVideoOff && " 📷✕"}
//           </div>
//         </div>

//         {/* Remote */}
//         <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
//           {remoteStream ? (
//             <video
//               autoPlay playsInline
//               className="w-full h-full object-cover"
//               ref={(el) => { if (el) el.srcObject = remoteStream; }}
//             />
//           ) : (
//             <div className="flex flex-col items-center justify-center h-full text-slate-500">
//               <div className="w-12 h-12 rounded-full bg-slate-800 animate-bounce mb-2" />
//               <p className="text-sm italic">
//                 {status === "connected" ? "Đang nhận hình ảnh..." : "Đang chờ đối phương..."}
//               </p>
//             </div>
//           )}
//           <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg text-xs text-white">
//             Đối phương
//           </div>
//         </div>
//       </div>

//       <div className="mt-10 flex items-center gap-6">
//         <button
//           onClick={toggleMic}
//           title={isMuted ? "Bật mic" : "Tắt mic"}
//           className={`p-4 rounded-full text-white transition-all active:scale-90 shadow-lg
//             ${isMuted ? "bg-slate-600 hover:bg-slate-500" : "bg-slate-700 hover:bg-slate-600"}`}
//         >
//           {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
//         </button>

//         <button
//           onClick={handleEndCall}
//           title="Kết thúc cuộc gọi"
//           className="p-6 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg shadow-red-600/30 transition-all active:scale-90"
//         >
//           <PhoneOff size={32} />
//         </button>

//         <button
//           onClick={toggleVideo}
//           title={isVideoOff ? "Bật camera" : "Tắt camera"}
//           disabled={audioOnly}
//           className={`p-4 rounded-full text-white transition-all active:scale-90 shadow-lg
//             ${audioOnly
//               ? "opacity-30 cursor-not-allowed bg-slate-800"
//               : isVideoOff
//                 ? "bg-slate-600 hover:bg-slate-500"
//                 : "bg-slate-700 hover:bg-slate-600"}`}
//         >
//           {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
//         </button>
//       </div>
//     </div>
//   );
// }


import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle, Users } from "lucide-react";
import { connectSocket } from "../lib/socket.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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

async function getMediaStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    if (["NotReadableError", "NotFoundError", "OverconstrainedError"].includes(err.name)) {
      console.warn("[VideoCall] Camera không khả dụng, thử audio-only:", err.name);
      return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    }
    throw err;
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

// ─── RemoteVideo: 1 khung hình cho 1 peer ────────────────────────────────────
function RemoteVideo({ stream, label }) {
  return (
    <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {stream ? (
        <video
          autoPlay playsInline
          className="w-full h-full object-cover"
          ref={(el) => { if (el) el.srcObject = stream; }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl font-bold text-slate-400">
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

// ─── Main component ───────────────────────────────────────────────────────────
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

  const socketRef       = useRef(connectSocket());
  const localStreamRef  = useRef(null);
  const pcsRef          = useRef({});
  const queuesRef       = useRef({});
  const activeRef       = useRef(true);
  const callStartedAtRef = useRef(0);

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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const destroyPeer = useCallback((userId) => {
    const pc = pcsRef.current[userId];
    if (!pc) return;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
    delete pcsRef.current[userId];
    delete queuesRef.current[userId];
    setRemoteStreams((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    console.log("[VideoCall] 🗑️ destroyPeer:", userId);
  }, []);

  const destroyAll = useCallback(() => {
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

  const createPeer = useCallback((userId, stream) => {
    if (pcsRef.current[userId]) return pcsRef.current[userId];
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[userId] = pc;
    queuesRef.current[userId] = [];

    pc.ontrack = (e) => {
      if (!activeRef.current) return;
      const s = e.streams?.[0] || new MediaStream([e.track]);
      setRemoteStreams((prev) => ({ ...prev, [userId]: s }));
    };

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (!stream.getVideoTracks().length) {
      pc.addTransceiver("video", { direction: "recvonly" });
    }

    pc.onicecandidate = (e) => {
      if (!e.candidate || !activeRef.current) return;
      socketRef.current.emit("ice-candidate", { toUserId: userId, roomId, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      if (!activeRef.current) return;
      const state = pc.connectionState;
      console.log("[VideoCall] 🌐", userId, "→", state);
      if (state === "connected") { setStatus("connected"); setErrorMsg(null); }
      if (state === "connected" && !callStartedAtRef.current) {
        callStartedAtRef.current = Date.now();
      }
      if (state === "failed" || state === "closed") {
        // FIX 1: chỉ xóa peer này, không đóng toàn bộ cuộc gọi
        setTimeout(() => { if (activeRef.current) destroyPeer(userId); }, 1500);
      }
      if (state === "disconnected") {
        setTimeout(() => {
          if (activeRef.current && pcsRef.current[userId]?.connectionState === "disconnected")
            destroyPeer(userId);
        }, 5000);
      }
    };

    return pc;
  }, [roomId, destroyPeer]);

  // ── Main effect ──────────────────────────────────────────────────────────────
  useEffect(() => {
    activeRef.current = true;
    const socket = socketRef.current;

    const handleAccepted = async ({ fromUserId, answer }) => {
      if (!activeRef.current) return;
      const pc = pcsRef.current[fromUserId];
      if (!pc) return;
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
      console.log("[VideoCall] 📥 group-call-offer từ", fromUserId);
      const pc = createPeer(fromUserId, localStreamRef.current);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-accepted", { toUserId: fromUserId, answer, roomId });
        await processQueue(fromUserId);
      } catch (e) { console.error("[VideoCall] group-call-offer:", e); }
    };

    // FIX 2: call-ended nhận fromUserId → chỉ xóa peer đó trong nhóm
    const handleCallEnded = ({ fromUserId } = {}) => {
      if (!activeRef.current) return;
      console.log("[VideoCall] 📵 call-ended from", fromUserId);
      if (fromUserId && isGroupRef.current) {
        destroyPeer(fromUserId);
        // Đóng hẳn nếu không còn ai
        if (Object.keys(pcsRef.current).length === 0) cleanup();
      } else {
        cleanup();
      }
    };

    // FIX 3: call-rejected trong nhóm → chỉ hiện toast 3s, xóa peer, KHÔNG đóng cuộc gọi
    const handleCallRejected = ({ fromUserId } = {}) => {
      if (!activeRef.current) return;
      console.log("[VideoCall] 🚫 call-rejected from", fromUserId);
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

    const handleCallUnavailable = ({ reason } = {}) => {
      if (!activeRef.current) return;
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
            // Gọi đơn callee
            const uid = currentTargets[0];
            const pc  = createPeer(uid, stream);
            await pc.setRemoteDescription(new RTCSessionDescription(singleOffer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("call-accepted", { toUserId: uid, answer, roomId });
            await processQueue(uid);
          } else {
            // Gọi nhóm callee
            // FIX 4: callee phải xử lý CẢ 2 chiều:
            // - Answer cho người đã gửi offer
            // - Gửi offer đến người trong nhóm chưa gửi offer cho mình
            const offeredSet = new Set(Object.keys(offersMap));

            for (const [uid, offer] of Object.entries(offersMap)) {
              if (!activeRef.current) break;
              const pc = createPeer(uid, stream);
              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("call-accepted", { toUserId: uid, answer, roomId });
              await processQueue(uid);
            }

            for (const uid of currentTargets) {
              if (!activeRef.current) break;
              if (offeredSet.has(uid)) continue;
              const pc    = createPeer(uid, stream);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit("group-call-offer", {
                toUserId: uid, offer, roomId, callerName: currentUserName,
              });
            }
          }
        } else {
          // Caller: gửi offer đến từng target
          for (const uid of currentTargets) {
            if (!activeRef.current) break;
            const pc    = createPeer(uid, stream);
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
            console.log("[VideoCall] 📤 offer →", uid);
          }
        }
      } catch (err) {
        if (!activeRef.current) return;
        const msgs = {
          NotAllowedError:  "Trình duyệt chặn camera/micro. Hãy cấp quyền.",
          NotFoundError:    "Không tìm thấy thiết bị âm thanh/video.",
          NotReadableError: "Camera/micro đang dùng bởi ứng dụng khác.",
        };
        setErrorMsg(msgs[err.name] ?? `Lỗi: ${err.name} – ${err.message}`);
      }
    };

    init();

    return () => {
      activeRef.current = false;
      socket.off("call-accepted",    handleAccepted);
      socket.off("ice-candidate",    handleIceCandidate);
      socket.off("call-ended",       handleCallEnded);
      socket.off("call-rejected",    handleCallRejected);
      socket.off("call-unavailable", handleCallUnavailable);
      socket.off("group-call-offer", handleGroupOffer);
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

  const total    = 1 + targets.length;
  const gridCols = total <= 2 ? "md:grid-cols-2" : total <= 4 ? "md:grid-cols-2" : "md:grid-cols-3";
  const getMemberName = (uid) => activeRoom?.members?.find((m) => m.id === uid)?.fullName || "Thành viên";

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6">

      {/* Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-300 text-sm bg-slate-800/70 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
        {isGroup ? <Users size={15} /> : <Video size={15} />}
        <span>
          {isGroup
            ? `Cuộc gọi nhóm · ${activeRoom?.name || "Nhóm"} · ${targets.length + 1} người`
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
        <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-300 px-4 py-1.5 rounded-full border border-yellow-500/40 text-xs z-10">
          📷 Camera không khả dụng — chỉ dùng âm thanh
        </div>
      )}

      {/* Video grid */}
      <div className={`w-full max-w-5xl grid grid-cols-1 ${gridCols} gap-3 md:gap-4`} style={{ height: "65vh" }}>

        {/* Local */}
        <div className="relative bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          {localStream && !audioOnly ? (
            <video autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]"
              ref={(el) => { if (el) el.srcObject = localStream; }} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-3xl font-bold text-white">
                {currentUserName?.[0]?.toUpperCase() || "B"}
              </div>
              <p className="text-sm">{localStream ? "Chỉ âm thanh" : "Đang khởi tạo..."}</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded-lg text-xs text-white font-medium">
            Bạn {isMuted && "🔇"}{isVideoOff && " 📷✕"}
          </div>
        </div>

        {/* Remote slots — luôn render tất cả targets */}
        {targets.map((uid) => (
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