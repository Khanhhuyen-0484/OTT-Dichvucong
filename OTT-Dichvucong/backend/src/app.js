const { loadEnv } = require("./config/loadEnv");
loadEnv();
console.log(
  "[env] EMAIL_USER:",
  process.env.EMAIL_USER ? "đã set" : "THIẾU — kiểm tra backend/.env và restart server"
);
const http = require("http");
const express = require("express");
const cors = require("cors");
const { initSocket } = require("./socket");
const app = express();
const authMiddleware = require("./middleware/authMiddleware");
const { verifyTransport } = require("./config/mailer");
const authRoutes = require("./routes/public");

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log("🔥 [BACKEND RECEIVE]:", req.method, req.url, req.body);
  next();
});

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
app.use("/api/admin", require("./routes/admin"));

/** OTP, đăng ký, đăng nhập, /me, PATCH /me — tất cả dưới /api */
app.use("/api", authRoutes);

// Existing routes (kept for compatibility)
app.use("/api/auth", require("./routes/auth"));
app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}`
  });
});
// API test
app.get("/", (req, res) => {
  res.send("API OK 🚀");
});

const server = http.createServer(app);
initSocket(server);

const PORT = Number(process.env.PORT || 3000);
server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} đang bị chiếm. Hãy đổi PORT trong backend/.env hoặc tắt tiến trình đang dùng cổng này.`);
    process.exitCode = 1;
    return;
  }
  console.error("[Server error]", err);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server chạy http://localhost:${PORT}`);
  console.log(
    "[API] Có GET/PATCH /api/me, POST /api/me/avatar/presign, /api/login, /api/chat/… — nếu không thấy dòng này, đang chạy sai file hoặc chưa restart."
  );
  verifyTransport();
});