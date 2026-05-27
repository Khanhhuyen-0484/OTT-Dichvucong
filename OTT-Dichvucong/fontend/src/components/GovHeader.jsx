import React from "react";
import { Link, NavLink } from "react-router-dom";
import { ClipboardList, FileSearch, LogIn, Send } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function GovHeader({ sticky = true }) {
  const { user, avatarUrl, ready } = useAuth();
  const displayAvatarSrc = user?.avatarUrl || avatarUrl;

  const navItem = ({ isActive }) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? "bg-white text-[#003366]" : "text-white/90 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <header className={`z-40 shrink-0 bg-[#003366] text-white shadow-sm ${sticky ? "sticky top-0" : "relative"}`}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white font-black text-[#003366] ring-1 ring-white/20">
              DV
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate font-extrabold tracking-wide">Cổng Dịch vụ công</div>
              <div className="truncate text-xs text-white/80">Nhanh chóng - Minh bạch - Tin cậy</div>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex" aria-label="Chính">
              <NavLink className={navItem} to="/">Trang chủ</NavLink>
              <NavLink className={navItem} to="/services">
                <FileSearch className="h-4 w-4" />
                Dịch vụ
              </NavLink>
              <NavLink className={navItem} to="/chat">
                <Send className="h-4 w-4" />
                Hỗ trợ trực tuyến
              </NavLink>
              {user ? (
                <NavLink className={navItem} to="/my-applications">
                  <ClipboardList className="h-4 w-4" />
                  Hồ sơ đã nộp
                </NavLink>
              ) : null}
            </nav>

            {!ready ? (
              <span className="inline-flex h-9 w-[7.5rem] items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-white/80">
                Đang tải
              </span>
            ) : user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-xl py-1.5 pl-1 pr-3 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Hồ sơ cá nhân"
              >
                <UserAvatar user={user} src={displayAvatarSrc} size={36} />
                <span className="hidden max-w-[120px] truncate text-sm font-semibold md:inline">
                  {user.fullName || "Tài khoản"}
                </span>
              </Link>
            ) : (
              <NavLink className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10" to="/auth">
                <LogIn className="h-4 w-4 opacity-90" />
                Đăng nhập
              </NavLink>
            )}
          </div>
        </div>
      </div>
      <div className="h-1 bg-[#7a1f1f]" />
    </header>
  );
}
