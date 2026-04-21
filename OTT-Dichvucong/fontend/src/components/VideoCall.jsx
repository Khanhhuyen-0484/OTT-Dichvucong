import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle } from "lucide-react";
import { connectSocket } from "../lib/socket.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Nếu có thể, hãy mượn một server TURN ở đây
  ],
};
function VideoTile({ stream, label, muted = false, mirrored = false }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => console.warn(`[Video] Play blocked:`, e));
    }
  }, [stream]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[260px] border border-white/10 shadow-2xl">
      {stream ? (
       <video
  ref={videoRef}
  autoPlay        // Tự động phát ngay khi có data
  playsInline     // CỰC KỲ QUAN TRỌNG: Ngăn iOS tự bật trình phát full màn hình
 muted={muted}  // iOS ưu tiên autoplay cho video tắt tiếng
  controls={false} // Buộc ẩn trình điều khiển mặc định của Safari
  disablePictureInPicture
  // Thêm class pointer-events-none để người dùng không chạm vào hiện menu Safari
  className={`w-full h-full object-cover pointer-events-none ${mirrored ? "scale-x-[-1]" : ""}`}
/>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-900 animate-pulse border border-white/5" />
          <span className="text-slate-600 text-[10px] uppercase tracking-widest">Đang chờ {label}...</span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded border border-white/10 font-medium">
        {label}
      </div>
    </div>
  );
}

export default function VideoCall({ roomId, targetUserId, isCallee = false, callerOffer = null, currentUserName, onClose }) {
  const [status, setStatus] = useState("connecting");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const socket = useRef(connectSocket()).current;
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const candidatesQueue = useRef([]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    onClose();
  }, [onClose]);

  const processQueuedCandidates = async (pc) => {
    while (candidatesQueue.current.length > 0) {
      const candidate = candidatesQueue.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[WebRTC] ICE Queue Error:", e);
      }
    }
  };

  const createPeerConnection = useCallback((stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        setRemoteStream(e.streams[0]);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { toUserId: targetUserId, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setStatus("connected");
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) cleanup();
    };

    pcRef.current = pc;
    return pc;
  }, [socket, targetUserId, cleanup]);

  useEffect(() => {
    let isMounted = true;

    const initCall = async () => {
      try {
        // Cố gắng mở Camera + Mic. Nếu lỗi (NotFoundError), thử chỉ mở Mic.
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (e) {
          console.warn("Không mở được Camera, thử chế độ Audio only...");
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setCamMuted(true);
        }
        
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPeerConnection(stream);

        if (isCallee && callerOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(callerOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call-accepted", { toUserId: targetUserId, answer, roomId });
          await processQueuedCandidates(pc);
        } else {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call-user", { targetUserId, roomId, offer, callerName: currentUserName });
        }
      } catch (err) {
        console.error("[WebRTC] Final Init Error:", err);
        setErrorMsg("Không tìm thấy thiết bị phần cứng.");
      }
    };

    initCall();

    socket.on("call-accepted", async (data) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processQueuedCandidates(pcRef.current);
        } catch (e) { console.error(e); }
      }
    });

    socket.on("ice-candidate", async (data) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      } else {
        candidatesQueue.current.push(data.candidate);
      }
    });

    socket.on("call-ended", cleanup);

    return () => {
      isMounted = false;
      socket.off("call-accepted");
      socket.off("ice-candidate");
      socket.off("call-ended");
    };
  }, [isCallee, callerOffer, roomId, socket, targetUserId, currentUserName, createPeerConnection, cleanup]);

return (
  <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col p-2 md:p-6 backdrop-blur-xl overflow-hidden">
    {/* Header - Thu nhỏ trên mobile */}
    <div className="flex justify-between items-center px-4 py-2 mb-2">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
        <span className="text-white text-[9px] font-bold uppercase tracking-wider">
          {status === "connected" ? "Đang gọi" : "Đang nối máy..."}
        </span>
      </div>
      {errorMsg && <AlertCircle size={14} className="text-red-500" />}
    </div>

    {/* Khu vực Video - Tự động co giãn */}
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6 w-full max-w-6xl mx-auto overflow-hidden min-h-0">
      <div className="relative h-full min-h-0">
        <VideoTile stream={localStream} label="Bạn" muted mirrored />
      </div>
      <div className="relative h-full min-h-0">
        <VideoTile stream={remoteStream} label="Đối phương" />
      </div>
    </div>

    {/* Bộ điều khiển - Cố định ở dưới cùng, không bị tràn */}
    <div className="py-6 flex justify-center items-center gap-6 md:gap-10 mt-auto bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent w-full">
      <button 
        onClick={() => {
          if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) { track.enabled = micMuted; setMicMuted(!micMuted); }
          }
        }} 
        className={`p-4 md:p-5 rounded-full transition-all ${micMuted ? "bg-red-500 text-white" : "bg-slate-800 text-slate-400"}`}
      >
        {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>

      <button 
        onClick={() => { socket.emit("end-call", { toUserId: targetUserId }); cleanup(); }} 
        className="p-5 md:p-6 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex-shrink-0"
      >
        <PhoneOff size={28} />
      </button>

      <button 
        onClick={() => {
          if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0];
            if (track) { track.enabled = camMuted; setCamMuted(!camMuted); }
          }
        }} 
        className={`p-4 md:p-5 rounded-full transition-all ${camMuted ? "bg-red-500 text-white" : "bg-slate-800 text-slate-400"}`}
      >
        {camMuted ? <VideoOff size={20} /> : <Video size={20} />}
      </button>
    </div>
  </div>
);
}