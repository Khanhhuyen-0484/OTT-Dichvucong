const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getServices,
  getServiceById,
  submitApplication,
  getApplicationByCode,
  getMyApplications
} = require("../controllers/serviceController");

router.get("/", getServices);
router.get("/my-applications", authMiddleware, getMyApplications);
router.get("/application/code/:applicationCode", getApplicationByCode);
router.get("/:serviceId", getServiceById);
router.post("/submit", authMiddleware, submitApplication);

module.exports = router;