// frontend/src/components/Bubble.jsx
import React from "react";

const IMAGE_URL_PATTERN = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s]*)?)/i;

function resolveImageFromText(text) {
  const input = String(text || "").trim();
  if (!input) return null;
  const m = input.match(IMAGE_URL_PATTERN);
  return m ? m[1] : null;
}

function Bubble({
  text,
  isMine,
  media,
  replyTo,
  createdAt,
  reactions = []
}) {
  const imageUrlFromText = !media ? resolveImageFromText(text) : null;
  const onlyImageMessage = Boolean(
    (media?.type === "image" && !String(text || "").trim()) ||
      (imageUrlFromText && String(text || "").trim() === imageUrlFromText)
  );
  const imageSrc = media?.type === "image" && media?.url ? media.url : imageUrlFromText;
  const hasReply = Boolean(replyTo && (replyTo.text || replyTo.media));

  return (
    <div className="relative inline-block">
      <div
        className={`rounded-[15px] px-4 py-3 text-sm leading-relaxed ${
          onlyImageMessage
            ? "bg-transparent p-0"
            : isMine
            ? "bg-[#0084ff] text-white"
            : "bg-white text-gray-900 border border-gray-200"
        }`}
        style={{ maxWidth: "280px" }}
      >
        {hasReply && !onlyImageMessage && (
          <div
            className={`mb-2 rounded-lg border px-2 py-1 text-[11px] ${
              isMine
                ? "border-[#0066cc] bg-[#1e5ab8] text-white"
                : "border-gray-300 bg-gray-50 text-gray-700"
            }`}
          >
            <div className="font-semibold">{replyTo.senderName || "Tin nhắn trả lời"}</div>
            {replyTo.unsentForAll ? (
              <div className="opacity-75 italic">Tin nhắn đã thu hồi</div>
            ) : replyTo.text ? (
              <div className="line-clamp-2 opacity-90">{replyTo.text}</div>
            ) : replyTo.media ? (
              <div className="opacity-90">[Tệp đính kèm]</div>
            ) : null}
          </div>
        )}

        {imageSrc && (
          <img
            src={imageSrc}
            alt="chat-image"
            className={`rounded-[12px] object-cover ${onlyImageMessage ? "" : "mb-2"}`}
            style={{ maxWidth: "280px", maxHeight: "320px" }}
          />
        )}

        {media?.type === "video" && media?.url && (
          <video
            src={media.url}
            controls
            className={`rounded-[12px] ${onlyImageMessage ? "" : "mb-2"}`}
            style={{ maxWidth: "280px", maxHeight: "320px" }}
          />
        )}

        {!onlyImageMessage && <div className="whitespace-pre-wrap break-words">{text}</div>}

        {createdAt && (
          <div
            className={`mt-1 text-[10px] ${
              isMine ? "text-blue-100" : "text-gray-500"
            }`}
          >
            {new Date(createdAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </div>
        )}
      </div>

      {reactions.length > 0 && (
        <div className="absolute -bottom-3 right-0 bg-white rounded-full px-2 py-1 flex gap-0.5 shadow-lg border border-gray-200 text-[10px]">
          {reactions.map((emoji, idx) => (
            <span key={idx}>{emoji}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default Bubble;