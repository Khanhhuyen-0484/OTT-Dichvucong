const crypto = require("crypto");

// MoMo Configuration
const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
  accessKey: process.env.MOMO_ACCESS_KEY || "F8BF47D1D07082F5",
  secretKey: process.env.MOMO_SECRET_KEY || "fa537d0af4ee3ce4d91ff2ee1ab7159f",
  publicKey: process.env.MOMO_PUBLIC_KEY || "MIICIjANBgkqhkiG9w0BAIIBIAKBgQDvFs...",
  endpoint: process.env.MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create",
  paymentUrl: process.env.MOMO_PAYMENT_URL || "https://test-payment.momo.vn/v2/gateway/pay"
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled"
};

// Payment timeout: 60 minutes
const PAYMENT_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Generate unique request ID for MoMo payment
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate MoMo signature for payment request
 * @param {Object} data - Payment data
 * @returns {string} MD5 signature
 */
function generateMoMoSignature(data) {
  const {
    partnerCode,
    accessKey,
    secretKey,
    requestId,
    amount,
    orderId,
    orderInfo
  } = data;

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${encodeURIComponent(
    data.ipnUrl || ""
  )}&orderId=${orderId}&orderInfo=${encodeURIComponent(
    orderInfo || ""
  )}&orderType=FIAM&partnerCode=${partnerCode}&phoneNumber=&redirectUrl=${encodeURIComponent(
    data.redirectUrl || ""
  )}&requestId=${requestId}&requestType=captureMoMoWallet&secretKey=${secretKey}`;

  return crypto.createHash("sha256").update(rawSignature).digest("hex");
}

/**
 * Verify MoMo webhook signature
 */
function verifyMoMoSignature(data) {
  const { signature, ...rest } = data;
  const expectedSignature = generateMoMoSignature(rest);
  return signature === expectedSignature;
}

module.exports = {
  MOMO_CONFIG,
  PAYMENT_STATUS,
  PAYMENT_TIMEOUT_MS,
  generateRequestId,
  generateMoMoSignature,
  verifyMoMoSignature
};
