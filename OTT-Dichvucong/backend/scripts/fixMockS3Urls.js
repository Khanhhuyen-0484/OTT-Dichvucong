// backend/scripts/fixMockS3Urls.js — viết lại hoàn chỉnh
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
const BUCKET    = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const REGION    = process.env.AWS_REGION || "ap-southeast-1";

if (!MONGO_URI) { console.error("❌ MONGO_URI chưa set"); process.exit(1); }
if (!BUCKET)    { console.error("❌ S3_BUCKET chưa set");  process.exit(1); }

const MOCK_PREFIXES = [
  "https://mock-s3.local",
  "http://mock-s3.local",
  "https://localhost:9000",   // nếu từng dùng MinIO local
];
const REAL_PREFIX = `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

// ── Schema tối giản — không cần import model thật ───────────────────────────
const messageSchema = new mongoose.Schema({}, { strict: false, collection: "messages" });
const Message = mongoose.model("Message", messageSchema);

function isMockUrl(url) {
  return typeof url === "string" && MOCK_PREFIXES.some((p) => url.startsWith(p));
}

function fixUrl(url) {
  for (const p of MOCK_PREFIXES) {
    if (url.startsWith(p)) return url.replace(p, REAL_PREFIX);
  }
  return url;
}

async function run() {
  console.log("🔌 Đang kết nối MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Kết nối OK");
  console.log(`🔄 Sẽ thay mock URL → ${REAL_PREFIX}`);

  // Tìm tất cả document có chứa mock URL ở bất kỳ field nào
  const all = await Message.find({}).lean();
  console.log(`📦 Tổng số message trong DB: ${all.length}`);

  let fixed = 0;

  for (const doc of all) {
    const update = {};

    // Fix field: media.url
    if (isMockUrl(doc.media?.url)) {
      update["media.url"] = fixUrl(doc.media.url);
    }

    // Fix field: attachments[].url (nếu dùng array)
    if (Array.isArray(doc.attachments)) {
      const newAtts = doc.attachments.map((att) =>
        att?.url && isMockUrl(att.url) ? { ...att, url: fixUrl(att.url) } : att
      );
      const changed = newAtts.some((a, i) => a.url !== doc.attachments[i]?.url);
      if (changed) update["attachments"] = newAtts;
    }

    // Fix field: fileUrl (nếu lưu trực tiếp)
    if (isMockUrl(doc.fileUrl)) {
      update["fileUrl"] = fixUrl(doc.fileUrl);
    }

    if (Object.keys(update).length > 0) {
      await Message.updateOne({ _id: doc._id }, { $set: update });
      fixed++;
      console.log(`  ✔ Fixed message ${doc._id}`);
    }
  }

  console.log(`\n✅ Đã fix ${fixed} / ${all.length} message`);
  await mongoose.disconnect();
  console.log("🔌 Đã ngắt kết nối MongoDB");
}

run().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});