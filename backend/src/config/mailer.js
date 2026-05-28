const nodemailer = require("nodemailer");
const dns = require("dns");
const dnsPromises = require("dns").promises;
const { loadEnv } = require("./loadEnv");

// Đảm bảo .env được nạp trước khi đọc EMAIL_* (kể cả khi mailer được require sớm).
loadEnv();

// Một số mạng/Windows ưu tiên IPv6 tới smtp.gmail.com nhưng tuyến IPv6 lỗi làm gửi mail fail.
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

function optionalEnv(name) {
  loadEnv();
  return String(process.env[name] || "").trim();
}

function mailFrom() {
  return optionalEnv("EMAIL_FROM") || optionalEnv("EMAIL_USER");
}

async function postJson(url, { headers = {}, body }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(`HTTP mail provider failed: ${response.status} ${text}`);
    err.code = "HTTP_MAIL_FAILED";
    err.responseCode = response.status;
    err.response = text;
    throw err;
  }
}

async function sendViaHttpProvider({ to, subject, html, text }) {
  const from = mailFrom();
  const toNorm = String(to).trim();
  const resendKey = optionalEnv("RESEND_API_KEY");
  if (resendKey) {
    await postJson("https://api.resend.com/emails", {
      headers: { Authorization: `Bearer ${resendKey}` },
      body: { from, to: [toNorm], subject, html, text }
    });
    return "resend";
  }

  const brevoKey = optionalEnv("BREVO_API_KEY");
  if (brevoKey) {
    await postJson("https://api.brevo.com/v3/smtp/email", {
      headers: { "api-key": brevoKey },
      body: {
        sender: { email: from },
        to: [{ email: toNorm }],
        subject,
        htmlContent: html,
        textContent: text
      }
    });
    return "brevo";
  }

  const sendGridKey = optionalEnv("SENDGRID_API_KEY");
  if (sendGridKey) {
    await postJson("https://api.sendgrid.com/v3/mail/send", {
      headers: { Authorization: `Bearer ${sendGridKey}` },
      body: {
        personalizations: [{ to: [{ email: toNorm }] }],
        from: { email: from },
        subject,
        content: [
          { type: "text/plain", value: text || "" },
          { type: "text/html", value: html || "" }
        ]
      }
    });
    return "sendgrid";
  }

  return "";
}

async function resolveSmtpHost() {
  try {
    const addresses = await dnsPromises.resolve4("smtp.gmail.com");
    return addresses?.[0] || "smtp.gmail.com";
  } catch (err) {
    console.warn("[mailer] resolve4 smtp.gmail.com failed:", err.message);
    return "smtp.gmail.com";
  }
}

/** Hai cấu hình Gmail hay dùng: 465 SSL và 587 STARTTLS (fallback). */
async function gmailTransports() {
  const auth = gmailAuth();
  const host = await resolveSmtpHost();
  const common = {
    auth,
    family: 4,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: {
      servername: "smtp.gmail.com"
    }
  };
  return [
    {
      name: "465 SSL",
      config: {
        host,
        port: 465,
        secure: true,
        ...common
      }
    },
    {
      name: "587 STARTTLS",
      config: {
        host,
        port: 587,
        secure: false,
        requireTLS: true,
        ...common
      }
    }
  ];
}

/**
 * Chuẩn hóa lỗi SMTP để JSON response không bị lỗi serialize.
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
  const httpProvider = await sendViaHttpProvider({ to, subject, html, text });
  if (httpProvider) {
    console.log(`[mailer] Sent via ${httpProvider}`);
    return;
  }

  const { user } = gmailAuth();
  const from = user;
  const toNorm = String(to).trim();

  const attempts = await gmailTransports();
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
      console.warn(`[mailer] Gửi thất bại (${name}):`, err.message);
    }
  }
  throw lastErr;
}

async function verifyTransport() {
  const attempts = await gmailTransports();
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
