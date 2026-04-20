const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  staffHistory,
  staffSend,
  aiChat,
  chatContacts,
  chatRooms,
  chatRoomDetail,
  ensureDirectChat,
  createGroupChat,
  sendRoomMessage,
  unsendRoomMessage,
  deleteRoomMessageForMe,
  forwardRoomMessage,
  addGroupMember,
  removeGroupMember,
  assignDeputy,
  removeDeputy,
  dissolveGroup
} = require("../controllers/chatController");

router.get("/staff", authMiddleware, staffHistory);
router.post("/staff", authMiddleware, staffSend);
router.post("/ai", aiChat);
router.get("/contacts", authMiddleware, chatContacts);
router.get("/rooms", authMiddleware, chatRooms);
router.get("/rooms/:roomId", authMiddleware, chatRoomDetail);
router.post("/direct/ensure", authMiddleware, ensureDirectChat);
router.post("/groups", authMiddleware, createGroupChat);
router.post("/rooms/:roomId/messages", authMiddleware, sendRoomMessage);
router.post("/rooms/:roomId/messages/:messageId/unsend", authMiddleware, unsendRoomMessage);
router.post("/rooms/:roomId/messages/:messageId/delete", authMiddleware, deleteRoomMessageForMe);
router.post("/rooms/:roomId/messages/:messageId/forward", authMiddleware, forwardRoomMessage);
router.post("/groups/:roomId/members", authMiddleware, addGroupMember);
router.delete("/groups/:roomId/members/:memberId", authMiddleware, removeGroupMember);
router.post("/groups/:roomId/deputies/:memberId", authMiddleware, assignDeputy);
router.delete("/groups/:roomId/deputies/:memberId", authMiddleware, removeDeputy);
router.delete("/groups/:roomId", authMiddleware, dissolveGroup);

module.exports = router;
