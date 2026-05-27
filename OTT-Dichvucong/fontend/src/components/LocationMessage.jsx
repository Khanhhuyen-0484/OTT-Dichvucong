import React, { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import MapModal from "./MapModal.jsx";

function getLocationData(message) {
  const location = message?.location || {};
  const media = message?.media || {};
  const lat = Number(
    message?.lat ??
    message?.latitude ??
    location.latitude ??
    location.lat ??
    media.latitude ??
    media.lat
  );
  const lng = Number(
    message?.lng ??
    message?.longitude ??
    location.longitude ??
    location.lng ??
    media.longitude ??
    media.lng
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const label =
    location.label ||
    media.label ||
    media.name ||
    message?.text ||
    "Vị trí đã chia sẻ";
  const mapsUrl =
    location.mapsUrl ||
    media.mapsUrl ||
    `https://www.google.com/maps?q=${lat},${lng}`;

  return { lat, lng, label, mapsUrl };
}

export default function LocationMessage({ message, isMine }) {
  const [open, setOpen] = useState(false);
  const location = useMemo(() => getLocationData(message), [message]);

  if (!location) return null;

  const { lat, lng, label, mapsUrl } = location;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block w-[min(300px,78vw)] overflow-hidden rounded-[14px] text-left shadow-sm ring-1 ring-inset transition duration-200 hover:scale-[1.02] hover:shadow-xl ${
          isMine ? "ring-blue-200" : "ring-slate-200"
        }`}
      >
        <div className="relative h-[180px] w-full bg-gradient-to-br from-slate-200 via-slate-100 to-emerald-50">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(148,163,184,0.25) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(148,163,184,0.25) 24px)",
            }}
          />

          <div className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
            <MapPin className="h-4 w-4" />
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-3 pt-8 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Shared location
            </div>
            <div className="truncate text-sm font-semibold">{label}</div>
            <div className="text-[11px] text-white/80">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          </div>
        </div>
      </button>

      <MapModal
        open={open}
        lat={lat}
        lng={lng}
        label={label}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
