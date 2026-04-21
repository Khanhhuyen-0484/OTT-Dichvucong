import React from "react";

export function initialsFromUser(user) {
  const name = (user?.fullName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0] || "";
      const b = parts[parts.length - 1][0] || "";
      return (a + b).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const em = (user?.email || "?").trim();
  return em.slice(0, 1).toUpperCase();
}

export default function UserAvatar({
  user,
  src,
  size = 40,
  className = "",
  showActive = false
}) {
  const label = initialsFromUser(user);
  const px = `${size}px`;
  const hasRealAvatar = Boolean(src && !String(src).includes("ui-avatars.com"));
  if (src) {
    return (
      <div className="relative shrink-0" style={{ width: px, height: px }}>
        {hasRealAvatar ? (
          <img
            src={src}
            alt=""
            width={size}
            height={size}
            className={`rounded-full object-cover ring-2 ring-white/30 ${className}`}
            style={{ width: px, height: px }}
          />
        ) : (
          <div
            className={`rounded-full bg-gradient-to-br from-[#003366] to-[#0b7dda] grid place-items-center font-bold text-white ring-2 ring-white/30 shrink-0 ${className}`}
            style={{ width: px, height: px, fontSize: size * 0.35 }}
            aria-hidden
          >
            {label.slice(0, 1)}
          </div>
        )}
        {showActive && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </div>
    );
  }
  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      <div
        className={`rounded-full bg-gradient-to-br from-[#003366] to-[#0b7dda] grid place-items-center font-bold text-white ring-2 ring-white/30 shrink-0 ${className}`}
        style={{ width: px, height: px, fontSize: size * 0.35 }}
        aria-hidden
      >
        {label.slice(0, 1)}
      </div>
      {showActive && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
      )}
    </div>
  );
}
