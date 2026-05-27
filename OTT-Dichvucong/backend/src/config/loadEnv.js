const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

let loadedPath = null;

/**
 * N?p backend/.env ??" ?'?c file + dotenv.parse (b? BOM UTF-8) r?"i ghi ?'? process.env.
 * Tr?nh tru?ng h?p dotenv.config b? qua file ho?c bi?n kh?ng v?o env.
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
        console.warn("[loadEnv] File kh?ng c? bi?n ENV h?p l??:", envPath);
        continue;
      }
      for (const [key, value] of Object.entries(parsed)) {
        process.env[key] = value;
      }

      loadedPath = envPath;
      console.log("[loadEnv] ?? n?p:", envPath);
      const hasMail = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
      if (!hasMail) {
        console.warn(
          "[loadEnv] Trong file kh?ng th?y EMAIL_USER/EMAIL_PASS sau khi parse. Keys:",
          Object.keys(parsed).join(", ")
        );
      }
      return loadedPath;
    } catch (err) {
      console.error("[loadEnv] L?-i ?'?c .env:", envPath, err.message);
    }
  }

  console.warn("[loadEnv] Kh?ng t?m th?y .env trong:", candidates);
  return null;
}

module.exports = { loadEnv };
