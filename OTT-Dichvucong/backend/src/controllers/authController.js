const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendMail, serializeSmtpError } = require("../config/mailer");
const { otpEmail, resetPasswordEmail } = require("../emails/templates");
const { generateOtp, setOtp, verifyOtp, consumeOtp } = require("../store/otpStore");
const {
  findByEmail,
  findById,
  createUser,
  updateUserById,
  deleteUserById
} = require("../store/userStore");
const path = require("path");
const { createPresignedPut, isS3Configured } = require("../config/s3");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function normalizePublicUser(u) {
  if (!u) return null;
  const av = u.avatarUrl != null && String(u.avatarUrl).trim();
  return {
    id: u.id,
    email: u.email || "",
    fullName: u.fullName != null ? String(u.fullName) : "",
    phone: u.phone != null ? String(u.phone) : "",
    address: u.address != null ? String(u.address) : "",
    avatarUrl: av ? String(av).trim() : null,
    createdAt: u.createdAt
  };
}

// gửi OTP
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email không hợp lệ" });
  }

  const otp = generateOtp();
  const to = String(email).trim().toLowerCase();

  try {
    const html = otpEmail({ otp, minutes: 5 });
    await sendMail({
      to,
      subject: "Mã OTP xác minh đăng ký",
      html,
      text: `Mã OTP của bạn: ${otp} (hiệu lực 5 phút).`
    });
    // Chỉ lưu OTP khi gửi mail thành công
    setOtp(to, otp, 5 * 60_000);
  } catch (err) {
    console.error("SEND OTP FAILED ❌", err?.message, err);
    const smtp = serializeSmtpError(err);
    return res.status(500).json({
      message:
        "Không gửi được email. Kiểm tra Gmail: bật 2FA, tạo App Password 16 ký tự, EMAIL_USER khớp tài khoản gửi.",
      error: err.message,
      smtp
    });
  }

  res.json({ message: "OTP đã được gửi tới email" });
};

// verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const result = verifyOtp(email, otp);
  if (!result.ok) {
    return res.status(400).json({
      message: result.reason === "NOT_FOUND" ? "OTP không tồn tại hoặc đã hết hạn" : "OTP không đúng"
    });
  }

  res.json({ message: "OTP hợp lệ" });
};

