import { api, getApiErrorMessage } from "./api.js";

function isPersistableUrl(url) {
  const s = String(url || "").trim();
  return /^https?:\/\//i.test(s);
}

/**
 * Upload file qua backend (server ??' S3), tr?nh l?-i CORS khi PUT tr?c ti?p t? browser.
 */
export async function uploadToS3(file) {
  if (!file) throw new Error("Kh�ng c? file ?'?f upload.");

  const formData = new FormData();
  formData.append("file", file);

  try {
    // Kh�ng set Content-Type th? c�ng ??" axios t? g?n boundary cho multipart
    const res = await api.post("/chat/media/upload", formData);

    const publicUrl = res.data?.publicUrl || res.data?.url || "";
    if (!isPersistableUrl(publicUrl)) {
      throw new Error(res.data?.message || "Kh�ng l?y ?'u?c link ?nh sau khi t�i l?n");
    }

    return {
      key: res.data?.key,
      url: publicUrl,
      publicUrl,
      contentType: res.data?.contentType || file.type || "application/octet-stream",
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err) || "Kh�ng th?f t�i file l?n server");
  }
}

export default uploadToS3;
