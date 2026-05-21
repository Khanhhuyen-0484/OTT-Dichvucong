// frontend/src/components/Bubble.jsx
import React, { useEffect } from "react";
import { Download, File, FileText, Phone, PhoneMissed } from "lucide-react";
import LocationMessage from "./LocationMessage.jsx";

const IMAGE_URL_PATTERN =
  /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s]*)?)/i;

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
  if (!raw.includes("/") && !raw.includes(".")) return "";
  return "";
}

function getExtensionFromUrl(url) {
  const raw = String(url || "").split("?")[0].split("#")[0];
  return String(raw.split(".").pop() || "").toLowerCase();
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
  location,
  fileUrl: messageFileUrl,
  fileName: messageFileName,
  messageType,
  messageTypeLegacy,
  callLog,
  replyTo,
  createdAt,
  reactions = [],
  pinned,
  isPinned,
  onMediaRendered,
}) {
  // =========================
  // IMAGE
  // =========================
  const imageUrlFromText = !media ? resolveImageFromText(text) : null;

  const onlyImageMessage = Boolean(
    (media?.type === "image" && !String(text || "").trim()) ||
      (imageUrlFromText && String(text || "").trim() === imageUrlFromText)
  );

  const imageSrcRaw =
    media?.type === "image" && media?.url
      ? media.url
      : imageUrlFromText;

  const imageSrc = normalizeMediaUrl(imageSrcRaw);

  // =========================
  // MEDIA
  // =========================
  const mediaUrl = normalizeMediaUrl(
    media?.url || media?.fileUrl || messageFileUrl
  );

  const mediaExt = getExtensionFromUrl(mediaUrl || media?.name || "");

  const isDocumentType =
    media?.type === "file" ||
    media?.type === "document" ||
    messageTypeLegacy === "file" ||
    ["pdf", "doc", "docx"].includes(mediaExt);

  const fileMedia =
    isDocumentType &&
    (mediaUrl || media?.name || messageFileName)
      ? media || {}
      : null;

  const fileUrl = normalizeMediaUrl(
    fileMedia?.url || fileMedia?.fileUrl || messageFileUrl
  );

  const fileName =
    fileMedia?.name ||
    messageFileName ||
    (fileUrl ? fileUrl.split("/").pop() : "Tệp đính kèm");

  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const resolvedExt = ext || mediaExt;
  const fileIcon = FILE_ICON_MAP[resolvedExt] || null;
  const isPdf = resolvedExt === "pdf";

  const fileSize = formatFileSize(
    fileMedia?.size || fileMedia?.fileSize
  );

  // =========================
  // LOCATION FIX
  // =========================
  const isLocationType =
    messageType === "location" ||
    media?.type === "location" ||
    media?.latitude != null ||
    media?.lat != null ||
    location?.latitude != null ||
    location?.lat != null;

  const isLocationMessage = isLocationType;

  const lat =
    media?.latitude ?? media?.lat ?? location?.latitude ?? location?.lat;
  const lng =
    media?.longitude ?? media?.lng ?? location?.longitude ?? location?.lng;

  // =========================
  // TEXT
  // =========================
  const hasTextContent = Boolean(String(text || "").trim());

  useEffect(() => {
    if (fileMedia && onMediaRendered) onMediaRendered();
  }, [fileMedia, onMediaRendered]);

  // =========================
  // CALL LOG
  // =========================
  const isCallLog = messageType === "call_log";

  if (isCallLog) {
    return (
      <div className="flex w-full justify-center py-1">
        <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm">
          {callLog?.status === "missed" ? (
            <PhoneMissed size={14} className="text-red-500" />
          ) : (
            <Phone size={14} />
          )}
          <span>Cuộc gọi</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {/* PIN */}
      {(isPinned || pinned) && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-[10px] text-yellow-700">
          📌 Đã ghim
        </div>
      )}

      {/* BUBBLE */}
      <div
        className={`rounded-[15px] px-4 py-3 text-sm ${
          onlyImageMessage
            ? "bg-transparent p-0"
            : isMine
            ? "bg-blue-500 text-white"
            : "bg-white text-black border"
        }`}
        style={{ maxWidth: "280px" }}
      >
        {/* REPLY */}
        {replyTo && !onlyImageMessage && (
          <div className="mb-2 rounded border bg-gray-50 px-2 py-1 text-[11px]">
            {replyTo.text}
          </div>
        )}

        {/* IMAGE */}
        {imageSrc && (
          <img
            src={imageSrc}
            className="mb-2 rounded-[12px] object-cover"
            style={{ maxWidth: "280px", maxHeight: "320px" }}
          />
        )}

        {/* VIDEO */}
        {media?.type === "video" && media?.url && (
          <video
            src={media.url}
            controls
            className="mb-2 rounded-[12px]"
            style={{ maxWidth: "280px" }}
          />
        )}

        {/* LOCATION (FIXED) */}
        {isLocationMessage && lat != null && lng != null && (
          <LocationMessage
            message={{ lat, lng, location, media }}
            isMine={isMine}
          />
        )}

        {/* FILE (PDF/DOC) - KEEP ORIGINAL */}
        {fileMedia && (
          <div className="rounded-xl border bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="text-xl">
                {isPdf ? <FileText size={16} /> : <File size={16} />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">
                  {fileIcon} {fileName}
                </div>
                <div className="text-[11px] text-gray-500">
                  {fileSize}
                </div>
              </div>
            </div>

            {fileUrl && (
              <a
                href={fileUrl}
                download={fileName}
                className="mt-2 inline-flex items-center gap-1 text-xs text-blue-500"
              >
                <Download size={12} />
                Tải xuống
              </a>
            )}
          </div>
        )}

        {/* TEXT (FIXED - NOT OVERRIDE LOCATION) */}
        {!onlyImageMessage &&
          hasTextContent &&
          !isLocationMessage && (
            <div className="whitespace-pre-wrap break-words">
              {text}
            </div>
          )}

        {/* TIME */}
        {createdAt && (
          <div className="mt-1 text-[10px] opacity-60">
            {new Date(createdAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {/* REACTIONS */}
      {reactions.length > 0 && (
        <div className="absolute -bottom-3 right-0 flex gap-1 rounded-full bg-white px-2 py-1 text-xs shadow">
          {reactions.map((r, i) => (
            <span key={i}>{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default Bubble;