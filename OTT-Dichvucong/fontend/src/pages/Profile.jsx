import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import Button from "../components/Button.jsx";
import GovHeader from "../components/GovHeader.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, patchProfile } from "../lib/api.js";

function DisplayRow({ label, value }) {
  return (
    <div className="border-b border-slate-100 py-3.5 last:border-b-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1.5 break-words text-base font-semibold leading-snug text-slate-900 sm:text-lg">
        {value && String(value).trim() ? value : "-"}
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
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      alert(getApiErrorMessage(err) || "Không thể xóa tài khoản");
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
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
    <div className="min-h-screen bg-slate-50">
      <GovHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 pb-28">
        <div className="mb-4 flex flex-col items-start gap-3">
          <BackToDashboardButton variant="soft" />
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Hồ sơ công dân</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Thông tin bạn đã khai khi đăng ký tài khoản trên cổng. Bạn có thể chỉnh sửa và bấm <strong>Cập nhật</strong> để lưu lên hệ thống.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="bg-[var(--gov-navy)] px-5 py-4 text-white">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Ảnh đại diện</div>
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <UserAvatar user={user} src={displayAvatarSrc} size={96} />
              <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                <button type="button" disabled={avatarBusy} className="text-sm font-semibold text-white underline underline-offset-2 disabled:opacity-50" onClick={() => fileRef.current?.click()}>
                  {avatarBusy ? "Đang tải..." : "Đổi ảnh"}
                </button>
                {displayAvatarSrc ? (
                  <button type="button" disabled={avatarBusy} className="text-sm font-semibold text-white/85 underline underline-offset-2 disabled:opacity-50" onClick={onRemovePhoto}>
                    Xóa ảnh
                  </button>
                ) : null}
              </div>
            </div>
            {avatarErr && <p className="mt-3 text-sm text-red-200">{avatarErr}</p>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onPickPhoto} />
          </div>

          <div className="px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <h2 className="border-l-4 border-[var(--gov-red)] pl-3 text-sm font-black uppercase tracking-wide text-slate-900">Thông tin đã đăng ký</h2>
              <button type="button" onClick={() => setShowEditForm(!showEditForm)} className="text-xs font-semibold text-[var(--gov-blue)] underline underline-offset-2 hover:text-[var(--gov-red)]" disabled={saving}>
                {showEditForm ? "Hủy" : "Cập nhật"}
              </button>
            </div>
            <p className="mb-4 mt-2 text-xs text-slate-500">Dữ liệu hiện có trên tài khoản của bạn.</p>

            {!showEditForm ? (
              <div className="mt-4 rounded-xl bg-slate-50/80 px-4 ring-1 ring-slate-100 sm:px-5">
                <DisplayRow label="Họ và tên" value={user.fullName} />
                <DisplayRow label="Email" value={user.email} />
                <DisplayRow label="Số điện thoại" value={user.phone} />
                <DisplayRow label="Địa chỉ" value={user.address} />
                <DisplayRow label="Ngày tạo tài khoản" value={createdLabel} />
              </div>
            ) : (
              <form onSubmit={onSaveProfile} className="mt-4 space-y-4">
                <ProfileInput label="Họ và tên" value={form.fullName} onChange={(value) => setForm((f) => ({ ...f, fullName: value }))} disabled={saving} />
                <ProfileInput label="Email" value={user.email || ""} disabled />
                <ProfileInput label="Số điện thoại" value={form.phone} onChange={(value) => setForm((f) => ({ ...f, phone: value }))} disabled={saving} />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Địa chỉ</span>
                  <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} disabled={saving} rows={3} className="w-full rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] disabled:opacity-50" placeholder="Số nhà, đường, phường/xã, tỉnh/thành" />
                </label>
                {saveErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">{saveErr}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowEditForm(false)} disabled={saving} className="flex-1 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-300 disabled:opacity-50">Hủy</button>
                  <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[var(--gov-blue)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--gov-red)] disabled:opacity-50">
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-6 sm:px-6">
            <Button type="button" variant="danger" className="w-full py-3 text-base font-bold" onClick={onLogout}>Đăng xuất</Button>
            <Button type="button" variant="danger" className="mt-3 w-full bg-red-700 py-3 text-base font-bold hover:bg-red-800" onClick={() => setShowDeleteConfirm(true)}>Xóa tài khoản</Button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-3 text-lg font-bold text-slate-900">Xóa tài khoản?</h3>
              <p className="mb-6 text-sm text-slate-600">Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading} className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50">Hủy</button>
                <button type="button" onClick={onDeleteAccount} disabled={deleteLoading} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {deleteLoading ? "Đang xóa..." : "Xóa tài khoản"}
                </button>
              </div>
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
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} className="w-full rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] disabled:bg-slate-50 disabled:opacity-60" />
    </label>
  );
}
