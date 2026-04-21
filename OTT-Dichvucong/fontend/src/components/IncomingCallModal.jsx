import React from "react";
import { Phone, PhoneOff, Video } from "lucide-react";

export default function IncomingCallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center max-w-sm w-full animate-in zoom-in duration-300">
        
        {/* Avatar với hiệu ứng sóng (Bounce) */}
        <div className="relative mx-auto mb-6 w-24 h-24">
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-800">
            <span className="text-white text-3xl font-bold">
              {call.callerName ? call.callerName[0].toUpperCase() : "U"}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-2 rounded-full border-4 border-slate-900">
            <Video size={16} className="text-white" />
          </div>
        </div>

        {/* Thông tin người gọi */}
        <h3 className="text-white text-2xl font-bold mb-2 tracking-tight">
          {call.callerName || "Người dùng"}
        </h3>
        <p className="text-blue-400 text-sm font-medium mb-10 uppercase tracking-widest animate-pulse">
          Cuộc gọi video đến...
        </p>

        {/* Nút điều khiển bo tròn kiểu hiện đại */}
        <div className="flex gap-6 justify-center">
          <button
            onClick={() => onReject(call)}
            className="group flex flex-col items-center gap-2"
          >
            <div className="p-5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all duration-300 transform group-hover:scale-110 shadow-lg shadow-red-500/20">
              <PhoneOff size={28} />
            </div>
            <span className="text-xs text-slate-400 font-medium">Từ chối</span>
          </button>

          <button
            onClick={() => onAccept(call)}
            className="group flex flex-col items-center gap-2"
          >
            <div className="p-5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-full transition-all duration-300 transform group-hover:scale-110 shadow-lg shadow-emerald-500/20">
              <Phone size={28} />
            </div>
            <span className="text-xs text-slate-400 font-medium">Trả lời</span>
          </button>
        </div>
      </div>
    </div>
  );
}