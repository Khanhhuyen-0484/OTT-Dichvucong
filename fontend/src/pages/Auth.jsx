import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Bot,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import GovHeader from "../components/GovHeader.jsx";
import RegisterPasswordField from "../components/RegisterPasswordField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { forgotPassword, getApiErrorMessage, login, register, sendOtp } from "../lib/api.js";
import { getRegisterPasswordError } from "../lib/passwordStrength.js";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^0\d{9,10}$/;

function decodeRoleFromToken(token) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return "citizen";
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.role === "admin" ? "admin" : "citizen";
  } catch {
    return "citizen";
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [address, setAddress] = useState("");
  const [remember, setRemember] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [resetLink, setResetLink] = useState("");

  function showMessage(text, type = "error") {
    setMessage(text);
    setMessageType(type);
  }

  function reset(nextMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setFullName("");
    setPhone("");
    setCitizenId("");
    setAddress("");
    setAcceptedTerms(false);
    setMessage("");
    setMessageType("info");
    setResetLink("");
  }

  function validateLogin() {
    const value = email.trim();
    if (!value) return "Vui lòng nhập email hoặc số điện thoại";
    if (!emailRe.test(value) && !phoneRe.test(value)) return "Email hoặc số điện thoại không đúng định dạng";
    if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự";
    return "";
  }

  function validateRegister() {
    if (!fullName.trim()) return "Vui lòng nhập họ và tên";
    if (!emailRe.test(email.trim())) return "Email không đúng định dạng";
    if (!phoneRe.test(phone.trim())) return "Số điện thoại không đúng định dạng";
    if (citizenId && !/^\d{9,12}$/.test(citizenId.trim())) return "CCCD/CMND phải có từ 9 đến 12 chữ số";
    const passwordError = getRegisterPasswordError(password);
    if (passwordError) return passwordError;
    if (password !== confirmPassword) return "Xác nhận mật khẩu không khớp";
    if (otp.replace(/\D/g, "").length !== 6) return "OTP gồm đúng 6 chữ số";
    if (!acceptedTerms) return "Vui lòng đồng ý điều khoản sử dụng";
    return "";
  }

  async function handleLogin(event) {
    event.preventDefault();
    const validationError = validateLogin();
    if (validationError) return showMessage(validationError);
    setLoading(true);
    setMessage("");
    try {
      const res = await login({ email: email.trim(), password });
      const token = res?.data?.token ?? res?.data?.accessToken;
      if (!token) throw new Error("Không nhận được token từ server");
      const role = decodeRoleFromToken(token);
      await loginWithToken(token);
      navigate(role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!emailRe.test(email.trim())) return showMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    try {
      await sendOtp(email.trim());
      showMessage("Đã gửi mã OTP đến email của bạn", "success");
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const validationError = validateRegister();
    if (validationError) return showMessage(validationError);
    setLoading(true);
    setMessage("");
    try {
      await register({
        email: email.trim(),
        password,
        otp,
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim() || citizenId.trim(),
      });
      showMessage("Đăng ký thành công. Bạn có thể đăng nhập.", "success");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event) {
    event.preventDefault();
    if (!emailRe.test(email.trim())) return showMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    setResetLink("");
    try {
      const res = await forgotPassword(email.trim());
      const link = res?.data?.resetUrl || "";
      if (link) {
        setResetLink(link);
        showMessage("Không gửi được email từ máy chủ deploy. Bạn có thể mở link đặt lại mật khẩu bên dưới.", "success");
      } else {
        showMessage("Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.", "success");
      }
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotOtp(event) {
    event.preventDefault();
    if (!emailRe.test(email.trim())) return showMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    setResetLink("");
    try {
      const emailNorm = email.trim().toLowerCase();
      await forgotPassword(emailNorm);
      navigate(`/reset-password?email=${encodeURIComponent(emailNorm)}`, { replace: true });
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotOtpClean(event) {
    event.preventDefault();
    if (!emailRe.test(email.trim())) return showMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    setResetLink("");
    try {
      const emailNorm = email.trim().toLowerCase();
      await forgotPassword(emailNorm);
      navigate(`/reset-password?email=${encodeURIComponent(emailNorm)}`, { replace: true });
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotOtpFallback(event) {
    event.preventDefault();
    if (!emailRe.test(email.trim())) return showMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    setResetLink("");
    try {
      const emailNorm = email.trim().toLowerCase();
      await forgotPassword(emailNorm);
      navigate(`/reset-password?email=${encodeURIComponent(emailNorm)}`, { replace: true });
    } catch (error) {
      showMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

  return (
    <div className="min-h-screen bg-[#f4f8fd]">
      <GovHeader minimal />
      <main className="relative overflow-hidden px-4 py-8 sm:py-12">
        <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-sky-200/55 blur-3xl" />
        <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-100/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl overflow-hidden rounded-[32px] border border-[#e5edf5] bg-white/76 shadow-2xl shadow-blue-950/10 backdrop-blur lg:grid-cols-[1fr_520px]">
          <BrandPanel />

          <section className="flex items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-[480px] rounded-[24px] border border-[#e5edf5] bg-white p-6 shadow-xl shadow-blue-950/8 sm:p-8">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tài khoản dịch vụ công
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0f2f57]">
                  {isLogin ? "Đăng nhập hệ thống" : isRegister ? "Tạo tài khoản công dân" : "Quên mật khẩu"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isLogin
                    ? "Truy cập tài khoản để nộp hồ sơ, theo dõi tiến độ và nhận hỗ trợ trực tuyến."
                    : isRegister
                      ? "Đăng ký tài khoản để sử dụng các dịch vụ công trực tuyến."
                      : "Nhập email đã đăng ký để nhận mã OTP đặt lại mật khẩu."}
                </p>
              </div>

              {message ? <MessageBox type={messageType} text={message} /> : null}
              {resetLink ? (
                <a
                  href={resetLink}
                  className="mb-4 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  Mở trang đặt lại mật khẩu
                </a>
              ) : null}

              {isLogin ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field icon={Mail} label="Email hoặc số điện thoại" value={email} onChange={setEmail} type="text" placeholder="email@domain.vn hoặc 09xxxxxxxx" />
                  <PasswordField icon={LockKeyhole} label="Mật khẩu" value={password} onChange={setPassword} visible={showPassword} setVisible={setShowPassword} autoComplete="current-password" />
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <label className="inline-flex items-center gap-2 font-semibold text-slate-600">
                      <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#003366]" />
                      Ghi nhớ đăng nhập
                    </label>
                    <button type="button" onClick={() => reset("forgot")} className="font-black text-[#003366] hover:text-blue-700">
                      Quên mật khẩu?
                    </button>
                  </div>
                  <SubmitButton loading={loading}>Đăng nhập</SubmitButton>
                </form>
              ) : null}

              {isRegister ? (
                <form onSubmit={handleRegister} className="space-y-4">
                  <Field icon={User} label="Họ và tên" value={fullName} onChange={setFullName} placeholder="Nguyễn Văn A" />
                  <Field icon={Mail} label="Email" value={email} onChange={setEmail} type="email" placeholder="email@domain.vn" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field icon={Phone} label="Số điện thoại" value={phone} onChange={setPhone} placeholder="09xxxxxxxx" />
                    <Field icon={BadgeCheck} label="CCCD/CMND" value={citizenId} onChange={setCitizenId} placeholder="Nhập số giấy tờ" />
                  </div>
                  <div className="flex gap-2">
                    <Field icon={KeyRound} label="OTP email" value={otp} onChange={setOtp} placeholder="6 chữ số" />
                    <button type="button" disabled={loading} onClick={handleSendOtp} className="mt-6 inline-flex h-12 shrink-0 items-center gap-2 rounded-[14px] bg-slate-100 px-4 text-sm font-black text-[#0f2f57] ring-1 ring-[#e5edf5] transition hover:bg-blue-50 disabled:opacity-50">
                      <Send className="h-4 w-4" />
                      Gửi OTP
                    </button>
                  </div>
                  <RegisterPasswordField
                    label="Mật khẩu"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={getRegisterPasswordError(password)}
                    required
                  />
                  <PasswordField icon={LockKeyhole} label="Nhập lại mật khẩu" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} setVisible={setShowConfirmPassword} autoComplete="new-password" />
                  <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-[#e5edf5]">
                    <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#003366]" />
                    Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của Cổng Dịch vụ công.
                  </label>
                  <SubmitButton loading={loading}>Tạo tài khoản</SubmitButton>
                </form>
              ) : null}

              {isForgot ? (
                <form onSubmit={handleForgotOtpFallback} className="space-y-4">
                  <Field icon={Mail} label="Email đã đăng ký" value={email} onChange={setEmail} type="email" placeholder="email@domain.vn" />
                  <SubmitButton loading={loading}>Gửi OTP</SubmitButton>
                </form>
              ) : null}

              <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm font-semibold text-slate-600">
                {isLogin ? (
                  <>
                    Chưa có tài khoản?{" "}
                    <button type="button" onClick={() => reset("register")} className="font-black text-[#003366] hover:text-blue-700">
                      Đăng ký ngay
                    </button>
                  </>
                ) : (
                  <>
                    Đã có tài khoản?{" "}
                    <button type="button" onClick={() => reset("login")} className="font-black text-[#003366] hover:text-blue-700">
                      Đăng nhập
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  const benefits = [
    { title: "Nộp hồ sơ trực tuyến", desc: "Thực hiện thủ tục mọi lúc, giảm thời gian chờ đợi.", icon: FileText },
    { title: "Theo dõi trạng thái realtime", desc: "Tra cứu tiến độ xử lý và nhận thông báo kịp thời.", icon: BadgeCheck },
    { title: "Chat AI và cán bộ hỗ trợ", desc: "Được hướng dẫn nhanh khi chuẩn bị và bổ sung hồ sơ.", icon: Bot },
  ];

  return (
    <aside className="relative overflow-hidden bg-gradient-to-br from-[#002b58] via-[#06477f] to-[#1280bd] p-8 text-white lg:p-10">
      <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex h-full min-h-[520px] flex-col justify-between gap-10">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#003366] shadow-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-black">Cổng Dịch vụ công</div>
              <div className="mt-1 text-xs font-semibold text-white/70">Nhanh chóng - Minh bạch - Thuận tiện</div>
            </div>
          </Link>

          <div className="mt-10 max-w-lg">
            <h2 className="text-4xl font-black leading-tight">Một tài khoản cho toàn bộ dịch vụ công trực tuyến</h2>
            <p className="mt-4 text-sm leading-7 text-white/78">
              Quản lý hồ sơ, thanh toán lệ phí, nhận thông báo và kết nối hỗ trợ trên nền tảng dịch vụ công số.
            </p>
          </div>

          <div className="mt-8 grid gap-3">
            {benefits.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/16 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/14 text-white ring-1 ring-white/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-black">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-white/70">{item.desc}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/18 bg-white/12 p-5 shadow-2xl shadow-blue-950/20 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)]" />
            <div>
              <div className="font-black">Hệ thống đang hoạt động 24/7</div>
              <div className="mt-1 text-sm text-white/70">AI hỗ trợ trực tuyến, tra cứu hồ sơ realtime.</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MessageBox({ type, text }) {
  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  return (
    <div className={`mb-4 flex gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${isSuccess ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-rose-50 text-rose-800 ring-rose-100"}`}>
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

function PasswordField({ icon: Icon, label, value, onChange, visible, setVisible, autoComplete }) {
  return (
    <label className="block text-sm font-bold text-[#0f2f57]">
      {label}
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder="Nhập mật khẩu"
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

function SubmitButton({ loading, children }) {
  return (
    <button
      disabled={loading}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#003366] to-[#0b5f9c] px-4 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {loading ? "Đang xử lý..." : children}
    </button>
  );
}
