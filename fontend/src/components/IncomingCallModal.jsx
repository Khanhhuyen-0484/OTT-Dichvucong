import React from "react";
import { Phone, PhoneOff, Users, Video } from "lucide-react";

export default function IncomingCallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  const isGroup = Boolean(call.isGroupCall);
  const callerNames = call.callerNames || (call.callerName ? [call.callerName] : []);
  const displayName = isGroup
    ? call.groupName || "Cuộc gọi nhóm"
    : callerNames[0] || "Người dùng";
  const subtitle = isGroup
    ? callerNames.length > 0
      ? `${callerNames.join(", ")} đang gọi`
      : "Nhiều người đang gọi"
    : null;
  const initial = displayName[0]?.toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-[2.5rem] border border-white/10 bg-slate-900 p-8 text-center shadow-2xl animate-in zoom-in duration-300">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-20" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full border-4 border-slate-800 bg-linear-to-br from-blue-500 to-blue-700 shadow-lg">
            {isGroup ? (
              <Users size={40} className="text-white" />
            ) : (
              <span className="text-3xl font-bold text-white">{initial}</span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 rounded-full border-4 border-slate-900 bg-emerald-500 p-2">
            <Video size={16} className="text-white" />
          </div>
        </div>

        <h3 className="mb-1 text-2xl font-bold tracking-tight text-white">{displayName}</h3>
        {subtitle ? (
          <p className="mx-auto mb-2 max-w-[240px] text-xs leading-relaxed text-slate-400">{subtitle}</p>
        ) : null}
        <p className="mb-10 animate-pulse text-sm font-medium uppercase tracking-widest text-blue-400">
          {isGroup ? "Cuộc gọi nhóm đến..." : "Cuộc gọi video đến..."}
        </p>

        <div className="flex justify-center gap-6">
          <button type="button" onClick={() => onReject(call)} className="group flex flex-col items-center gap-2">
            <div className="rounded-full bg-red-500/10 p-5 text-red-500 shadow-lg shadow-red-500/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-red-500 group-hover:text-white">
              <PhoneOff size={28} />
            </div>
            <span className="text-xs font-medium text-slate-400">Từ chối</span>
          </button>

          <button type="button" onClick={() => onAccept(call)} className="group flex flex-col items-center gap-2">
            <div className="rounded-full bg-emerald-500/10 p-5 text-emerald-500 shadow-lg shadow-emerald-500/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white">
              <Phone size={28} />
            </div>
            <span className="text-xs font-medium text-slate-400">Trả lời</span>
          </button>
        </div>
      </div>
    </div>
  );
}
