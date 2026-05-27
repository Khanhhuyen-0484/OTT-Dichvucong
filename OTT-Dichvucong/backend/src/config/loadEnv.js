const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

let loadedPath = null;

/**
 * Nạp backend/.env — đọc file + dotenv.parse (bỏ BOM UTF-8) rồi ghi đè process.env.
 * Tránh trường hợp dotenv.config bỏ qua file hoặc biến không vào env.
 */
function loadEnv() {
  if (loadedPath) return loadedPath;

  const candidates = [
    path.resolve(__dirname, "..", "..", ".env"),
    path.resolve(process.cwd(), "backend", ".env"),
    path.resolve(process.cwd(), ".env")
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      let raw = fs.readFileSync(envPath, "utf8");
      // UTF-8 BOM
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      raw = raw.replace(/^\uFEFF/, "");

      const parsed = dotenv.parse(raw);
      if (Object.keys(parsed).length === 0) {
        console.warn("[loadEnv] File không có biến ENV hợp lệ:", envPath);
        continue;
      }
      for (const [key, value] of Object.entries(parsed)) {
        process.env[key] = value;
      }

      loadedPath = envPath;
      console.log("[loadEnv] Đã nạp:", envPath);
      const hasMail = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
      if (!hasMail) {
        console.warn(
          "[loadEnv] Trong file không thấy EMAIL_USER/EMAIL_PASS sau khi parse. Keys:",
          Object.keys(parsed).join(", ")
        );
      }
      return loadedPath;
    } catch (err) {
      console.error("[loadEnv] Lỗi đọc .env:", envPath, err.message);
    }
  }

  console.warn("[loadEnv] Không tìm thấy .env trong:", candidates);
  return null;
}

module.exports = { loadEnv };
