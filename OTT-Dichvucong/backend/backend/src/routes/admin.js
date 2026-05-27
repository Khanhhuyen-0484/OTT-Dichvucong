const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");
const c = require("../controllers/adminController");
const serviceController = require("../controllers/serviceController");

router.use(authMiddleware, adminOnly);

router.get("/dashboard", c.dashboard);
router.get("/statistics", c.getStatistics);
router.get("/service-categories", serviceController.getServiceCategories);
router.post("/service-categories/seed", serviceController.seedServiceCategories);
// Use the service controller's seed handler (was incorrectly referencing adminController)
router.post("/services/seed", serviceController.seedServices);

router.get("/dossiers", c.dossierList);
router.get("/dossiers/:id", c.dossierDetail);
router.post("/dossiers/:id/decision", c.dossierDecision);
router.patch("/dossiers/:id/status", c.updateDossierStatus);
router.post("/dossiers/:id/chat-open", c.openDossierChat);

router.get("/support/conversations", c.supportConversations);
router.get("/support/conversations/:id", c.supportConversationDetail);
router.post("/support/conversations/:id/messages", c.supportSendMessage);
router.post("/support/conversations/:id/resolve", c.supportResolve);

router.get("/ai/history", c.aiHistory);
router.get("/ai/rules", c.aiRulesGet);
router.put("/ai/rules", c.aiRulesUpdate);

// User role management
router.put("/users/:userId/role", c.updateUserRole);

module.exports = router;
