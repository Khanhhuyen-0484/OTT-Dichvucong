import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import GovHeader from "../components/GovHeader.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, patchProfile } from "../lib/api.js";

function DisplayRow({ icon: Icon, label, value }) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#003366] ring-1 ring-blue-100">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1.5 wrap-break-word text-base font-black leading-snug text-slate-900 sm:text-lg">
            {value && String(value).trim() ? value : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, ready, avatarUrl, uploadAvatarFile, removeAvatar, refreshProfile, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

  useEffect(() => {
    if (ready && !user) navigate("/auth", { replace: true });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setForm({ fullName: user.fullName || "", phone: user.phone || "", address: user.address || "" });
  }, [user]);

  const displayAvatarSrc = user?.avatarUrl || avatarUrl;

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2_000_000) {
      alert("Ảnh quá lớn. Vui lòng chọn file dưới 2 MB.");
      return;
    }
    setAvatarErr(null);
    setAvatarBusy(true);
    try {
      await uploadAvatarFile(file);
    } catch (err) {
      setAvatarErr(getApiErrorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemovePhoto() {
    setAvatarErr(null);
    setAvatarBusy(true);
    try {
      await removeAvatar();
    } catch (err) {
      setAvatarErr(getApiErrorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onSaveProfile(e) {
    e.preventDefault();
    setSaveErr(null);
    setSaving(true);
    try {
      await patchProfile({ fullName: form.fullName.trim(), phone: form.phone.trim(), address: form.address.trim() });
      await refreshProfile();
      setShowEditForm(false);
    } catch (err) {
      setSaveErr(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    logout();
    navigate("/", { replace: true });
  }

  async function onDeleteAccount() {
    setDeleteLoading(true);
    try {
      const result = await deleteAccount();
      setShowDeleteConfirm(false);
      setDeleteResult({
        type: "success",
        message: result?.message || "Xóa tài khoản thành công"
      });
    } catch (err) {
      setShowDeleteConfirm(false);
      setDeleteResult({
        type: err?.response?.status === 409 ? "blocked" : "error",
        message: getApiErrorMessage(err) || "Không thể xóa tài khoản"
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  function onCloseDeleteResult() {
    const isDeleted = deleteResult?.type === "success";
    setDeleteResult(null);
    if (isDeleted) {
      logout();
      navigate("/", { replace: true });
    }
  }

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <GovHeader />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-600">Đang tải...</div>
      </div>
    );
  }

  const createdLabel = user.createdAt && new Date(user.createdAt).toLocaleString("vi-VN", { dateStyle: "long", timeStyle: "short" });

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 via-slate-50 to-white">
      <GovHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:py-10">
        <div className="mb-6 flex flex-col items-start gap-4">
          <BackToDashboardButton variant="soft" />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#003366] shadow-sm ring-1 ring-blue-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Hồ sơ công dân
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Thông tin cá nhân</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Quản lý thông tin tài khoản, ảnh đại diện và các thao tác bảo mật trên hệ thống dịch vụ công.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-blue-950/10 ring-1 ring-slate-200">
          <div className="relative overflow-hidden bg-linear-to-br from-[#003366] via-[#075b99] to-[#0ea5e9] px-5 py-7 text-white sm:px-8 sm:py-8">
            <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute bottom-0 left-10 h-32 w-32 rounded-full bg-cyan-200/20 blur-2xl" />
            <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
              <div className="relative">
                <div className="rounded-full bg-white/20 p-1.5 shadow-2xl ring-1 ring-white/30">
                  <UserAvatar user={user} src={displayAvatarSrc} size={118} className="ring-4 ring-white" />
                </div>
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 grid h-12 w-12 place-items-center rounded-full bg-white text-[#003366] shadow-lg ring-4 ring-[#075b99] transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:opacity-60"
                  aria-label="Đổi ảnh đại diện"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  Tài khoản đã xác thực
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {user.fullName || "Công dân"}
                </h2>
                <p className="mt-2 wrap-break-word text-sm font-semibold text-white/82">{user.email || "Chưa có email"}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
                  <button
                    type="button"
                    disabled={avatarBusy}
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#003366] shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:opacity-50"
                    onClick={() => fileRef.current?.click()}
                  >
                    {avatarBusy ? "Đang tải..." : "Bấm biểu tượng máy ảnh để đổi ảnh"}
                  </button>
                  {displayAvatarSrc ? (
                    <button type="button" disabled={avatarBusy} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white underline-offset-4 ring-1 ring-white/25 transition hover:bg-white/18 hover:underline disabled:opacity-50" onClick={onRemovePhoto}>
                      Xóa ảnh
                    </button>
                  ) : null}
                </div>
                {avatarErr && <p className="mt-3 rounded-2xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 ring-1 ring-red-200/20">{avatarErr}</p>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onPickPhoto} />
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="border-l-4 border-red-600 pl-3 text-xl font-black uppercase tracking-wide text-slate-950">Thông tin đã đăng ký</h2>
                <p className="mt-2 text-sm text-slate-500">Dữ liệu hiện có trên tài khoản của bạn.</p>
              </div>
              {!showEditForm ? (
                <button
                  type="button"
                  onClick={() => setShowEditForm(true)}
                  className="rounded-full bg-blue-50 px-5 py-2.5 text-sm font-black text-[#003366] ring-1 ring-blue-100 transition hover:bg-blue-100 disabled:opacity-50"
                  disabled={saving}
                >
                  Cập nhật thông tin
                </button>
              ) : null}
            </div>

            {!showEditForm ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <DisplayRow icon={UserRound} label="Họ và tên" value={user.fullName} />
                <DisplayRow icon={Mail} label="Email" value={user.email} />
                <DisplayRow icon={Phone} label="Số điện thoại" value={user.phone} />
                <DisplayRow icon={MapPin} label="Địa chỉ" value={user.address} />
                <div className="sm:col-span-2">
                  <DisplayRow icon={CalendarDays} label="Ngày tạo tài khoản" value={createdLabel} />
                </div>
              </div>
            ) : (
              <form onSubmit={onSaveProfile} className="mt-6 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileInput label="Họ và tên" value={form.fullName} onChange={(value) => setForm((f) => ({ ...f, fullName: value }))} disabled={saving} />
                  <ProfileInput label="Email" value={user.email || ""} disabled />
                  <ProfileInput label="Số điện thoại" value={form.phone} onChange={(value) => setForm((f) => ({ ...f, phone: value }))} disabled={saving} />
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Địa chỉ</span>
                    <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} disabled={saving} rows={3} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50" placeholder="Số nhà, đường, phường/xã, tỉnh/thành" />
                  </label>
                </div>
                {saveErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">{saveErr}</p>}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => setShowEditForm(false)} disabled={saving} className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50">Hủy</button>
                  <button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-[#003366] px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-[#06477f] disabled:translate-y-0 disabled:opacity-50">
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {!showEditForm ? (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-6 sm:grid-cols-2 sm:px-8">
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-base font-black text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-100" onClick={onLogout}>
                <LogOut className="h-5 w-5" />
                Đăng xuất
              </button>
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:-translate-y-0.5 hover:bg-red-700" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-5 w-5" />
                Xóa tài khoản
              </button>
            </div>
          ) : null}
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-3 text-lg font-bold text-slate-900">Xóa tài khoản?</h3>
              <p className="mb-6 text-sm text-slate-600">Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa toàn bộ thông tin tài khoản?</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading} className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50">Hủy</button>
                <button type="button" onClick={onDeleteAccount} disabled={deleteLoading} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {deleteLoading ? "Đang xóa..." : "Xác nhận xóa"}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className={`mb-3 text-lg font-bold ${deleteResult.type === "success" ? "text-emerald-700" : "text-red-700"}`}>
                {deleteResult.type === "success" ? "Xóa tài khoản thành công" : "Không thể xóa tài khoản"}
              </h3>
              <p className="text-sm text-slate-600">{deleteResult.message}</p>
              {deleteResult.type === "blocked" ? (
                <p className="mt-2 text-sm font-semibold text-slate-700">Không thể xóa tài khoản.</p>
              ) : null}
              <button type="button" onClick={onCloseDeleteResult} className="mt-6 w-full rounded-lg bg-[#003366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                OK
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ProfileInput({ label, value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:opacity-60" />
    </label>
  );
}