// register
exports.register = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }
    if (!otp || typeof otp !== "string") {
      return res.status(400).json({ message: "OTP không hợp lệ" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const fullName =
      typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const phone =
      typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    const address =
      typeof req.body.address === "string" ? req.body.address.trim() : "";

    if (fullName.length < 2) {
      return res.status(400).json({ message: "Họ và tên ít nhất 2 ký tự" });
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
      return res
        .status(400)
        .json({ message: "Số điện thoại không hợp lệ (ví dụ: 0912345678)" });
    }

    const existing = await findByEmail(emailNorm);
    if (existing) {
      return res.status(400).json({ message: "Email đã được đăng ký" });
    }

    const result = verifyOtp(emailNorm, otp);
    if (!result.ok) {
      return res.status(400).json({
        message: result.reason === "NOT_FOUND" ? "OTP không tồn tại hoặc đã hết hạn" : "OTP sai"
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
    res.json({
      message: "Đăng ký thành công",
      user: normalizePublicUser(safe)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// thông tin tài khoản (JWT)
exports.me = async (req, res) => {
  try {
    const user = await findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }
    const { passwordHash, ...safe } = user;
    res.json(normalizePublicUser(safe));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Cập nhật hồ sơ (tên, SĐT, địa chỉ, avatarUrl). */
exports.patchMe = async (req, res) => {
  try {
    const existing = await findById(req.user.id);
    if (!existing) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    const body = req.body || {};
    const patch = {};

    if ("fullName" in body) {
      const fullName =
        typeof body.fullName === "string" ? body.fullName.trim() : "";
      if (fullName.length > 0 && fullName.length < 2) {
        return res.status(400).json({ message: "Họ và tên ít nhất 2 ký tự" });
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
          return res
            .status(400)
            .json({ message: "Số điện thoại phải chứa ít nhất các chữ số (vd: 0912345678)" });
        }
        if (phoneDigits.startsWith("84") && phoneDigits.length >= 10) {
          phoneDigits = phoneDigits.slice(2);
        }
        if (!phoneDigits.startsWith("0") && phoneDigits.length === 9) {
          phoneDigits = `0${phoneDigits}`;
        }
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
          return res
            .status(400)
            .json({ message: "Số điện thoại không hợp lệ (vd: 0912345678)" });
        }
        patch.phone = phoneDigits;
      }
    }
    if ("address" in body) {
      patch.address =
        typeof body.address === "string" ? body.address.trim() : "";
    }
    if ("avatarUrl" in body) {
      const u = body.avatarUrl;
      if (u === null || u === "") {
        patch.avatarUrl = "";
      } else if (typeof u === "string" && /^https?:\/\//i.test(u.trim())) {
        patch.avatarUrl = u.trim();
      } else {
        return res.status(400).json({ message: "URL ảnh đại diện không hợp lệ" });
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: "Không có thông tin cập nhật" });
    }

    const updated = await updateUserById(req.user.id, patch);
    const { passwordHash, ...safe } = updated;
    res.json(normalizePublicUser(safe));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Presigned PUT lên S3 cho ảnh đại diện. */
exports.presignAvatar = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Chưa cấu hình S3. Đặt S3_BUCKET (hoặc AWS_S3_BUCKET), AWS_REGION và AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong backend/.env."
    });
  }
  try {
    const contentType = String(req.body?.contentType || "")
      .trim()
      .toLowerCase();
    let fileName = String(req.body?.fileName || "avatar.jpg").trim();
    if (!AVATAR_TYPES.has(contentType)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF"
      });
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

    const { uploadUrl, publicUrl } = await createPresignedPut({
      key,
      contentType,
      expiresSec: 300
    });

    res.json({
      uploadUrl,
      publicUrl,
      method: "PUT",
      headers: { "Content-Type": contentType }
    });
  } catch (err) {
    console.error("presignAvatar", err);
    res.status(500).json({
      message: err.message || "Không tạo được link upload S3"
    });
  }
};

// login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await findByEmail(email);

    if (!user) {
      return res.status(400).json({ message: "Email không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login thành công",
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email không hợp lệ" });
    }

    const user = await findByEmail(email);

    // Do not reveal whether email exists
    const safeOk = {
      message:
        "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu."
    };

    if (!user) return res.json(safeOk);

    const token = jwt.sign(
      {
        sub: String(user.id),
        email,
        type: "password_reset",
        nonce: crypto.randomBytes(8).toString("hex")
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const baseUrl =
      process.env.FRONTEND_BASE_URL?.replace(/\/+$/, "") ||
      "http://localhost:5173";
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(
      token
    )}`;

    await sendMail({
      to: email,
      subject: "Yêu cầu đặt lại mật khẩu",
      html: resetPasswordEmail({ resetUrl })
    });

    return res.json(safeOk);
  } catch (err) {
    console.error("FORGOT PASSWORD MAIL FAILED ❌", err?.message, err);
    return res.status(500).json({
      message: "Lỗi hệ thống",
      error: err.message,
      smtp: serializeSmtpError(err)
    });
  }
};

/** Upload avatar trực tiếp từ backend lên S3 (không có CORS issues). */
exports.uploadAvatar = async (req, res) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      message:
        "Chưa cấu hình S3. Đặt AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY và S3_BUCKET trong backend/.env."
    });
  }

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Không có file ảnh" });
    }

    const contentType = file.mimetype.toLowerCase();
    if (!AVATAR_TYPES.has(contentType)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF"
      });
    }

    // Generate S3 key
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

    // Upload to S3
    const config = require("../config/s3").getConfig();
    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: contentType
    });

    await client.send(command);

    // Generate public URL
    const publicUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;

    // Save to database
    const updated = await updateUserById(userId, { avatarUrl: publicUrl });
    const { passwordHash: _, ...safe } = updated;

    res.json({
      message: "Cập nhật ảnh đại diện thành công",
      user: normalizePublicUser(safe)
    });
  } catch (err) {
    console.error("uploadAvatar", err);
    res.status(500).json({
      message: err.message || "Không upload được ảnh"
    });
  }
};

/** Xóa tài khoản */
exports.deleteMe = async (req, res) => {
  try {
    const success = await deleteUserById(req.user.id);
    if (!success) {
      return res.status(404).json({ message: "Tài khoản không tìm thấy" });
    }
    res.json({ message: "Tài khoản đã được xóa thành công" });
  } catch (err) {
    console.error("deleteMe", err);
    res.status(500).json({ message: err.message || "Không thể xóa tài khoản" });
  }
};