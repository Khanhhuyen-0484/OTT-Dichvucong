// backend/app.js
const { loadEnv } = require("./config/loadEnv");
loadEnv();

console.log(
  "[env] EMAIL_USER:",
  process.env.EMAIL_USER ? "đã set" : "THIẾU — kiểm tra backend/.env và restart server"
);
<<<<<<< HEAD
const express = require("express");
const cors = require("cors");
const app = express();
=======

const http = require("http");
const express = require("express");
const cors = require("cors");
const { initSocket } = require("./socket");
>>>>>>> 49573e7 (update videocall)
const authMiddleware = require("./middleware/authMiddleware");
const { verifyTransport } = require("./config/mailer");

<<<<<<< HEAD
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log("🔥 [BACKEND RECEIVE]:", req.method, req.url, req.body);
  next();
});
=======
const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: true, // reflect request origin — OK cho dev; production nên whitelist cụ thể
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
>>>>>>> 49573e7 (update videocall)

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Request logger (dev) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`🔥 [${req.method}] ${req.url}`, req.body);
    next();
  });
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("API OK 🚀"));

app.get("/api/health", (_req, res) => {
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  res.json({
    ok: true,
    hasEmailUser: Boolean(process.env.EMAIL_USER),
    hasEmailPass: Boolean(process.env.EMAIL_PASS),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasS3: Boolean(bucket && region),
    api: "ott-dichvucong-backend",
  });
});

// Test auth
app.get("/api/test", authMiddleware, (req, res) => {
  res.json({ message: "Bạn đã đăng nhập", user: req.user });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/chat",  require("./routes/chat"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/auth",  require("./routes/auth"));
app.use("/api/upload", require("./routes/upload")); // ← THÊM: presign S3
app.use("/api",       require("./routes/public"));  // OTP, login, /me, avatar…

<<<<<<< HEAD
/** OTP, đăng ký, đăng nhập, /me, PATCH /me — tất cả dưới /api */
app.use("/api", authRoutes);

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
=======
// ─── 404 cho mọi /api/* không khớp ───────────────────────────────────────────
// ĐẶT SAU TẤT CẢ routes, không đặt giữa chừng
app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("[ERROR]", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Lỗi server nội bộ",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ─── HTTP + Socket.IO ─────────────────────────────────────────────────────────
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server chạy http://localhost:${PORT}`);
  console.log("[API] Routes: /api/auth, /api/chat, /api/admin, /api/upload, /api/me, /api/login …");
>>>>>>> 49573e7 (update videocall)
  verifyTransport();
});