import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import RegisterPasswordField from "../components/RegisterPasswordField.jsx";
import { getApiErrorMessage, resetPassword } from "../lib/api.js";
import { getRegisterPasswordError } from "../lib/passwordStrength.js";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token) return setMessage("Link đặt lại mật khẩu không hợp lệ.");
    const passwordError = getRegisterPasswordError(password);
    if (passwordError) return setMessage(passwordError);
    if (password !== confirmPassword) return setMessage("Mật khẩu nhập lại không khớp.");

    setLoading(true);
    setMessage("");
    try {
      await resetPassword({ token, password });
      setSuccess(true);
      setMessage("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <GovHeader />
      <main className="mx-auto flex max-w-5xl items-start justify-center px-4 py-10">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-sm font-bold uppercase tracking-wide text-[#003366]">Tài khoản công dân</div>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Đặt lại mật khẩu</h1>
            <p className="mt-2 text-sm text-slate-600">Nhập mật khẩu mới cho tài khoản của bạn.</p>
          </div>

          {message ? (
            <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${success ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-blue-50 text-blue-800 ring-blue-100"}`}>
              {message}
            </div>
          ) : null}

          {!token ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                Link đặt lại mật khẩu không có token.
              </div>
              <Link to="/auth" className="block rounded-xl bg-[#003366] px-4 py-3 text-center text-sm font-bold text-white">
                Quay lại đăng nhập
              </Link>
            </div>
          ) : success ? (
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="w-full rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white"
            >
              Đăng nhập
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <RegisterPasswordField
                label="Mật khẩu mới"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Nhập mật khẩu mới"
              />
              <Field label="Nhập lại mật khẩu mới" value={confirmPassword} onChange={setConfirmPassword} />
              <button disabled={loading} className="w-full rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-[#003366]"
      />
    </label>
  );
}
