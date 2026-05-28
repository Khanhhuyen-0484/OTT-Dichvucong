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
  Mail,
  ShieldCheck,
} from "lucide-react";
import GovHeader from "../components/GovHeader.jsx";
import RegisterPasswordField from "../components/RegisterPasswordField.jsx";
import { forgotPassword, getApiErrorMessage, resetPassword } from "../lib/api.js";
import { getRegisterPasswordError } from "../lib/passwordStrength.js";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const initialOtp = useMemo(() => searchParams.get("otp") || "", [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialOtp);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState(
    initialOtp
      ? `SMTP đang bị chặn trên server deploy. Dùng OTP tạm thời: ${initialOtp}`
      : initialEmail
        ? "Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư."
        : ""
  );
  const [success, setSuccess] = useState(Boolean(initialEmail));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleResendOtp() {
    if (!emailRe.test(email.trim())) return setMessage("Email không đúng định dạng.");
    setResending(true);
    setMessage("");
    setSuccess(false);
    try {
      const emailNorm = email.trim().toLowerCase();
      const res = await forgotPassword(emailNorm);
      setEmail(emailNorm);
      if (res?.data?.otp) {
        setOtp(String(res.data.otp));
        setMessage(`SMTP đang bị chặn trên server deploy. Dùng OTP tạm thời: ${res.data.otp}`);
      } else {
        setMessage("Đã gửi lại mã OTP đặt lại mật khẩu tới email.");
      }
      setSuccess(true);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
      setSuccess(false);
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!emailRe.test(email.trim())) return setMessage("Email không đúng định dạng.");
    if (otp.replace(/\D/g, "").length !== 6) return setMessage("OTP gồm đúng 6 chữ số.");
    const passwordError = getRegisterPasswordError(password);
    if (passwordError) return setMessage(passwordError);
    if (password !== confirmPassword) return setMessage("Mật khẩu nhập lại không khớp.");

    setLoading(true);
    setMessage("");
    setSuccess(false);
    try {
      await resetPassword({ email: email.trim().toLowerCase(), otp, password });
      setSuccess(true);
      setMessage("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
      setSuccess(false);
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
                  <h1 className="text-4xl font-black leading-tight">Đặt lại mật khẩu bằng mã OTP</h1>
                  <p className="mt-4 text-sm leading-7 text-white/78">
                    Mã OTP được gửi về email đã đăng ký và chỉ có hiệu lực trong thời gian ngắn để bảo vệ tài khoản của bạn.
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
                      Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.
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
                <h2 className="mt-4 text-3xl font-black tracking-tight text-[#0f2f57]">Nhập OTP và mật khẩu mới</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Kiểm tra email đã đăng ký, nhập mã OTP 6 chữ số và tạo mật khẩu mới cho tài khoản.
                </p>
              </div>

              {message ? <MessageBox success={success} text={message} /> : null}

              {success && message.includes("thành công") ? (
                <button
                  type="button"
                  onClick={() => navigate("/auth", { replace: true })}
                  className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-[#003366] to-[#0b5f9c] text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5"
                >
                  Đăng nhập ngay
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field icon={Mail} label="Email đã đăng ký" value={email} onChange={setEmail} type="email" placeholder="email@domain.vn" />
                  <div className="flex gap-2">
                    <Field icon={KeyRound} label="Mã OTP" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} placeholder="6 chữ số" />
                    <button
                      type="button"
                      disabled={resending}
                      onClick={handleResendOtp}
                      className="mt-6 h-12 shrink-0 rounded-[14px] bg-slate-100 px-4 text-sm font-black text-[#0f2f57] ring-1 ring-[#e5edf5] transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      {resending ? "Đang gửi..." : "Gửi lại"}
                    </button>
                  </div>
                  <RegisterPasswordField
                    label="Mật khẩu mới"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={getRegisterPasswordError(password)}
                    required
                  />
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

function Field({ icon: Icon, label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block flex-1 text-sm font-bold text-[#0f2f57]">
      {label}
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-[14px] border border-[#e5edf5] bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </div>
    </label>
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
