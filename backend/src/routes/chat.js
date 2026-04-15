const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { staffHistory, staffSend, aiChat } = require("../controllers/chatController");

router.get("/staff", authMiddleware, staffHistory);
router.post("/staff", authMiddleware, staffSend);
router.post("/ai", aiChat);

module.exports = router;
