import React, { useEffect } from "react";
import { X, ExternalLink, MapPin } from "lucide-react";
import { getGoogleMapsUrl, getOsmEmbedUrl } from "../lib/mapUrls.js";

export default function MapModal({ open, lat, lng, label, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || lat == null || lng == null) return null;

  const googleMapsUrl = getGoogleMapsUrl(lat, lng);
  const embedSrc = getOsmEmbedUrl(lat, lng);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/70"
          aria-label="Đóng bản đồ"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative aspect-[16/10] w-full bg-slate-100 sm:aspect-[16/9]">
          <iframe
            title={label || "Bản đồ vị trí"}
            src={embedSrc}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span>{label || "Shared location"}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pb-4 pt-10 text-white">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Vị trí đã chia sẻ</div>
                <div className="text-xs text-white/80">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </div>
              </div>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg transition hover:scale-[1.02]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
