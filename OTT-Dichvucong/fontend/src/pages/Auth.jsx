import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Alert from "../components/Alert.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import {
  forgotPassword,
  getApiErrorMessage,
  login,
  register,
  resolvedApiBaseUrl,
  sendOtp
} from "../lib/api.js";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function secondsToLabel(s) {
  const n = Math.max(0, Number(s) || 0);
  return `${n}s`;
}

export default function Auth() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [registerStep, setRegisterStep] = useState(1); // 1 email, 2 otp+pass

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState({
    sendOtp: false,
    resendOtp: false,
    register: false,
    login: false,
    forgot: false
  });

  const [alert, setAlert] = useState(null); // {variant,title,message}

  const [resendLeft, setResendLeft] = useState(0);

  const resetForm = () => {
    setPassword("");
    setOtp("");
    setFullName("");
    setPhone("");
    setAddress("");
    setRegisterStep(1);
    setResendLeft(0);
    setAlert(null);
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setInterval(() => setResendLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendLeft]);

  const emailError = useMemo(() => {
    if (!email) return null;
    if (!emailRe.test(email)) return "Email không đúng định dạng";
    return null;
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự";
    return null;
  }, [password]);

  const otpError = useMemo(() => {
    if (!otp) return null;
    const digits = otp.replace(/\D/g, "");
    if (digits.length !== 6) return "OTP gồm đúng 6 chữ số";
    return null;
  }, [otp]);

  const fullNameError = useMemo(() => {
    if (!fullName.trim()) return null;
    if (fullName.trim().length < 2) return "Họ và tên ít nhất 2 ký tự";
    return null;
  }, [fullName]);

  const phoneError = useMemo(() => {
    if (!phone.trim()) return null;
    let d = phone.replace(/\D/g, "");
    if (d.startsWith("84")) d = d.slice(2);
    if (!d.startsWith("0") && d.length === 9) d = `0${d}`;
    if (d.length < 10 || d.length > 11) return "SĐT không hợp lệ (vd: 0912345678)";
    return null;
  }, [phone]);

  const canSendOtp = email && !emailError;
  const canRegister =
    email &&
    password &&
    fullName.trim().length >= 2 &&
    phone.trim() &&
    otp.replace(/\D/g, "").length === 6 &&
    !emailError &&
    !passwordError &&
    !otpError &&
    !fullNameError &&
    !phoneError;
  const canLogin = email && password && !emailError && !passwordError;

  const handleSendOtp = async () => {
    setAlert(null);
    if (!canSendOtp) {
      setAlert({
        variant: "error",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập email hợp lệ."
      });
      return;
    }

    setLoading((x) => ({ ...x, sendOtp: true }));
    try {
      const res = await sendOtp(email.trim());
      setAlert({
        variant: "success",
        title: "Đã gửi OTP",
        message: res?.data?.message || "Vui lòng kiểm tra email để lấy mã OTP."
      });
      setRegisterStep(2);
      setResendLeft(60);
    } catch (err) {
      console.error(err);
      setAlert({
        variant: "error",
        title: "Gửi OTP thất bại",
        message: getApiErrorMessage(err)
      });
    } finally {
      setLoading((x) => ({ ...x, sendOtp: false }));
    }
  };

  const handleResendOtp = async () => {
    setAlert(null);
    if (resendLeft > 0) return;
    setLoading((x) => ({ ...x, resendOtp: true }));
    try {
      const res = await sendOtp(email.trim());
      setAlert({
        variant: "success",
        title: "Đã gửi lại OTP",
        message: res?.data?.message || "Vui lòng kiểm tra email."
      });
      setResendLeft(60);
    } catch (err) {
      console.error(err);
      setAlert({
        variant: "error",
        title: "Gửi lại OTP thất bại",
        message: getApiErrorMessage(err)
      });
    } finally {
      setLoading((x) => ({ ...x, resendOtp: false }));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!canRegister) {
      setAlert({
        variant: "error",
        title: "Thiếu thông tin",
        message:
          "Kiểm tra: họ tên (≥2 ký tự), số điện thoại, email, OTP 6 số, mật khẩu (≥6 ký tự)."
      });
      return;
    }
    setLoading((x) => ({ ...x, register: true }));
    try {
      const res = await register({
        email: email.trim(),
        otp: otp.replace(/\D/g, ""),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim()
      });
      setAlert({
        variant: "success",
        title: "Đăng ký thành công",
        message: res?.data?.message || "Bạn có thể đăng nhập ngay bây giờ."
      });
      setMode("login");
    } catch (err) {
      console.error(err);
      setAlert({
        variant: "error",
        title: "Đăng ký thất bại",
        message: getApiErrorMessage(err)
      });
    } finally {
      setLoading((x) => ({ ...x, register: false }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!canLogin) {
      setAlert({
        variant: "error",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập email và mật khẩu hợp lệ."
      });
      return;
    }
    setLoading((x) => ({ ...x, login: true }));
    try {
      const res = await login({ email: email.trim(), password });
      const token = res?.data?.token ?? res?.data?.accessToken;
      if (token) {
        await loginWithToken(token);
        navigate("/", { replace: true });
      } else {
        setAlert({
          variant: "error",
          title: "Đăng nhập thất bại",
          message: "Không nhận được token từ server."
        });
      }
    } catch (err) {
      console.error(err);
      setAlert({
        variant: "error",
        title: "Đăng nhập thất bại",
        message: getApiErrorMessage(err)
      });
    } finally {
      setLoading((x) => ({ ...x, login: false }));
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!canSendOtp) {
      setAlert({
        variant: "error",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập email hợp lệ."
      });
      return;
    }
    setLoading((x) => ({ ...x, forgot: true }));
    try {
      const res = await forgotPassword(email.trim());
      setAlert({
        variant: "success",
        title: "Yêu cầu đã được tiếp nhận",
        message:
          res?.data?.message ||
          "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu."
      });
    } catch (err) {
      console.error(err);
      setAlert({
        variant: "error",
        title: "Thất bại",
        message: getApiErrorMessage(err)
      });
    } finally {
      setLoading((x) => ({ ...x, forgot: false }));
    }
  };

  return (
    <div className="min-h-screen">
      <GovHeader />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600">
                    Tài khoản công dân
                  </div>
                  <h1 className="text-xl font-black text-slate-900">
                    {mode === "login"
                      ? "Đăng nhập"
                      : mode === "register"
                        ? "Đăng ký"
                        : "Quên mật khẩu"}
                  </h1>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    className={`text-sm font-semibold rounded-lg px-3 py-2 ring-1 ${
                      mode === "login"
                        ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]"
                        : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setMode("login")}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    className={`text-sm font-semibold rounded-lg px-3 py-2 ring-1 ${
                      mode === "register"
                        ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]"
                        : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setMode("register")}
                  >
                    Đăng ký
                  </button>
                  <button
                    type="button"
                    className={`text-sm font-semibold rounded-lg px-3 py-2 ring-1 ${
                      mode === "forgot"
                        ? "bg-[var(--gov-red)] text-white ring-[var(--gov-red)]"
                        : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setMode("forgot")}
                  >
                    Quên mật khẩu
                  </button>
                </div>
              </div>

              <div className="sm:hidden mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`text-sm font-semibold rounded-lg px-3 py-2 ring-1 ${
                    mode === "login"
                      ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]"
                      : "bg-white text-slate-800 ring-slate-200"
                  }`}
                  onClick={() => setMode("login")}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  className={`text-sm font-semibold rounded-lg px-3 py-2 ring-1 ${
                    mode === "register"
                      ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]"
                      : "bg-white text-slate-800 ring-slate-200"
                  }`}
                  onClick={() => setMode("register")}
                >
                  Đăng ký
                </button>
                <button
                  type="button"
                  className={`text-sm font-semibold rounded-lg px-3 py-2 ring-1 ${
                    mode === "forgot"
                      ? "bg-[var(--gov-red)] text-white ring-[var(--gov-red)]"
                      : "bg-white text-slate-800 ring-slate-200"
                  }`}
                  onClick={() => setMode("forgot")}
                >
                  Quên MK
                </button>
              </div>

              <div className="mt-4">
                <Alert
                  variant={alert?.variant}
                  title={alert?.title}
                  message={alert?.message}
                  onClose={() => setAlert(null)}
                />
              </div>

              {mode === "login" ? (
                <form onSubmit={handleLogin} className="mt-4 space-y-4">
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={emailError}
                    required
                  />
                  <Input
                    label="Mật khẩu"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={passwordError}
                    required
                  />
                  <div className="flex items-center justify-between gap-3">
                    <Button type="submit" loading={loading.login}>
                      Đăng nhập
                    </Button>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--gov-red)] underline underline-offset-2"
                      onClick={() => setMode("forgot")}
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                </form>
              ) : null}

              {mode === "register" ? (
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        registerStep === 1
                          ? "bg-[var(--gov-navy)]"
                          : "bg-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                    Bước 1: Email
                    <span className="mx-1 text-slate-300">/</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        registerStep === 2
                          ? "bg-[var(--gov-navy)]"
                          : "bg-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                    Bước 2: Thông tin + OTP + mật khẩu
                  </div>

                  {registerStep === 1 ? (
                    <div className="mt-4 space-y-4">
                      <Input
                        label="Email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={emailError}
                        required
                      />
                      <Button
                        type="button"
                        loading={loading.sendOtp}
                        onClick={handleSendOtp}
                      >
                        Gửi OTP
                      </Button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleRegister}
                      className="mt-4 space-y-4"
                      noValidate
                    >
                      <Input
                        label="Họ và tên"
                        name="fullName"
                        autoComplete="name"
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        error={fullNameError}
                        required
                      />
                      <Input
                        label="Số điện thoại"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="0912345678"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        error={phoneError}
                        required
                      />
                      <Input
                        label="Địa chỉ liên hệ (tùy chọn)"
                        name="address"
                        autoComplete="street-address"
                        placeholder="Phường/Xã, Quận/Huyện, Tỉnh/TP"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                      <Input
                        label="Email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={emailError}
                        required
                      />
                      <Input
                        label="Mã OTP (6 số)"
                        name="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        maxLength={6}
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        error={otpError}
                        required
                        hint="Nhập đúng 6 chữ số trong email. Không dùng khoảng trắng."
                      />
                      <Input
                        label="Mật khẩu"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={passwordError}
                        required
                      />

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <Button type="submit" loading={loading.register}>
                          Xác minh &amp; Đăng ký
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          loading={loading.resendOtp}
                          disabled={resendLeft > 0}
                          onClick={handleResendOtp}
                        >
                          {resendLeft > 0
                            ? `Gửi lại OTP (${secondsToLabel(resendLeft)})`
                            : "Gửi lại OTP"}
                        </Button>
                      </div>

                      <button
                        type="button"
                        className="text-sm font-semibold text-slate-700 underline underline-offset-2"
                        onClick={() => {
                          setRegisterStep(1);
                          setOtp("");
                          setPassword("");
                          setFullName("");
                          setPhone("");
                          setAddress("");
                          setResendLeft(0);
                        }}
                      >
                        Quay lại bước 1
                      </button>
                    </form>
                  )}
                </div>
              ) : null}

              {mode === "forgot" ? (
                <form onSubmit={handleForgot} className="mt-4 space-y-4">
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={emailError}
                    required
                    hint="Chúng tôi sẽ gửi liên kết đặt lại mật khẩu (nếu email tồn tại)."
                  />
                  <Button type="submit" variant="danger" loading={loading.forgot}>
                    Gửi yêu cầu đặt lại mật khẩu
                  </Button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
              <div className="text-xs font-semibold text-slate-600">
                Lưu ý bảo mật
              </div>
              <h2 className="mt-1 text-lg font-black text-slate-900">
                Xác thực OTP &amp; email thông báo
              </h2>
              <div className="mt-3 text-sm text-slate-700 space-y-2">
                <p>
                  - OTP có hiệu lực <span className="font-semibold">5 phút</span>.
                </p>
                <p>
                  - Nút <span className="font-semibold">Gửi lại OTP</span> có{" "}
                  <span className="font-semibold">đếm ngược 60 giây</span>.
                </p>
                <p>
                  - Email đặt lại mật khẩu sẽ chứa liên kết có thời hạn (JWT,{" "}
                  <span className="font-semibold">15 phút</span>).
                </p>
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
                <div className="text-sm font-extrabold text-slate-900">
                  Trạng thái tích hợp API
                </div>
                <div className="mt-1 text-sm text-slate-700 break-words">
                  Backend base URL (axios):{" "}
                  <span className="font-semibold">{resolvedApiBaseUrl}</span>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Bạn có thể thay đổi bằng biến môi trường{" "}
                  <span className="font-semibold">VITE_API_BASE_URL</span>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

