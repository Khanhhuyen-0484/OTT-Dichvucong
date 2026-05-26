const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const {
  sendOtp,
  register,
  forgotPassword,
  login,
  me,
  patchMe,
  presignAvatar,
  uploadAvatar,
  deleteMe
} = require("../controllers/authController");

router.get("/me", authMiddleware, me);
router.patch("/me", authMiddleware, patchMe);
router.delete("/me", authMiddleware, deleteMe);
router.post("/me/avatar/presign", authMiddleware, presignAvatar);
router.post("/me/avatar/upload", authMiddleware, upload.single("file"), uploadAvatar);

router.post("/send-otp", sendOtp);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/login", login);

module.exports = router;
