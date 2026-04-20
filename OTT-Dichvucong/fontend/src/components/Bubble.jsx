import React from "react";

function Bubble({ from, text, label, isMine, media }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isMine
            ? "bg-[#003366] text-white rounded-br-md"
            : from === "assistant"
            ? "bg-emerald-50 text-slate-800 ring-1 ring-emerald-100 rounded-bl-md"
            : "bg-slate-100 text-slate-900 ring-1 ring-slate-200 rounded-bl-md"
        }`}
      >
        {label && (
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">
            {label}
          </div>
        )}
        {media?.type === "image" && media?.url && (
          <img src={media.url} alt={media.name || "image"} className="mb-2 max-w-[220px] rounded-lg" />
        )}
        {media?.type === "video" && media?.url && (
          <video src={media.url} controls className="mb-2 max-w-[220px] rounded-lg" />
        )}
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}

export default Bubble;