import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { forgotPassword, getApiErrorMessage, login, register, sendOtp } from "../lib/api.js";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function reset(nextMode) {
    setMode(nextMode);
    setPassword("");
    setOtp("");
    setFullName("");
    setPhone("");
    setAddress("");
    setMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!emailRe.test(email)) return setMessage("Email không đúng định dạng");
    if (password.length < 6) return setMessage("Mật khẩu phải có ít nhất 6 ký tự");
    setLoading(true);
    setMessage("");
    try {
      const res = await login({ email, password });
      const token = res?.data?.token ?? res?.data?.accessToken;
      if (!token) throw new Error("Không nhận được token từ server");
      const role = decodeRoleFromToken(token);
      await loginWithToken(token);
      navigate(role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!emailRe.test(email)) return setMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    try {
      await sendOtp(email);
      setMessage("Đã gửi mã OTP đến email của bạn");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!emailRe.test(email)) return setMessage("Email không đúng định dạng");
    if (!fullName.trim()) return setMessage("Vui lòng nhập họ tên");
    if (password.length < 8) return setMessage("Mật khẩu đăng ký phải có ít nhất 8 ký tự");
    if (otp.replace(/\D/g, "").length !== 6) return setMessage("OTP gồm đúng 6 chữ số");
    setLoading(true);
    setMessage("");
    try {
      await register({ email, password, otp, fullName, phone, address });
      setMessage("Đăng ký thành công. Bạn có thể đăng nhập.");
      setMode("login");
      setPassword("");
      setOtp("");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event) {
    event.preventDefault();
    if (!emailRe.test(email)) return setMessage("Email không đúng định dạng");
    setLoading(true);
    setMessage("");
    try {
      await forgotPassword(email);
      setMessage("Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.");
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
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              {mode === "login" ? "Đăng nhập" : mode === "register" ? "Đăng ký" : "Quên mật khẩu"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">Sử dụng tài khoản để nộp hồ sơ, theo dõi trạng thái và nhận thông báo xử lý.</p>
          </div>

          {message ? <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-100">{message}</div> : null}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Mật khẩu" value={password} onChange={setPassword} type="password" />
              <SubmitButton loading={loading}>Đăng nhập</SubmitButton>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <div className="flex gap-2">
                <Field label="OTP" value={otp} onChange={setOtp} />
                <button type="button" disabled={loading} onClick={handleSendOtp} className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50">
                  Gửi OTP
                </button>
              </div>
              <Field label="Họ tên" value={fullName} onChange={setFullName} />
              <Field label="Số điện thoại" value={phone} onChange={setPhone} />
              <Field label="Địa chỉ" value={address} onChange={setAddress} />
              <Field label="Mật khẩu" value={password} onChange={setPassword} type="password" />
              <SubmitButton loading={loading}>Đăng ký</SubmitButton>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <SubmitButton loading={loading}>Gửi hướng dẫn</SubmitButton>
            </form>
          )}

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
            {mode !== "login" ? <button type="button" onClick={() => reset("login")} className="text-[#003366]">Đăng nhập</button> : null}
            {mode !== "register" ? <button type="button" onClick={() => reset("register")} className="text-[#003366]">Tạo tài khoản</button> : null}
            {mode !== "forgot" ? <button type="button" onClick={() => reset("forgot")} className="text-slate-600">Quên mật khẩu?</button> : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block flex-1 text-sm font-bold text-slate-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-[#003366]" />
    </label>
  );
}

function SubmitButton({ loading, children }) {
  return (
    <button disabled={loading} className="w-full rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
      {loading ? "Đang xử lý..." : children}
    </button>
  );
}
