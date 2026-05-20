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
  payForApplication,
  adminCreateService,
  adminUpdateService,
  adminDeleteService
} = require("../controllers/serviceController");

router.get("/", getServices);
router.get("/my-applications", authMiddleware, getMyApplications);
router.get("/application/code/:applicationCode", getApplicationByCode);
router.get("/track/:applicationCode", trackApplication);
router.get("/:serviceId", getServiceById);
router.post("/submit", authMiddleware, submitApplication);
router.post("/pay", authMiddleware, payForApplication);
router.post("/admin", authMiddleware, adminOnly, adminCreateService);
router.put("/admin/:serviceId", authMiddleware, adminOnly, adminUpdateService);
router.delete("/admin/:serviceId", authMiddleware, adminOnly, adminDeleteService);

module.exports = router;
