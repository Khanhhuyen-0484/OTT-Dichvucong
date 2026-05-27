const nodemailer = require("nodemailer");
const dns = require("dns");
const { loadEnv } = require("./loadEnv");

// ??m b?o .env ?'u?c n?p tru?>c khi ?'?c EMAIL_* (k?f c? khi mailer ?'u?c require s?>m).
loadEnv();

// M?Tt s?' m?ng/Windows uu ti?n IPv6 t?>i smtp.gmail.com nhung tuy?n IPv6 l?-i ??' g?i mail fail d? verify ?'?i khi v?n OK
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

function requireEnv(name) {
  loadEnv();
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function gmailAuth() {
  const user = requireEnv("EMAIL_USER").trim();
  const pass = requireEnv("EMAIL_PASS").replace(/\s+/g, "");
  return { user, pass };
}

/** Hai c?u h?nh Gmail hay d?ng: 465 SSL v? 587 STARTTLS (fallback). */
function gmailTransports() {
  const auth = gmailAuth();
  return [
    {
      name: "465 SSL",
      config: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth
      }
    },
    {
      name: "587 STARTTLS",
      config: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth
      }
    }
  ];
}

/**
 * Chu?n h?a l?-i SMTP ?'?f JSON response kh?ng b?< l?-i serialize
 */
function serializeSmtpError(err) {
  if (!err) return undefined;
  let response = err.response;
  if (Buffer.isBuffer(response)) {
    response = response.toString("utf8");
  } else if (response && typeof response === "object") {
    try {
      response = JSON.stringify(response);
    } catch {
      response = String(response);
    }
  } else if (response != null) {
    response = String(response);
  }
  const payload = {
    code: err.code,
    responseCode: err.responseCode,
    command: err.command,
    response
  };
  if (
    payload.code == null &&
    payload.responseCode == null &&
    payload.command == null &&
    (payload.response == null || payload.response === "")
  ) {
    return undefined;
  }
  return payload;
}

async function sendMail({ to, subject, html, text }) {
  const { user } = gmailAuth();
  const from = user;
  const toNorm = String(to).trim();

  const attempts = gmailTransports();
  let lastErr;

  for (const { name, config } of attempts) {
    const transport = nodemailer.createTransport(config);
    try {
      await transport.sendMail({
        from,
        to: toNorm,
        subject,
        html,
        text
      });
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[mailer] G?i th?t b?i (${name}):`, err.message);
    }
  }
  throw lastErr;
}

async function verifyTransport() {
  const attempts = gmailTransports();
  for (const { name, config } of attempts) {
    const transport = nodemailer.createTransport(config);
    try {
      await transport.verify();
      console.log(`SMTP verify OK. (${name})`);
      return;
    } catch (err) {
      console.warn(`[mailer] verify thất bại (${name}):`, err.message);
    }
  }
  console.error("SMTP verify FAIL. Vui lòng kiểm tra EMAIL_USER và EMAIL_PASS.");
}

module.exports = { sendMail, verifyTransport, serializeSmtpError };
