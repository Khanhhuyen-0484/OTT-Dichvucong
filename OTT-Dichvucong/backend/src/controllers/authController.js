const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendMail, serializeSmtpError } = require("../config/mailer");
const { otpEmail, resetPasswordEmail } = require("../emails/templates");
const { validateRegisterPassword } = require("../utils/passwordStrength");
const { generateOtp, setOtp, verifyOtp, consumeOtp } = require("../store/otpStore");
const {
  findByEmail,
  findById,
  createUser,
  updateUserById,
  deleteUserById,
  updatePasswordHashById
} = require("../store/userStore");
const path = require("path");
const { createPresignedPut, isS3Configured } = require("../config/s3");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function normalizePublicUser(u) {
  if (!u) return null;
  const av = u.avatarUrl != null && String(u.avatarUrl).trim();
  return {
    id: u.id,
    email: u.email || "",
    fullName: u.fullName != null ? String(u.fullName) : "",
    phone: u.phone != null ? String(u.phone) : "",
    address: u.address != null ? String(u.address) : "",
    role: u.role === "admin" ? "admin" : "citizen",
    avatarUrl: av ? String(av).trim() : null,
    createdAt: u.createdAt
  };
}

// g?i OTP
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email kh�ng h?p l?" });
  }

  const otp = generateOtp();
  const to = String(email).trim().toLowerCase();

  try {
    const html = otpEmail({ otp, minutes: 5 });
    await sendMail({
      to,
      subject: "M� OTP x�c minh ??ng k�",
      html,
      text: `M� OTP c?a b?n: ${otp} (hi?u l?c 5 ph�t).`
    });
    // Ch? l?u OTP khi g?i mail th�nh c�ng
    setOtp(to, otp, 5 * 60_000);
  } catch (err) {
    console.error("SEND OTP FAILED ?", err?.message, err);
    const smtp = serializeSmtpError(err);
    return res.status(500).json({
      message:
        "Kh�ng g?i ???c email. Ki?m tra Gmail: b?t 2FA, t?o App Password 16 k� t?, EMAIL_USER kh?p t�i kho?n g?i.",
      error: err.message,
      smtp
    });
  }

  res.json({ message: "OTP ?� ???c g?i t?i email" });
};

// verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const result = verifyOtp(email, otp);
  if (!result.ok) {
    return res.status(400).json({
      message: result.reason === "NOT_FOUND" ? "OTP kh�ng t?n t?i ho?c ?� h?t h?n" : "OTP kh�ng ?�ng"
    });
  }

  res.json({ message: "OTP h?p l?" });
};

