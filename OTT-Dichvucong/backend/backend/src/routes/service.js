const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const {
  getServices,
  getServiceById,
  submitApplication,
  getApplicationByCode,
  getMyApplications,
  trackApplication,
  getMyServiceNotifications,
  getApplicationPayments,
  payForApplication,
  adminCreateService,
  adminUpdateService,
  adminDeleteService,
  addApplicationSupplement,
  downloadApplicationResult
} = require("../controllers/serviceController");

router.get("/", getServices);
router.get("/my-applications", authMiddleware, getMyApplications);
router.get("/notifications", authMiddleware, getMyServiceNotifications);
router.get("/payments/:applicationId", authMiddleware, getApplicationPayments);
router.get("/application/code/:applicationCode", getApplicationByCode);
router.get("/track/:applicationCode", trackApplication);
router.get("/application/:applicationCode/result", authMiddleware, downloadApplicationResult);
router.get("/:serviceId", getServiceById);
router.post("/submit", authMiddleware, submitApplication);
router.post("/pay", authMiddleware, payForApplication);
router.post("/application/:applicationCode/supplement", authMiddleware, addApplicationSupplement);
router.post("/admin", authMiddleware, adminOnly, adminCreateService);
router.post("/admin/seed", authMiddleware, adminOnly, require("../controllers/serviceController").seedServices);
router.put("/admin/:serviceId", authMiddleware, adminOnly, adminUpdateService);
router.delete("/admin/:serviceId", authMiddleware, adminOnly, adminDeleteService);

module.exports = router;
