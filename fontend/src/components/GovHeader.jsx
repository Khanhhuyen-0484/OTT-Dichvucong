import React from "react";
import { Link, NavLink } from "react-router-dom";
import { ClipboardList, FileSearch, Landmark, LogIn, MessageCircle, UserRound } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function GovHeader({ sticky = true, minimal = false }) {
  const { user, avatarUrl, ready } = useAuth();
  const displayAvatarSrc = user?.avatarUrl || avatarUrl;

  const navItem = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
      isActive
        ? "bg-white text-[#003366] shadow-sm"
        : "text-white/88 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <header className={`z-40 shrink-0 border-b border-white/10 bg-[#003366]/95 text-white shadow-sm backdrop-blur ${sticky ? "sticky top-0" : "relative"}`}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-3 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-2xl transition hover:opacity-95">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#003366] shadow-sm ring-1 ring-white/20">
              <Landmark className="h-6 w-6" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-base font-black tracking-wide">Cổng Dịch vụ công</div>
              <div className="truncate text-xs font-medium text-white/75">Nhanh chóng - Minh bạch - Tin cậy</div>
            </div>
          </Link>

          {!minimal ? (
          <div className="flex shrink-0 items-center gap-2">
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Chính">
              <NavLink className={navItem} to="/">Trang chủ</NavLink>
              <NavLink className={navItem} to="/services">
                <FileSearch className="h-4 w-4" />
                Dịch vụ công
              </NavLink>
              <NavLink className={navItem} to={user ? "/chat" : "/auth"}>
                <MessageCircle className="h-4 w-4" />
                Hỗ trợ trực tuyến
              </NavLink>
              <NavLink className={navItem} to={user ? "/my-applications" : "/auth"}>
                <ClipboardList className="h-4 w-4" />
                Hồ sơ đã nộp
              </NavLink>
            </nav>

            {!ready ? (
              <span className="inline-flex h-10 w-28 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white/80">
                Đang tải
              </span>
            ) : user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1.5 pr-3 text-[#003366] shadow-sm transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Tài khoản cá nhân"
              >
                <UserAvatar user={user} src={displayAvatarSrc} size={34} />
                <span className="hidden max-w-[150px] truncate text-sm font-black md:inline">
                  {user.fullName || "Tài khoản"}
                </span>
              </Link>
            ) : (
              <NavLink className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-[#003366] shadow-sm transition hover:bg-sky-50" to="/auth">
                <LogIn className="h-4 w-4" />
                Đăng nhập
              </NavLink>
            )}
          </div>
          ) : null}
        </div>

        {!minimal ? (
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 lg:hidden" aria-label="Chính trên di động">
          <NavLink className={navItem} to="/">Trang chủ</NavLink>
          <NavLink className={navItem} to="/services">
            <FileSearch className="h-4 w-4" />
            Dịch vụ công
          </NavLink>
          <NavLink className={navItem} to={user ? "/chat" : "/auth"}>
            <MessageCircle className="h-4 w-4" />
            Hỗ trợ
          </NavLink>
          <NavLink className={navItem} to={user ? "/my-applications" : "/auth"}>
            <ClipboardList className="h-4 w-4" />
            Hồ sơ
          </NavLink>
          <NavLink className={navItem} to={user ? "/profile" : "/auth"}>
            <UserRound className="h-4 w-4" />
            Tài khoản
          </NavLink>
        </nav>
        ) : null}
      </div>
      <div className="h-1 bg-gradient-to-r from-[#bf1f2f] via-sky-400 to-emerald-400" />
    </header>
  );
}
