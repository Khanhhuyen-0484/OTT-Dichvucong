require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
(async () => {
  const token = jwt.sign({ id: "test-user", email: "test@example.com" }, process.env.JWT_SECRET || "abc123");
  const baseUrl = "http://localhost:3000/api";

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed, raw: text };
  }

  const submitRes = await request("/services/submit", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "demo-ho-tich",
      formData: {
        fullName: "Test User",
        citizenId: "123456789012",
        email: "test@example.com",
        phone: "0912345678",
        address: "Test Address",
        requestContent: "Verify HMAC webhook",
      },
      paymentMethod: "BANK_TRANSFER",
      attachments: [],
    }),
  });

  console.log("submit", JSON.stringify(submitRes, null, 2));
  const dossierId = submitRes.body.dossierId;

  const paymentRes = await request("/payments/bank-transfer/create", {
    method: "POST",
    body: JSON.stringify({ dossierId, amount: 20000 }),
  });

  console.log("create", JSON.stringify(paymentRes, null, 2));
  const paymentBody = typeof paymentRes.body === "string" ? JSON.parse(paymentRes.body) : paymentRes.body;
  const content = paymentBody.transferContent;

  const raw = JSON.stringify({
    transactionId: `TXN-VERIFY-${Date.now()}`,
    amount: paymentBody.amount,
    content,
    description: content,
    type: "IN",
    transactionDate: new Date().toISOString(),
  });

  const signature = crypto.createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET || "").update(raw).digest("hex");
  const webhookRes = await fetch(`${baseUrl}/payments/sepay-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sepay-signature": `sha256=${signature}`,
    },
    body: raw,
  });

  const webhookText = await webhookRes.text();
  console.log("webhook status", webhookRes.status);
  console.log(webhookText);

  const statusRes = await request(`/payments/status/${dossierId}`);
  console.log("status", JSON.stringify(statusRes, null, 2));
})();
