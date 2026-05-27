import { api, getApiErrorMessage } from "./api.js";

function isPersistableUrl(url) {
  const s = String(url || "").trim();
  return /^https?:\/\//i.test(s);
}

/**
 * Upload file qua backend (server → S3), tránh lỗi CORS khi PUT trực tiếp từ browser.
 */
export async function uploadToS3(file) {
  if (!file) throw new Error("Không có file để upload.");

  const formData = new FormData();
  formData.append("file", file);

  try {
    // Không set Content-Type thủ công — axios tự gắn boundary cho multipart
    const res = await api.post("/chat/media/upload", formData);

    const publicUrl = res.data?.publicUrl || res.data?.url || "";
    if (!isPersistableUrl(publicUrl)) {
      throw new Error(res.data?.message || "Không lấy được link ảnh sau khi tải lên");
    }

    return {
      key: res.data?.key,
      url: publicUrl,
      publicUrl,
      contentType: res.data?.contentType || file.type || "application/octet-stream",
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err) || "Không thể tải file lên server");
  }
}

export default uploadToS3;
