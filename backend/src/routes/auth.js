const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  sendOtp,
  verifyOtp,
  register,
  login,
  forgotPassword,
  me,
  patchMe,
  presignAvatar,
  deleteMe
} = require("../controllers/authController");

router.get("/me", authMiddleware, me);
router.patch("/me", authMiddleware, patchMe);
router.delete("/me", authMiddleware, deleteMe);
router.post("/me/avatar/presign", authMiddleware, presignAvatar);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);

module.exports = router;