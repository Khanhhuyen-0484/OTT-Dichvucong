import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import GovHeader from "../components/GovHeader.jsx";
import { getApiErrorMessage, resetPassword } from "../lib/api.js";
import { getPasswordRequirementItems, getRegisterPasswordError } from "../lib/passwordStrength.js";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    <div className="min-h-screen bg-[#f4f8fd]">
      <GovHeader minimal />
      <main className="relative overflow-hidden px-4 py-8 sm:py-12">
        <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-sky-200/55 blur-3xl" />
        <div className="absolute right-0 top-36 h-96 w-96 rounded-full bg-blue-200/45 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl overflow-hidden rounded-[32px] border border-[#e5edf5] bg-white/76 shadow-2xl shadow-blue-950/10 backdrop-blur lg:grid-cols-[1fr_520px]">
          <aside className="relative overflow-hidden bg-gradient-to-br from-[#002b58] via-[#06477f] to-[#1280bd] p-8 text-white lg:p-10">
            <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex h-full min-h-[480px] flex-col justify-between gap-10">
              <div>
                <Link to="/" className="inline-flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#003366] shadow-lg">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-black">Cổng Dịch vụ công</div>
                    <div className="mt-1 text-xs font-semibold text-white/70">Bảo mật tài khoản công dân</div>
                  </div>
                </Link>

                <div className="mt-10 max-w-lg">
                  <h1 className="text-4xl font-black leading-tight">Thiết lập mật khẩu mới an toàn hơn</h1>
                  <p className="mt-4 text-sm leading-7 text-white/78">
                    Mật khẩu mạnh giúp bảo vệ hồ sơ, thông tin cá nhân và lịch sử giao dịch dịch vụ công trực tuyến.
                  </p>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/18 bg-white/12 p-5 shadow-2xl shadow-blue-950/20 backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/14 text-white ring-1 ring-white/20">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-black">Yêu cầu bảo mật</div>
                    <div className="mt-1 text-sm leading-6 text-white/70">
                      Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-[480px] rounded-[24px] border border-[#e5edf5] bg-white p-6 shadow-xl shadow-blue-950/8 sm:p-8">
              <div className="mb-6">
                <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-black text-[#003366] hover:text-blue-700">
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại đăng nhập
                </Link>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                  <KeyRound className="h-3.5 w-3.5" />
                  Đặt lại mật khẩu
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-[#0f2f57]">Tạo mật khẩu mới</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Nhập mật khẩu mới cho tài khoản của bạn. Link đặt lại mật khẩu chỉ có hiệu lực trong thời gian giới hạn.
                </p>
              </div>

              {message ? <MessageBox success={success} text={message} /> : null}

              {!token ? (
                <div className="space-y-4">
                  <MessageBox text="Link đặt lại mật khẩu không có token hoặc đã không hợp lệ." />
                  <Link to="/auth" className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-[#003366] to-[#0b5f9c] text-sm font-black text-white shadow-lg shadow-blue-950/15">
                    Về trang đăng nhập
                  </Link>
                </div>
              ) : success ? (
                <button
                  type="button"
                  onClick={() => navigate("/auth", { replace: true })}
                  className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-[#003366] to-[#0b5f9c] text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5"
                >
                  Đăng nhập ngay
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <PasswordField
                    label="Mật khẩu mới"
                    value={password}
                    onChange={setPassword}
                    visible={showPassword}
                    setVisible={setShowPassword}
                  />
                  <PasswordChecklist value={password} />
                  <PasswordField
                    label="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    visible={showConfirmPassword}
                    setVisible={setShowConfirmPassword}
                  />
                  <button
                    disabled={loading}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#003366] to-[#0b5f9c] px-4 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MessageBox({ success = false, text }) {
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div className={`mb-4 flex gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${success ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-rose-50 text-rose-800 ring-rose-100"}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, setVisible }) {
  return (
    <label className="block text-sm font-bold text-[#0f2f57]">
      {label}
      <div className="relative mt-1.5">
        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nhập mật khẩu"
          autoComplete="new-password"
          className="h-12 w-full rounded-[14px] border border-[#e5edf5] bg-white pl-11 pr-12 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-[#003366]"
          tabIndex={-1}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function PasswordChecklist({ value }) {
  const items = getPasswordRequirementItems(value);
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-[#e5edf5]">
      <div className="mb-2 text-xs font-black uppercase text-slate-500">Điều kiện mật khẩu</div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-2 text-sm font-semibold ${item.met ? "text-emerald-700" : "text-slate-500"}`}>
            <CheckCircle2 className={`h-4 w-4 ${item.met ? "text-emerald-600" : "text-slate-300"}`} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
