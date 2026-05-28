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
  className = ""
}) {
  const label = initialsFromUser(user);
  const px = `${size}px`;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ring-2 ring-white/30 ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-[#003366] to-[#052b53] grid place-items-center font-bold text-white ring-2 ring-white/30 shrink-0 ${className}`}
      style={{ width: px, height: px, fontSize: size * 0.35 }}
      aria-hidden
    >
      {label}
    </div>
  );
}
