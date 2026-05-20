const otpByEmail = new Map(); // email -> { otp, expiresAtMs }

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function setOtp(email, otp, ttlMs) {
  const key = normalizeEmail(email);
  otpByEmail.set(key, { otp, expiresAtMs: Date.now() + ttlMs });
}

function getOtpRecord(email) {
  const key = normalizeEmail(email);
  const rec = otpByEmail.get(key);
  if (!rec) return null;
  if (rec.expiresAtMs < Date.now()) {
    otpByEmail.delete(key);
    return null;
  }
  return rec;
}

function verifyOtp(email, otp) {
  const rec = getOtpRecord(email);
  if (!rec) return { ok: false, reason: "NOT_FOUND" };
  const incoming = String(otp).replace(/\D/g, "");
  if (incoming.length !== 6 || String(rec.otp) !== incoming) {
    return { ok: false, reason: "MISMATCH" };
  }
  return { ok: true };
}

function consumeOtp(email) {
  otpByEmail.delete(normalizeEmail(email));
}

// Best-effort cleanup
setInterval(() => {
  const now = Date.now();
  for (const [email, rec] of otpByEmail.entries()) {
    if (!rec || rec.expiresAtMs < now) otpByEmail.delete(email);
  }
}, 60_000).unref?.();

module.exports = { generateOtp, setOtp, verifyOtp, consumeOtp };

