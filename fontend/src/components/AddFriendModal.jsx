import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, Search, UserRoundPlus, Users, X } from "lucide-react";

function FriendRow({ item, subtitle, actionSlot }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl px-1 py-3">
      <img
        src={item.avatarUrl}
        alt={item.fullName}
        className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold text-slate-900">{item.fullName}</div>
        <div className="truncate text-[15px] text-slate-500">{subtitle}</div>
      </div>
      {actionSlot}
    </div>
  );
}

function buildResultSubtitle(item) {
  if (item.phone) return item.phone.startsWith("(+84)") ? item.phone : `(+84) ${item.phone}`;
  if (item.email) return item.email;
  return "Người dùng hệ thống";
}

function SectionTitle({ icon: Icon, title, note }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[17px] font-bold text-slate-900">{title}</div>
        {note ? <div className="mt-0.5 text-[13px] text-slate-500">{note}</div> : null}
      </div>
    </div>
  );
}

export default function AddFriendModal({
  open,
  onClose,
  query,
  setQuery,
  users,
  suggestions,
  requests,
  onSearch,
  onAdd,
  onAccept,
  onDecline,
  loading,
  searchNotice
}) {
  const [searchMode, setSearchMode] = useState("phone");
  const visibleSuggestions = useMemo(() => (users.length ? [] : suggestions || []), [suggestions, users.length]);
  const inputPlaceholder = searchMode === "phone" ? "Số điện thoại" : "Nhập email";
  const emptyMessage =
    searchMode === "phone"
      ? "Nhập số điện thoại để tìm tài khoản chính xác hơn."
      : "Nhập email để tìm tài khoản khi bạn không có số điện thoại.";

  useEffect(() => {
    if (!open) return;
    setSearchMode("phone");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(86vh,860px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-[20px] font-bold tracking-tight text-slate-900">Thêm bạn</div>
            <div className="mt-1 text-[13px] text-slate-500">
              Ưu tiên tìm bằng số điện thoại để định danh chính xác hơn.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="px-6 pb-4 pt-5">
          <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Tìm theo
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchMode(searchMode === "phone" ? "email" : "phone");
                  setQuery("");
                }}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0d5bd7] transition hover:text-[#0a4db8]"
              >
                <Mail className="h-4 w-4" />
                {searchMode === "phone" ? "Dùng email thay thế" : "Quay lại số điện thoại"}
              </button>
            </div>

            {searchMode === "phone" ? (
              <div className="flex items-end gap-4 border-b-2 border-[#0d5bd7] pb-2">
                <button type="button" className="flex items-center gap-3 pb-1 text-slate-800">
                  <span className="text-[26px] leading-none">🇻🇳</span>
                  <span className="text-[18px] font-semibold">(+84)</span>
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                </button>

                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch();
                  }}
                  placeholder={inputPlaceholder}
                  inputMode="tel"
                  className="w-full bg-transparent text-[18px] text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            ) : (
              <div className="border-b-2 border-[#0d5bd7] pb-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch();
                  }}
                  placeholder={inputPlaceholder}
                  inputMode="email"
                  className="w-full bg-transparent text-[18px] text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            )}
          </div>

          {searchNotice ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 ring-1 ring-amber-200">
              {searchNotice}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
              {emptyMessage}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <SectionTitle
            icon={Search}
            title="Kết quả gần nhất"
            note="Hiển thị tài khoản vừa tìm hoặc trùng với thông tin bạn nhập."
          />

          {users.length ? (
            <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-2">
              {users.map((item) => {
                const status = item.status || "none";
                let actionSlot = null;

                if (status === "friend") {
                  actionSlot = (
                    <span className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-bold text-emerald-700">
                      Bạn bè
                    </span>
                  );
                } else if (status === "outgoing") {
                  actionSlot = (
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-600">
                      Đã gửi
                    </span>
                  );
                } else if (status === "incoming") {
                  actionSlot = (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onDecline(item.id)}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-700 disabled:opacity-60"
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onAccept(item.id)}
                        className="rounded-xl bg-[#0d5bd7] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                      >
                        Chấp nhận
                      </button>
                    </div>
                  );
                } else {
                  actionSlot = (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => onAdd(item.id)}
                      className="min-w-[102px] rounded-[10px] border border-[#0d5bd7] px-4 py-2 text-[13px] font-bold text-[#0d5bd7] hover:bg-[#0d5bd7]/5 disabled:opacity-60"
                    >
                      Kết bạn
                    </button>
                  );
                }

                return (
                  <FriendRow
                    key={item.id}
                    item={item}
                    subtitle={buildResultSubtitle(item)}
                    actionSlot={actionSlot}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-300 px-4 py-10 text-center text-[15px] text-slate-500">
              Chưa có kết quả phù hợp. Hãy thử lại bằng {searchMode === "phone" ? "số điện thoại" : "email"}.
            </div>
          )}

          {visibleSuggestions.length ? (
            <>
              <div className="mt-7 border-t border-slate-200 pt-5">
                <SectionTitle
                  icon={UserRoundPlus}
                  title="Có thể bạn quen"
                  note="Gợi ý dựa trên kết nối gần đây và tài khoản thường xuất hiện."
                />
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-2">
                {visibleSuggestions.map((item) => (
                  <FriendRow
                    key={`suggest-${item.id}`}
                    item={item}
                    subtitle="Từ gợi ý kết bạn"
                    actionSlot={
                      <button
                      type="button"
                      disabled={loading}
                      onClick={() => onAdd(item.id)}
                      className="min-w-[102px] rounded-[10px] border border-[#0d5bd7] px-4 py-2 text-[13px] font-bold text-[#0d5bd7] hover:bg-[#0d5bd7]/5 disabled:opacity-60"
                      >
                        Kết bạn
                      </button>
                    }
                  />
                ))}
              </div>
            </>
          ) : null}

          <div className="mt-7 border-t border-slate-200 pt-5">
            <SectionTitle
              icon={Users}
              title="Lời mời kết bạn"
              note="Những người đang chờ bạn phản hồi."
            />
          </div>

          <div>
            {requests.length ? (
              <div className="rounded-[20px] border border-slate-200 bg-white px-3 py-2">
                {requests.map((item) => (
                  <FriendRow
                    key={`req-${item.id}`}
                    item={item}
                    subtitle="Đã gửi lời mời kết bạn cho bạn"
                    actionSlot={
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => onDecline(item.id)}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-700 disabled:opacity-60"
                        >
                          Bỏ qua
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => onAccept(item.id)}
                          className="rounded-xl bg-[#0d5bd7] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                        >
                          Chấp nhận
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[20px] bg-slate-50 px-4 py-10 text-center text-[15px] text-slate-500 ring-1 ring-slate-200">
                Hiện chưa có lời mời kết bạn mới.
              </div>
            )}
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-6 py-3 text-[16px] font-bold text-slate-700 hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="min-w-[136px] rounded-2xl bg-[#0d5bd7] px-6 py-3 text-[16px] font-bold text-white hover:bg-[#0a4db8]"
          >
            Tìm kiếm
          </button>
        </div>
      </div>
    </div>
  );
}
