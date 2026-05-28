import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  ImageIcon,
  Info,
  Mail,
  Phone,
  Trash2,
  UserRound,
  X
} from "lucide-react";

const AVATAR_BG = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

function getInitials(name) {
  const n = String(name || "").trim();
  if (!n) return "?";
  const words = n.split(/\s+/).filter(Boolean);
  return (words[0]?.[0] || "") + (words[words.length - 1]?.[0] || "");
}

function isDisplayableAvatarSrc(src) {
  const s = String(src || "").trim();
  return Boolean(s && (/^https?:\/\//i.test(s) || s.startsWith("data:")));
}

function Avatar({ src, name }) {
  if (isDisplayableAvatarSrc(src)) {
    return <img src={src} alt={name || "avatar"} className="h-20 w-20 rounded-3xl object-cover ring-4 ring-white shadow-xl" />;
  }
  const idx = (String(name || "A").charCodeAt(0) || 0) % AVATAR_BG.length;
  return (
    <div className={`grid h-20 w-20 place-items-center rounded-3xl ${AVATAR_BG[idx]} text-2xl font-black text-white ring-4 ring-white shadow-xl`}>
      {getInitials(name).toUpperCase()}
    </div>
  );
}

function normalizeMediaUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:") || /^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return "";
}

function getExtension(url = "", name = "") {
  const raw = String(url || name || "").split("?")[0].split("#")[0];
  return String(raw.split(".").pop() || "").toLowerCase();
}

function extractSharedAttachments(messages = [], members = []) {
  const memberMap = new Map((members || []).map((member) => [member.id, member]));
  const images = [];
  const files = [];
  const seen = new Set();

  for (const message of messages) {
    if (!message?.id || message.unsentForAll || seen.has(message.id)) continue;
    seen.add(message.id);

    const media = message.media || {};
    const url = normalizeMediaUrl(media.url || media.fileUrl || message.fileUrl);
    if (!url) continue;

    const sender = memberMap.get(message.senderId) || message.sender || {
      fullName: message.senderName || "Người dùng"
    };
    const ext = getExtension(url, media.name || message.fileName);
    const base = {
      id: message.id,
      url,
      senderName: sender.fullName || "Người dùng",
      createdAt: message.createdAt
    };

    const isImage =
      media.type === "image" ||
      ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
    const isVideo = media.type === "video" || ["mp4", "webm", "mov"].includes(ext);
    const isFile =
      media.type === "file" ||
      media.type === "document" ||
      message.messageType === "file" ||
      ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "rar"].includes(ext);

    if ((isImage || isVideo) && !isFile) {
      images.push({ ...base, type: isVideo ? "video" : "image" });
    } else if (isFile) {
      files.push({
        ...base,
        name: media.name || message.fileName || message.name || "Tệp đính kèm",
        ext
      });
    }
  }

  return {
    images: images.reverse(),
    files: files.reverse()
  };
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function ProfileLine({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-slate-100">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#003366]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
        <div className="truncate text-sm font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export default function DirectChatInfoDrawer({
  open,
  onClose,
  activeRoom,
  user,
  onClearHistory,
  busy = false,
  initialTab = "media"
}) {
  const [tab, setTab] = useState(initialTab);
  const [preview, setPreview] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const partner = useMemo(
    () => activeRoom?.members?.find((member) => member.id !== user?.id) || null,
    [activeRoom?.members, user?.id]
  );
  const { images, files } = useMemo(
    () => extractSharedAttachments(activeRoom?.messages || [], activeRoom?.members || []),
    [activeRoom?.members, activeRoom?.messages]
  );
  const visibleMessageCount = activeRoom?.messages?.filter((message) => !message?.unsentForAll).length || 0;

  if (!open || activeRoom?.type === "group") return null;

  const tabs = [
    { id: "media", label: `Ảnh & file (${images.length + files.length})` },
    { id: "profile", label: "Thông tin" }
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        className="fixed inset-0 z-64 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-65 flex w-full max-w-md flex-col border-l border-slate-200 bg-linear-to-b from-white via-blue-50/40 to-white shadow-2xl">
        <div className="relative overflow-hidden border-b border-blue-100 bg-linear-to-br from-[#003366] via-[#075b99] to-[#0ea5e9] px-5 py-5 text-white">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Thông tin hội thoại</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-5 flex items-center gap-4">
            <Avatar src={partner?.avatarUrl || partner?.avatar || partner?.photoURL} name={partner?.fullName} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-2xl font-black">{partner?.fullName || "Hội thoại"}</h3>
              <p className="mt-1 truncate text-sm font-semibold text-white/78">{partner?.email || "Đang hoạt động"}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
                <Info className="h-3.5 w-3.5" />
                {visibleMessageCount} tin nhắn đang hiển thị
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition ${
                  tab === item.id ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === "profile" ? (
            <div className="space-y-3">
              <ProfileLine icon={UserRound} label="Họ và tên" value={partner?.fullName} />
              <ProfileLine icon={Mail} label="Email" value={partner?.email} />
              <ProfileLine icon={Phone} label="Số điện thoại" value={partner?.phone} />
              <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-black text-slate-900">Tệp đã chia sẻ</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-blue-50 p-3 text-center">
                    <ImageIcon className="mx-auto h-5 w-5 text-[#003366]" />
                    <div className="mt-1 text-2xl font-black text-slate-900">{images.length}</div>
                    <div className="text-xs font-semibold text-slate-500">Ảnh/video</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                    <FileText className="mx-auto h-5 w-5 text-emerald-700" />
                    <div className="mt-1 text-2xl font-black text-slate-900">{files.length}</div>
                    <div className="text-xs font-semibold text-slate-500">Tệp tin</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
                  <ImageIcon className="h-4 w-4 text-[#003366]" />
                  Hình ảnh & video ({images.length})
                </div>
                {images.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-blue-200 bg-white/70 py-10 text-center text-sm font-semibold text-slate-400">
                    Chưa có hình ảnh hoặc video nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreview(item)}
                        className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-100"
                      >
                        {item.type === "video" ? (
                          <video src={item.url} className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2 text-left">
                          <p className="truncate text-[10px] font-bold text-white">{item.senderName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
                  <FileText className="h-4 w-4 text-[#003366]" />
                  File đã gửi ({files.length})
                </div>
                {files.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/70 py-10 text-center text-sm font-semibold text-slate-400">
                    Chưa có file nào được chia sẻ.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#003366]/10 text-xs font-black uppercase text-[#003366]">
                          {item.ext || "file"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-800">{item.name}</p>
                          <p className="text-[11px] font-semibold text-slate-400">
                            {item.senderName} · {formatWhen(item.createdAt)}
                          </p>
                        </div>
                        <Download className="h-4 w-4 text-slate-400" />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          {!confirmClear ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmClear(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Xóa lịch sử cuộc trò chuyện
            </button>
          ) : (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-3">
              <div className="flex gap-2 text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="text-sm font-black">Xóa lịch sử</div>
                  <p className="mt-1 text-xs font-semibold text-red-700/80">
                    Bạn có chắc chắn muốn xóa không
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmClear(false)}
                  className="rounded-xl bg-white py-2 text-xs font-black text-slate-700 ring-1 ring-red-100 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onClearHistory?.();
                    setConfirmClear(false);
                    onClose?.();
                  }}
                  className="rounded-xl bg-red-600 py-2 text-xs font-black text-white shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {busy ? "Đang xóa..." : "Xóa lịch sử"}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {preview ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 p-4" onClick={() => setPreview(null)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" onClick={() => setPreview(null)}>
            <X className="h-5 w-5" />
          </button>
          {preview.type === "video" ? (
            <video src={preview.url} controls autoPlay className="max-h-[90vh] max-w-full rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
          ) : (
            <img src={preview.url} alt="Xem trước" className="max-h-[90vh] max-w-full rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
          )}
        </div>
      ) : null}
    </>
  );
}
