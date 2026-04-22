// frontend/src/components/Bubble.jsx
import React, { useEffect } from "react";
import { Download, File, FileText, Phone, PhoneMissed } from "lucide-react";

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

function getExtensionFromUrl(url) {
  const raw = String(url || "").split("?")[0].split("#")[0];
  const ext = raw.split(".").pop();
  return String(ext || "").toLowerCase();
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "Không rõ dung lượng";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Bubble({
  text,
  isMine,
  media,
  fileUrl: messageFileUrl,
  fileName: messageFileName,
  type: messageTypeLegacy,
  messageType,
  callLog,
  replyTo,
  createdAt,
  reactions = [],
  onMediaRendered,
}) {
  const imageUrlFromText = !media ? resolveImageFromText(text) : null;
  const onlyImageMessage = Boolean(
    (media?.type === "image" && !String(text || "").trim()) ||
      (imageUrlFromText && String(text || "").trim() === imageUrlFromText)
  );
  const imageSrcRaw = media?.type === "image" && media?.url ? media.url : imageUrlFromText;
  const imageSrc = normalizeMediaUrl(imageSrcRaw);
  const hasReply = Boolean(replyTo && (replyTo.text || replyTo.media));
  const isCallLog = messageType === "call_log";
  const mediaUrl = normalizeMediaUrl(media?.url || media?.fileUrl || messageFileUrl);
  const mediaExt = getExtensionFromUrl(mediaUrl || media?.name || "");
  const isDocumentType =
    media?.type === "file" ||
    media?.type === "document" ||
    messageTypeLegacy === "file" ||
    ["pdf", "doc", "docx"].includes(mediaExt);
  const fileMedia = isDocumentType && (mediaUrl || media?.name || messageFileName) ? (media || {}) : null;
  const fileUrl = normalizeMediaUrl(fileMedia?.url || fileMedia?.fileUrl || messageFileUrl);
  const fileName = fileMedia?.name || messageFileName || (fileUrl ? fileUrl.split("/").pop() : "Tệp đính kèm");
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const resolvedExt = ext || mediaExt;
  const fileIcon = FILE_ICON_MAP[resolvedExt] || null;
  const isPdf = resolvedExt === "pdf";
  const fileSize = formatFileSize(fileMedia?.size || fileMedia?.fileSize);
  const hasTextContent = Boolean(String(text || "").trim());

  useEffect(() => {
    if (!fileMedia || !onMediaRendered) return;
    onMediaRendered();
  }, [fileMedia, onMediaRendered]);

  const callDurationLabel = callLog?.durationSec
    ? `${Math.floor(callLog.durationSec / 60)}:${String(callLog.durationSec % 60).padStart(2, "0")}`
    : "";
  const callDescription =
    callLog?.status === "missed"
      ? "Cuộc gọi nhỡ"
      : callDurationLabel
        ? `Cuộc gọi video đã kết thúc • ${callDurationLabel}`
        : "Cuộc gọi video đã kết thúc";

  if (isCallLog) {
    return (
      <div className="flex w-full justify-center py-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
          {callLog?.status === "missed" ? (
            <PhoneMissed size={14} className="text-red-500" />
          ) : (
            <Phone size={14} className="text-slate-500" />
          )}
          <span>{callDescription}</span>
        </div>
      </div>
    );
  }

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
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${isPdf ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-700"}`}>
                {isPdf ? <FileText size={16} /> : <File size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">
                  {fileIcon ? `${fileIcon} ` : ""}{fileName}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{fileSize}</div>
              </div>
            </div>
            {fileUrl ? (
              <div className="mt-2 flex items-center gap-3">
                <a href={fileUrl} download={fileName} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
                  <Download size={12} />
                  Tải xuống
                </a>
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-amber-600">Chưa có liên kết tải</div>
            )}
          </div>
        )}

        {!onlyImageMessage && hasTextContent && <div className="whitespace-pre-wrap break-words">{text}</div>}

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