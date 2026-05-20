import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, patchProfile } from "../lib/api.js";

function DisplayRow({ label, value }) {
  return (
    <div className="py-3.5 border-b border-slate-100 last:border-b-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1.5 text-base sm:text-lg font-semibold text-slate-900 break-words leading-snug">
        {value && String(value).trim() ? value : "—"}
      </div>
    </div>
  );
}

export default function Profile() {
  const {
    user,
    ready,
    avatarUrl,
    uploadAvatarFile,
    removeAvatar,
    refreshProfile,
    logout,
    deleteAccount
  } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [showEditForm, setShowEditForm] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (ready && !user) {
      navigate("/auth", { replace: true });
    }
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || "",
      phone: user.phone || "",
      address: user.address || ""
    });
  }, [user]);

  const displayAvatarSrc = user?.avatarUrl || avatarUrl;

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2_000_000) {
      alert("Ảnh quá lớn. Vui lòng chọn file dưới khoảng 2 MB.");
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
  };

  const onRemovePhoto = async () => {
    setAvatarErr(null);
    setAvatarBusy(true);
    try {
      await removeAvatar();
    } catch (err) {
      setAvatarErr(getApiErrorMessage(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaveErr(null);
    setSaving(true);
    try {
      await patchProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim()
      });
      await refreshProfile();
      setShowEditForm(false);
    } catch (err) {
      setSaveErr(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const onDeleteAccount = async () => {
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
  };

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <GovHeader />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-600">
          Đang tải…
        </div>
      </div>
    );
  }

  const createdLabel =
    user.createdAt &&
    new Date(user.createdAt).toLocaleString("vi-VN", {
      dateStyle: "long",
      timeStyle: "short"
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <GovHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 pb-28">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Hồ sơ công dân
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Thông tin bạn đã khai khi đăng ký tài khoản trên cổng. Bạn có thể chỉnh
          sửa và bấm <strong>Cập nhật</strong> để lưu lên hệ thống.
        </p>

        <div className="mt-8 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[var(--gov-navy)] px-5 py-4 text-white">
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">
              Ảnh đại diện
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
              <UserAvatar user={user} src={displayAvatarSrc} size={96} />
              <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                <button
                  type="button"
                  disabled={avatarBusy}
                  className="text-sm font-semibold text-white underline underline-offset-2 disabled:opacity-50"
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarBusy ? "Đang tải…" : "Đổi ảnh"}
                </button>
                {displayAvatarSrc ? (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    className="text-sm font-semibold text-white/85 underline underline-offset-2 disabled:opacity-50"
                    onClick={onRemovePhoto}
                  >
                    Xóa ảnh
                  </button>
                ) : null}
              </div>
            </div>
            {avatarErr && (
              <p className="mt-3 text-sm text-red-200">{avatarErr}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPickPhoto}
            />
          </div>

          <div className="px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide border-l-4 border-[var(--gov-red)] pl-3">
                Thông tin đã đăng ký
              </h2>
              <button
                type="button"
                onClick={() => setShowEditForm(!showEditForm)}
                className="text-xs font-semibold text-[var(--gov-blue)] hover:text-[var(--gov-red)] underline underline-offset-2"
                disabled={saving}
              >
                {showEditForm ? "Hủy" : "Cập nhật"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 mb-4">
              Dữ liệu hiện có trên tài khoản của bạn (theo lần đăng ký / cập nhật
              gần nhất).
            </p>

            {!showEditForm ? (
              <div className="mt-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 px-4 sm:px-5">
                <DisplayRow label="Họ và tên" value={user.fullName} />
                <DisplayRow label="Email" value={user.email} />
                <DisplayRow label="Số điện thoại" value={user.phone} />
                <DisplayRow label="Địa chỉ" value={user.address} />
                <DisplayRow label="Ngày tạo tài khoản" value={createdLabel} />
              </div>
            ) : (
              <form onSubmit={onSaveProfile} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="pf-name">
                    Họ và tên
                  </label>
                  <input
                    id="pf-name"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    disabled={saving}
                    className="w-full rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] disabled:opacity-50"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="pf-email">
                    Email
                  </label>
                  <input
                    id="pf-email"
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full rounded-xl bg-slate-50 px-3 py-3 text-sm ring-1 ring-slate-200 opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="pf-phone">
                    Số điện thoại
                  </label>
                  <input
                    id="pf-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    disabled={saving}
                    className="w-full rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] disabled:opacity-50"
                    placeholder="0912345678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="pf-address">
                    Địa chỉ
                  </label>
                  <textarea
                    id="pf-address"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    disabled={saving}
                    rows={3}
                    className="w-full rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] disabled:opacity-50"
                    placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
                  />
                </div>
                {saveErr && (
                  <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-100 rounded-lg px-3 py-2">
                    {saveErr}
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-200 text-slate-900 rounded-xl hover:bg-slate-300 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[var(--gov-blue)] text-white rounded-xl hover:bg-[var(--gov-red)] disabled:opacity-50"
                  >
                    {saving ? "Đang lưu…" : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="border-t border-slate-200 px-5 py-6 sm:px-6 bg-white">
            <Button
              type="button"
              variant="danger"
              className="w-full py-3 text-base font-bold"
              onClick={onLogout}
            >
              Đăng xuất
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full py-3 text-base font-bold mt-3 bg-red-700 hover:bg-red-800"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Xóa tài khoản
            </Button>
          </div>

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl max-w-sm w-full shadow-xl p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3">
                  Xóa tài khoản?
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                  Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteLoading}
                    className="flex-1 px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteAccount}
                    disabled={deleteLoading}
                    className="flex-1 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteLoading ? "Đang xóa…" : "Xóa tài khoản"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