// register
exports.register = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email kh�ng h?p l?" });
    }
    const passwordCheck = validateRegisterPassword(password);
    if (!passwordCheck.ok) {
      return res.status(400).json({ message: passwordCheck.message });
    }
    if (!otp || typeof otp !== "string") {
      return res.status(400).json({ message: "OTP kh�ng h?p l?" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";

    if (fullName.length < 2) {
      return res.status(400).json({ message: "H? v� t�n �t nh?t 2 k� t?" });
    }
    let phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.startsWith("84") && phoneDigits.length >= 10) {
      phoneDigits = phoneDigits.slice(2);
    }
    if (phoneDigits.startsWith("0")) {
      /* ok */
    } else if (phoneDigits.length === 9) {
      phoneDigits = `0${phoneDigits}`;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return res.status(400).json({ message: "S? ?i?n tho?i kh�ng h?p l? (v� d?: 0912345678)" });
    }

    const existing = await findByEmail(emailNorm);
    if (existing) {
      return res.status(400).json({ message: "Email ?� ???c ??ng k�" });
    }

    const result = verifyOtp(emailNorm, otp);
    if (!result.ok) {
      return res.status(400).json({
        message: result.reason === "NOT_FOUND" ? "OTP kh�ng t?n t?i ho?c ?� h?t h?n" : "OTP sai"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await createUser({
      email: emailNorm,
      passwordHash: hashedPassword,
      fullName,
      phone: phoneDigits,
      address
    });
    consumeOtp(emailNorm);

    const { passwordHash: _, ...safe } = user;
    res.json({ message: "??ng k� th�nh c�ng", user: normalizePublicUser(safe) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// th�ng tin t�i kho?n (JWT)
exports.me = async (req, res) => {
  try {
    const user = await findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "T�i kho?n kh�ng t?n t?i" });
    }
    const { passwordHash, ...safe } = user;
    res.json(normalizePublicUser(safe));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** C?p nh?t h? s? (t�n, S?T, ??a ch?, avatarUrl). */
exports.patchMe = async (req, res) => {
  try {
    const existing = await findById(req.user.id);
    if (!existing) {
      return res.status(404).json({ message: "T�i kho?n kh�ng t?n t?i" });
    }

    const body = req.body || {};
    const patch = {};

    if ("fullName" in body) {
      const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
      if (fullName.length > 0 && fullName.length < 2) {
        return res.status(400).json({ message: "H? v� t�n �t nh?t 2 k� t?" });
      }
      patch.fullName = fullName;
    }
    if ("phone" in body) {
      const raw = typeof body.phone === "string" ? body.phone.trim() : "";
      if (!raw) {
        patch.phone = "";
      } else {
        let phoneDigits = raw.replace(/\D/g, "");
        if (!phoneDigits) {
          return res.status(400).json({ message: "S? ?i?n tho?i ph?i ch?a �t nh?t c�c ch? s? (vd: 0912345678)" });
        }
        if (phoneDigits.startsWith("84") && phoneDigits.length >= 10) {
          phoneDigits = phoneDigits.slice(2);
        }
        if (!phoneDigits.startsWith("0") && phoneDigits.length === 9) {
          phoneDigits = `0${phoneDigits}`;
        }
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
          return res.status(400).json({ message: "S? ?i?n tho?i kh�ng h?p l? (vd: 0912345678)" });
        }
        patch.phone = phoneDigits;
      }
    }
    if ("address" in body) patch.address = typeof body.address === "string" ? body.address.trim() : "";
    if ("avatarUrl" in body) {
      const u = body.avatarUrl;
      if (u === null || u === "") {
        patch.avatarUrl = "";
      } else if (typeof u === "string" && /^https?:\/\//i.test(u.trim())) {
        patch.avatarUrl = u.trim();
      } else {
        return res.status(400).json({ message: "URL ?nh ??i di?n kh�ng h?p l?" });
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: "Kh�ng c� th�ng tin c?p nh?t" });
    }

    const updated = await updateUserById(req.user.id, patch);
    const { passwordHash, ...safe } = updated;
    res.json(normalizePublicUser(safe));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Presigned PUT l�n S3 cho ?nh ??i di?n. */
exports.presignAvatar = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Ch?a c?u h�nh S3. ??t S3_BUCKET (ho?c AWS_S3_BUCKET), AWS_REGION v� AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env."
    });
  }
  try {
    const contentType = String(req.body?.contentType || "").trim().toLowerCase();
    let fileName = String(req.body?.fileName || "avatar.jpg").trim();
    if (!AVATAR_TYPES.has(contentType)) {
      return res.status(400).json({ message: "Ch? ch?p nh?n ?nh JPEG, PNG, WebP ho?c GIF" });
    }

    const ext = path.extname(fileName).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : contentType === "image/png"
        ? ".png"
        : contentType === "image/webp"
          ? ".webp"
          : contentType === "image/gif"
            ? ".gif"
            : ".jpg";

    const userId = req.user.id;
    const key = `avatars/${userId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`;

    const { uploadUrl, publicUrl } = await createPresignedPut({ key, contentType, expiresSec: 300 });

    res.json({ uploadUrl, publicUrl, method: "PUT", headers: { "Content-Type": contentType } });
  } catch (err) {
    console.error("presignAvatar", err);
    res.status(500).json({ message: err.message || "Kh�ng t?o ???c link upload S3" });
  }
};

// login
exports.login = async (req, res) => {
  try {
    console.log("[LOGIN DEBUG] D? li?u g?i t? Client:", req.body);
    const { email, password } = req.body;
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Email ho?c m?t kh?u kh�ng ?�ng" });
    }

    const user = await findByEmail(email);
    console.log("[DEBUG] User t? DB:", user);
    if (!user) {
      return res.status(400).json({ message: "Email ho?c m?t kh?u kh�ng ?�ng" });
    }

    const currentPassword = String(user.passwordHash || "");
    console.log("?? Password so s�nh:", { nhap: password, trongDB: user.passwordHash });
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(currentPassword);

    let isMatch = false;
    if (isBcryptHash) {
      try {
        isMatch = await bcrypt.compare(password, currentPassword);
        if (!isMatch && user.passwordHash === password) isMatch = true;
      } catch {
        isMatch = user.passwordHash === password;
      }
    } else {
      isMatch = password === currentPassword;
      if (isMatch) {
        try {
          const nextHash = await bcrypt.hash(password, 10);
          await updatePasswordHashById(user.id, nextHash);
          user.passwordHash = nextHash;
        } catch (migrateError) {
          console.error("[authController.login] Failed to migrate legacy password hash:", migrateError?.message, migrateError);
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Email ho?c m?t kh?u kh�ng ?�ng" });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: "Server configuration error" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role === "admin" ? "admin" : "citizen" }, jwtSecret, { expiresIn: "1d" });

    res.json({ message: "Login th�nh c�ng", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email kh�ng h?p l?" });
    }

    const user = await findByEmail(email);
    const safeOk = { message: "N?u email t?n t?i trong h? th?ng, ch�ng t�i ?� g?i h??ng d?n ??t l?i m?t kh?u." };
    if (!user) return res.json(safeOk);

    const token = jwt.sign(
      { sub: String(user.id), email, type: "password_reset", nonce: crypto.randomBytes(8).toString("hex") },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const baseUrl = process.env.FRONTEND_BASE_URL?.replace(/\/+$/, "") || "http://localhost:5173";
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await sendMail({ to: email, subject: "Y�u c?u ??t l?i m?t kh?u", html: resetPasswordEmail({ resetUrl }) });
    return res.json(safeOk);
  } catch (err) {
    console.error("FORGOT PASSWORD MAIL FAILED ?", err?.message, err);
    return res.status(500).json({ message: "L?i h? th?ng", error: err.message, smtp: serializeSmtpError(err) });
  }
};

/** Upload avatar tr?c ti?p t? backend l�n S3 (kh�ng c� CORS issues). */
exports.uploadAvatar = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Ch?a c?u h�nh S3. ??t AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY v� S3_BUCKET trong backend/.env."
    });
  }

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Kh�ng c� file ?nh" });
    }

    const contentType = file.mimetype.toLowerCase();
    if (!AVATAR_TYPES.has(contentType)) {
      return res.status(400).json({ message: "Ch? ch?p nh?n ?nh JPEG, PNG, WebP ho?c GIF" });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : contentType === "image/png"
        ? ".png"
        : contentType === "image/webp"
          ? ".webp"
          : contentType === "image/gif"
            ? ".gif"
            : ".jpg";

    const userId = req.user.id;
    const key = `avatars/${userId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`;

    const config = require("../config/s3").getConfig();
    const client = new S3Client({
      region: config.region,
      credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    });

    const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: file.buffer, ContentType: contentType });
    await client.send(command);

    const publicUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
    const updated = await updateUserById(userId, { avatarUrl: publicUrl });
    const { passwordHash: _, ...safe } = updated;

    res.json({ message: "C?p nh?t ?nh ??i di?n th�nh c�ng", user: normalizePublicUser(safe) });
  } catch (err) {
    console.error("uploadAvatar", err);
    res.status(500).json({ message: err.message || "Kh�ng upload ???c ?nh" });
  }
};

/** X�a t�i kho?n */
exports.deleteMe = async (req, res) => {
  try {
    const success = await deleteUserById(req.user.id);
    if (!success) return res.status(404).json({ message: "T�i kho?n kh�ng t�m th?y" });
    res.json({ message: "T�i kho?n ?� ???c x�a th�nh c�ng" });
  } catch (err) {
    console.error("deleteMe", err);
    res.status(500).json({ message: err.message || "Kh�ng th? x�a t�i kho?n" });
  }
};
