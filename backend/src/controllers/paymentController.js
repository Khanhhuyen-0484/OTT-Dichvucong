const QRCode = require("qrcode");
const crypto = require("crypto");
const {
  MOMO_CONFIG,
  PAYMENT_STATUS,
  PAYMENT_TIMEOUT_MS,
  generateRequestId,
  generateMoMoSignature
} = require("../config/payment");
const { findByCode, updateByCode } = require("../store/serviceApplicationStore");

/**
 * Generate QR code for MoMo payment
 * POST /api/services/payment/generate-qr
 */
exports.generatePaymentQr = async (req, res) => {
  try {
    const { applicationCode, amount, serviceDescription } = req.body;

    if (!applicationCode || !amount) {
      return res.status(400).json({
        message: "Thiếu applicationCode hoặc amount"
      });
    }

    // Fetch application to verify
    const application = findByCode(applicationCode);
    if (!application) {
      return res.status(404).json({
        message: "Không tìm thấy hồ sơ"
      });
    }

    // Update application with payment_status = pending
    updateByCode(applicationCode, {
      paymentStatus: PAYMENT_STATUS.PENDING,
      paymentExpireAt: new Date(Date.now() + PAYMENT_TIMEOUT_MS).toISOString(),
      paymentAmount: amount,
      paymentDescription: serviceDescription || "Thanh toán phí dịch vụ"
    });

    // Generate callback URL
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const callbackUrl = `${backendUrl}/api/services/payment/verify/${applicationCode}`;

    // Create QR code data (simplified for testing)
    // In production, you would integrate with MoMo API
    const qrData = {
      partnerCode: MOMO_CONFIG.partnerCode,
      amount: Math.round(amount),
      description: serviceDescription,
      callbackUrl,
      applicationCode,
      timestamp: Date.now()
    };

    // Generate QR code as data URL
    const qrDataString = JSON.stringify(qrData);
    const qrDataUrl = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });

    res.json({
      success: true,
      applicationCode,
      amount,
      description: serviceDescription,
      qrCode: qrDataUrl,
      paymentExpireAt: new Date(Date.now() + PAYMENT_TIMEOUT_MS).toISOString(),
      instruction: "Quét mã QR bằng ứng dụng MoMo, ZaloPay hoặc ứng dụng ngân hàng để thanh toán"
    });
  } catch (err) {
    console.error("generatePaymentQr error:", err);
    res.status(500).json({
      message: "Lỗi tạo mã QR thanh toán",
      error: err.message
    });
  }
};

/**
 * Verify payment status
 * GET /api/services/payment/verify/:applicationCode
 */
exports.verifyPaymentStatus = (req, res) => {
  try {
    const { applicationCode } = req.params;

    const application = findByCode(applicationCode);
    if (!application) {
      return res.status(404).json({
        message: "Không tìm thấy hồ sơ"
      });
    }

    // Check if payment expired
    if (
      application.paymentStatus === PAYMENT_STATUS.PENDING &&
      application.paymentExpireAt &&
      new Date(application.paymentExpireAt) < new Date()
    ) {
      updateByCode(applicationCode, {
        paymentStatus: PAYMENT_STATUS.EXPIRED
      });
      return res.json({
        applicationCode,
        paymentStatus: PAYMENT_STATUS.EXPIRED,
        message: "Hết thời gian thanh toán (60 phút). Hồ sơ đã bị hủy."
      });
    }

    res.json({
      applicationCode,
      paymentStatus: application.paymentStatus || PAYMENT_STATUS.PENDING,
      paymentAmount: application.paymentAmount,
      paymentExpireAt: application.paymentExpireAt,
      serviceName: application.serviceName,
      message:
        application.paymentStatus === PAYMENT_STATUS.COMPLETED
          ? "Thanh toán thành công!"
          : application.paymentStatus === PAYMENT_STATUS.PENDING
            ? "Chưa thanh toán. Vui lòng quét mã QR để tiếp tục."
            : "Thanh toán thất bại hoặc hết hạn."
    });
  } catch (err) {
    console.error("verifyPaymentStatus error:", err);
    res.status(500).json({
      message: "Lỗi kiểm tra trạng thái thanh toán",
      error: err.message
    });
  }
};

/**
 * Webhook callback từ payment gateway (MoMo, ZaloPay, ...)
 * POST /api/services/payment/webhook
 */
exports.paymentWebhook = (req, res) => {
  try {
    const { applicationCode, status, transactionId } = req.body;

    if (!applicationCode || !status) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const application = findByCode(applicationCode);
    if (!application) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    // Update payment status based on webhook
    const newStatus =
      status === "success" || status === "completed"
        ? PAYMENT_STATUS.COMPLETED
        : PAYMENT_STATUS.FAILED;

    const updated = updateByCode(applicationCode, {
      paymentStatus: newStatus,
      paymentTransactionId: transactionId || null,
      paymentCompletedAt: newStatus === PAYMENT_STATUS.COMPLETED ? new Date().toISOString() : null,
      status: newStatus === PAYMENT_STATUS.COMPLETED ? "Đã tiếp nhận" : "Chưa thanh toán"
    });

    console.log(`[Payment Webhook] ${applicationCode}: ${newStatus}`);

    res.json({
      success: true,
      message: `Payment ${newStatus}`,
      applicationCode,
      paymentStatus: newStatus
    });
  } catch (err) {
    console.error("paymentWebhook error:", err);
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
      error: err.message
    });
  }
};

/**
 * Update payment status manually (for testing)
 * POST /api/services/payment/mock-complete
 */
exports.mockPaymentComplete = (req, res) => {
  try {
    const { applicationCode } = req.body;

    if (!applicationCode) {
      return res.status(400).json({
        message: "Missing applicationCode"
      });
    }

    const application = findByCode(applicationCode);
    if (!application) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    const updated = updateByCode(applicationCode, {
      paymentStatus: PAYMENT_STATUS.COMPLETED,
      paymentCompletedAt: new Date().toISOString(),
      status: "Đã tiếp nhận"
    });

    res.json({
      success: true,
      message: "Payment marked as completed (MOCK)",
      paymentStatus: PAYMENT_STATUS.COMPLETED,
      application: updated
    });
  } catch (err) {
    console.error("mockPaymentComplete error:", err);
    res.status(500).json({
      message: "Error updating payment",
      error: err.message
    });
  }
};
