const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const c = require("../controllers/adminController");

router.use(authMiddleware, adminOnly);

router.get("/dashboard", c.dashboard);

router.get("/dossiers", c.dossierList);
router.get("/dossiers/:id", c.dossierDetail);
router.post("/dossiers/:id/decision", c.dossierDecision);
router.post("/dossiers/:id/chat-open", c.openDossierChat);

router.get("/support/conversations", c.supportConversations);
router.get("/support/conversations/:id", c.supportConversationDetail);
router.post("/support/conversations/:id/messages", c.supportSendMessage);
router.post("/support/conversations/:id/resolve", c.supportResolve);

router.get("/ai/history", c.aiHistory);
router.get("/ai/rules", c.aiRulesGet);
router.put("/ai/rules", c.aiRulesUpdate);

module.exports = router;
