const { loadEnv } = require("./config/loadEnv");
loadEnv();
console.log(
  "[env] EMAIL_USER:",
  process.env.EMAIL_USER ? "đã set" : "THIẾU — kiểm tra backend/.env và restart server"
);
const express = require("express");
const cors = require("cors");
const app = express();
const authMiddleware = require("./middleware/authMiddleware");
const { verifyTransport } = require("./config/mailer");

app.use(cors());
app.use(express.json());

/** Kiểm tra nhanh: process đang chạy có nạp đúng .env không (không lộ giá trị). */
app.get("/api/health", (req, res) => {
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  res.json({
    ok: true,
    hasEmailUser: Boolean(process.env.EMAIL_USER),
    hasEmailPass: Boolean(process.env.EMAIL_PASS),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasS3: Boolean(bucket && region),
    api: "ott-dichvucong-backend"
  });
});

app.get("/api/test", authMiddleware, (req, res) => {
  res.json({
    message: "Bạn đã đăng nhập",
    user: req.user
  });
});

app.use("/api/chat", require("./routes/chat"));

/** OTP, đăng ký, đăng nhập, /me, PATCH /me — tất cả dưới /api */
app.use("/api", require("./routes/public"));

// Existing routes (kept for compatibility)
app.use("/api/auth", require("./routes/auth"));
// API test
app.get("/", (req, res) => {
  res.send("API OK 🚀");
});

app.listen(3000, () => {
  console.log("Server chạy http://localhost:3000");
  console.log(
    "[API] Có GET/PATCH /api/me, POST /api/me/avatar/presign, /api/login, /api/chat/… — nếu không thấy dòng này, đang chạy sai file hoặc chưa restart."
  );
  verifyTransport();
});