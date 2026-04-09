import React from "react";
import { Link, NavLink } from "react-router-dom";
import { User } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function GovHeader() {
  const { user, avatarUrl, ready } = useAuth();
  const displayAvatarSrc = user?.avatarUrl || avatarUrl;

  const navItem =
    "rounded-lg px-3 py-2 text-sm font-semibold text-white/90 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

  return (
    <header className="bg-[var(--gov-navy)] text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 py-4">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10 ring-1 ring-white/20 grid place-items-center font-black">
              LOGO
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold tracking-wide truncate">
                CỔNG DỊCH VỤ CÔNG
              </div>
              <div className="text-xs text-white/80 truncate">
                Hệ thống dịch vụ hành chính điện tử
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <nav className="hidden sm:flex items-center gap-1" aria-label="Chính">
              <NavLink className={navItem} to="/">
                Trang chủ
              </NavLink>
              <a className={navItem} href="#dichvu">
                Dịch vụ
              </a>
              <a className={navItem} href="#chat">
                Hỗ trợ chat
              </a>
            </nav>

            {!ready ? (
              <span
                className="inline-flex h-9 w-[7.5rem] items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-white/80"
                aria-hidden
              >
                …
              </span>
            ) : user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-xl pl-1 pr-3 py-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Hồ sơ cá nhân"
              >
                <UserAvatar user={user} src={displayAvatarSrc} size={36} />
                <span className="hidden sm:inline max-w-[120px] truncate text-sm font-semibold">
                  Hồ sơ
                </span>
              </Link>
            ) : (
              <NavLink
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10 ${navItem}`}
                to="/auth"
              >
                <User className="h-4 w-4 opacity-90" aria-hidden />
                Đăng nhập
              </NavLink>
            )}
          </div>
        </div>
      </div>
      <div className="h-1 bg-[var(--gov-red)]" />
    </header>
  );
}
