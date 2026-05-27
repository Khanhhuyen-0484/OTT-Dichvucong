const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { buildAiMessage, generateAiReply } = require("../services/aiService");

const router = express.Router();

router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const message = String(req.body?.message || req.body?.text || "").trim();
    const result = await generateAiReply({
      userId: req.user?.id || "",
      message,
      messages: req.body?.messages || [],
    });

    return res.json({
      ok: true,
      reply: result.reply,
      mode: result.mode,
      action: result.action || "",
      message: buildAiMessage(result.reply, {
        mode: result.mode,
        action: result.action || "",
      }),
    });
  } catch (error) {
    console.error("[POST /api/ai/chat]", error);
    return res.status(500).json({
      message: "Trợ lý AI hiện đang bận, vui lòng thử lại sau.",
    });
  }
});

module.exports = router;
