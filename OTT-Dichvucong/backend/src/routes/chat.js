const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const {
  staffHistory,
  staffSend,
  aiChat,
  chatContacts,
  friendDiscovery,
  friendSuggestions,
  friendRequests,
  sendFriendRequest,
  respondFriendRequest,
  revokeFriendRequest,
  removeFriend,
  blockFriend,
  blockedFriends,
  unblockFriend,
  chatRooms,
  chatRoomDetail,
  ensureDirectChat,
  createGroupChat,
  groupInvites,
  inviteGroupMembers,
  respondGroupInvite,
  presignChatMediaUpload,
  uploadChatMedia,
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
router.get("/friends/discovery", authMiddleware, friendDiscovery);
router.get("/friends/suggestions", authMiddleware, friendSuggestions);
router.get("/friends/requests", authMiddleware, friendRequests);
router.post("/friends/request", authMiddleware, sendFriendRequest);
router.post("/friends/request/:userId/respond", authMiddleware, respondFriendRequest);
router.delete("/friends/request/:userId", authMiddleware, revokeFriendRequest);
router.get("/friends/blocked", authMiddleware, blockedFriends);
router.delete("/friends/:userId", authMiddleware, removeFriend);
router.post("/friends/:userId/block", authMiddleware, blockFriend);
router.post("/friends/:userId/unblock", authMiddleware, unblockFriend);
router.get("/rooms", authMiddleware, chatRooms);
router.get("/rooms/:roomId", authMiddleware, chatRoomDetail);
router.post("/direct/ensure", authMiddleware, ensureDirectChat);
router.post("/groups", authMiddleware, createGroupChat);
router.get("/groups/invites", authMiddleware, groupInvites);
router.post("/groups/:roomId/invites", authMiddleware, inviteGroupMembers);
router.post("/groups/:roomId/invites/respond", authMiddleware, respondGroupInvite);
router.post("/media/presign", authMiddleware, presignChatMediaUpload);
router.post("/rooms/:roomId/messages", authMiddleware, sendRoomMessage);
router.post("/rooms/:roomId/messages/:messageId/unsend", authMiddleware, unsendRoomMessage);
router.post("/rooms/:roomId/messages/:messageId/delete", authMiddleware, deleteRoomMessageForMe);
router.post("/rooms/:roomId/messages/:messageId/forward", authMiddleware, forwardRoomMessage);
router.post("/groups/:roomId/members", authMiddleware, addGroupMember);
router.delete("/groups/:roomId/members/:memberId", authMiddleware, removeGroupMember);
router.post("/groups/:roomId/deputies/:memberId", authMiddleware, assignDeputy);
router.delete("/groups/:roomId/deputies/:memberId", authMiddleware, removeDeputy);
router.delete("/groups/:roomId", authMiddleware, dissolveGroup);

// Media upload with multer
const upload = multer({ storage: multer.memoryStorage() });
router.post("/media/upload", authMiddleware, upload.single("file"), uploadChatMedia);

module.exports = router;
