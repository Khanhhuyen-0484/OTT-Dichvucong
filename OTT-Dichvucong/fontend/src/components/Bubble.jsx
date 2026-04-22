// frontend/src/components/Bubble.jsx
import React from "react";

const IMAGE_URL_PATTERN = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s]*)?)/i;
const FILE_ICON_MAP = {
  pdf: "📕",
  doc: "📘",
  docx: "📘",
};

function resolveImageFromText(text) {
  const input = String(text || "").trim();
  if (!input) return null;
  const m = input.match(IMAGE_URL_PATTERN);
  return m ? m[1] : null;
}

function normalizeMediaUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  // Avoid trying to load malformed host-like strings (causes ERR_NAME_NOT_RESOLVED).
  if (!raw.includes("/") && !raw.includes(".")) return "";
  return "";
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
  const imageSrcRaw = media?.type === "image" && media?.url ? media.url : imageUrlFromText;
  const imageSrc = normalizeMediaUrl(imageSrcRaw);
  const hasReply = Boolean(replyTo && (replyTo.text || replyTo.media));
  const fileMedia =
    media?.type === "file" && media?.url
      ? media
      : null;
  const fileUrl = normalizeMediaUrl(fileMedia?.url);
  const fileName = fileMedia?.name || (fileMedia?.url ? fileMedia.url.split("/").pop() : "Tệp đính kèm");
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const fileIcon = FILE_ICON_MAP[ext] || "📄";

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

        {fileMedia && (
          <div className={`rounded-xl border px-3 py-2 ${isMine ? "border-blue-300 bg-blue-50/60 text-slate-800" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
            <div className="text-xs font-semibold">{fileIcon} {fileName}</div>
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11px] font-medium text-blue-600 hover:underline"
              >
                Tải xuống
              </a>
            ) : (
              <div className="mt-1 text-[11px] text-amber-600">Chưa có liên kết tải</div>
            )}
          </div>
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