const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  generatePaymentQr,
  verifyPaymentStatus,
  paymentWebhook,
  mockPaymentComplete
} = require("../controllers/paymentController");

// Generate QR code for payment
router.post("/generate-qr", authMiddleware, generatePaymentQr);

// Verify payment status
router.get("/verify/:dossierId", verifyPaymentStatus);

// Webhook from payment gateway
router.post("/webhook", paymentWebhook);

// Mock payment completion (for testing)
router.post("/mock-complete", mockPaymentComplete);

module.exports = router;
