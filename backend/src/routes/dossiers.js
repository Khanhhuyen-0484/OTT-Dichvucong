const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { checkDuplicateDossier } = require("../controllers/serviceController");

router.post("/check-duplicate", authMiddleware, checkDuplicateDossier);

module.exports = router;
