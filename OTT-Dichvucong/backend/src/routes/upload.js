// backend/routes/upload.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const authMiddleware = require("../middleware/authMiddleware");
const { normalizeFileName, buildPublicUrl } = require("../store/attachmentStore");

const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-1";

console.log("[upload.js] BUCKET:", BUCKET || "❌ CHƯA SET");
console.log("[upload.js] REGION:", REGION);

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({ storage: multer.memoryStorage() });

router.post("/file", authMiddleware, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Thiếu file upload" });
    if (!BUCKET) return res.status(500).json({ message: "S3_BUCKET chưa được cấu hình trong .env" });

    const safeName = normalizeFileName(req.file.originalname || `file-${Date.now()}`);
    const key = `attachments/${Date.now()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3.send(command);
    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    res.json({
      message: "Upload file thành công",
      attachment: {
        fileName: safeName,
        mimeType: req.file.mimetype,
        fileType: req.file.mimetype,
        size: req.file.size,
        fileUrl: publicUrl,
        url: publicUrl,
        path: publicUrl,
        key,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/presign", authMiddleware, async (req, res, next) => {
  try {
    const { key, contentType } = req.body;

    if (!key || !contentType) {
      return res.status(400).json({ message: "Thiếu key hoặc contentType" });
    }

    if (!BUCKET) {
      return res.status(500).json({ message: "S3_BUCKET chưa được cấu hình trong .env — không thể upload." });
    }

    const allowedPrefixes = ["chat-media/", "avatars/"];
    if (!allowedPrefixes.some((p) => key.startsWith(p))) {
      return res.status(403).json({ message: "Key không hợp lệ." });
    }

    const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    console.log(`[upload/presign] ✅ key=${key} → ${publicUrl}`);
    res.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    next(err);
  }
});

router.post("/me/avatar/presign", authMiddleware, async (req, res, next) => {
  req.url = "/presign";
  req.body.key = req.body.key || `avatars/${Date.now()}-avatar`;
  next("route");
});

module.exports = router;
