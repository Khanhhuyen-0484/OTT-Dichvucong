const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");

// Configure multer for in-memory file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const {
  sendOtp,
  register,
  forgotPassword,
  forgotPasswordOtp,
  resetPasswordWithOtp,
  login,
  me,
  patchMe,
  presignAvatar,
  uploadAvatar
} = require("../controllers/authController");

/** Hồ sơ JWT — đặt trong router /api để luôn có GET/PATCH /api/me khi mount đúng. */
router.get("/me", authMiddleware, me);
router.patch("/me", authMiddleware, patchMe);
router.post("/me/avatar/presign", authMiddleware, presignAvatar);
router.post("/me/avatar/upload", authMiddleware, upload.single("file"), uploadAvatar);

// As requested
router.post("/send-otp", sendOtp);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/forgot-password/otp", forgotPasswordOtp);
router.post("/reset-password/otp", resetPasswordWithOtp);

// Keep login reachable at /api/login too
router.post("/login", login);

module.exports = router;

