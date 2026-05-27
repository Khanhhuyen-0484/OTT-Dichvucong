require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-1";
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
);

(async () => {
  const scan = await client.send(new ScanCommand({ TableName: process.env.DYNAMO_PAYMENTS_TABLE || "Payments" }));
  const pending = (scan.Items || []).filter(
    (item) => String(item.provider || "") === "SEPAY" && String(item.status || "") === "PENDING"
  );

  console.log(`[cleanup] pending sepay payments before cleanup: ${pending.length}`);
  for (const item of pending) {
    await client.send(
      new DeleteCommand({ TableName: process.env.DYNAMO_PAYMENTS_TABLE || "Payments", Key: { paymentId: item.paymentId } })
    );
  }
  console.log(`[cleanup] deleted: ${pending.length}`);

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
        requestContent: "Test payment flow",
      },
      paymentMethod: "BANK_TRANSFER",
      attachments: [],
    }),
  });
  console.log("[submit]", JSON.stringify(submitRes, null, 2));

  const dossierId = submitRes.body.dossierId;
  const paymentRes = await request("/payments/bank-transfer/create", {
    method: "POST",
    body: JSON.stringify({ dossierId, amount: 20000 }),
  });
  console.log("[create-payment]", JSON.stringify(paymentRes, null, 2));

  const paymentBody = typeof paymentRes.body === "string" ? JSON.parse(paymentRes.body) : paymentRes.body;
  const transferContent = paymentBody.transferContent;
  const webhookBody = {
    transactionId: `TXN-${Date.now()}`,
    amount: paymentBody.amount,
    content: transferContent,
    description: transferContent,
    type: "IN",
    transactionDate: new Date().toISOString(),
  };
  const raw = JSON.stringify(webhookBody);
  const sig = crypto
    .createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET || "dvc_2025_sepay_webhook_secret_x9k28q")
    .update(raw)
    .digest("hex");

  const webhookRes = await fetch(`${baseUrl}/payments/sepay-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sepay-signature": sig,
    },
    body: raw,
  });
  console.log("[webhook] status", webhookRes.status, await webhookRes.text());

  const statusRes = await request(`/payments/status/${dossierId}`);
  console.log("[status]", JSON.stringify(statusRes, null, 2));
})();
