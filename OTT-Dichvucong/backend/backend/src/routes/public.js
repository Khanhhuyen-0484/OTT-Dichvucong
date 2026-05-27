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
  login,
  me,
  patchMe,
  presignAvatar,
  uploadAvatar
} = require("../controllers/authController");

/** H?" so JWT ??" ?'?t trong router /api ?'?f lu?n c? GET/PATCH /api/me khi mount ?'?ng. */
router.get("/me", authMiddleware, me);
router.patch("/me", authMiddleware, patchMe);
router.post("/me/avatar/presign", authMiddleware, presignAvatar);
router.post("/me/avatar/upload", authMiddleware, upload.single("file"), uploadAvatar);

// As requested
router.post("/send-otp", sendOtp);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);

// Keep login reachable at /api/login too
router.post("/login", login);

module.exports = router;

