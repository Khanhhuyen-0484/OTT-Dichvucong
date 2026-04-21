// frontend/src/lib/uploadToS3.js
import api from "./api.js";

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/**
 * Upload file lên S3 thật qua presigned URL.
 * @param {File} file
 * @param {"chat-media"|"avatars"} folder - thư mục đích trên S3
 * @returns {Promise<{ url: string, key: string, contentType: string }>}
 */
export async function uploadToS3(file, folder = "chat-media") {
  if (!file) throw new Error("Không có file để upload.");

  const contentType = file.type || "application/octet-stream";
  const safeName = sanitizeFilename(file.name);
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  // Bước 1: Lấy presigned URL từ backend
  let uploadUrl, publicUrl;
  try {
    const { data } = await api.post("/upload/presign", { key, contentType });
    uploadUrl = data.uploadUrl;
    publicUrl = data.publicUrl;
    console.log("[uploadToS3] presign OK →", publicUrl);
  } catch (err) {
    // Fallback sang route avatar cũ (backward compat)
    try {
      const { data } = await api.post("/me/avatar/presign", { key, contentType });
      uploadUrl = data.uploadUrl;
      publicUrl = data.publicUrl;
      console.warn("[uploadToS3] dùng fallback /me/avatar/presign");
    } catch {
      throw new Error(
        "Không lấy được presigned URL. Đảm bảo backend có POST /api/upload/presign. " +
          "Chi tiết: " + (err.response?.data?.message || err.message)
      );
    }
  }

  // Bước 2: PUT file trực tiếp lên S3
  let uploadRes;
  try {
    uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
  } catch (networkErr) {
    throw new Error(`Không thể kết nối tới S3: ${networkErr.message}`);
  }

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`Upload S3 thất bại: HTTP ${uploadRes.status}. ${errText}`);
  }

  console.log("[uploadToS3] upload S3 OK →", publicUrl);
  return { url: publicUrl, key, contentType };
}

export default uploadToS3;