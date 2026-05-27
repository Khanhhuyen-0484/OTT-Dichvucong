const cron = require("node-cron");
const { readAll, updateByCode } = require("../store/serviceApplicationStore");
const { PAYMENT_STATUS } = require("../config/payment");

/**
 * Auto-cancel pending payments after 60 minutes
 * Runs every 10 minutes
 */
function startPaymentExpiryScheduler() {
  console.log("[Scheduler] Starting payment expiry checker (runs every 10 minutes)");

  cron.schedule("*/10 * * * *", () => {
    try {
      const now = new Date();
      const applications = readAll();

      let expiredCount = 0;

      applications.forEach((app) => {
        // Check if payment is pending and expired
        if (
          app.paymentStatus === PAYMENT_STATUS.PENDING &&
          app.paymentExpireAt &&
          new Date(app.paymentExpireAt) < now
        ) {
          const dossierId = app.dossierId || app.id || app.applicationCode;
          console.log(
            `[Scheduler] Cancelling expired payment for dossier: ${dossierId}`
          );

          updateByCode(dossierId, {
            paymentStatus: PAYMENT_STATUS.EXPIRED,
            status: "Hủy (Hết hạn thanh toán)"
          });

          expiredCount++;
        }
      });

      if (expiredCount > 0) {
        console.log(`[Scheduler] Cancelled ${expiredCount} expired payment(s)`);
      }
    } catch (err) {
      console.error("[Scheduler] Error in payment expiry check:", err);
    }
  });
}

module.exports = { startPaymentExpiryScheduler };
