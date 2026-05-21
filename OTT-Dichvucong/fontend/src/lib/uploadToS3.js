import { api } from "./api.js";

function makeFallbackUrl(file) {
  try {
    return URL.createObjectURL(file);
  } catch {
    return "";
  }
}

export async function uploadToS3(file) {
  if (!file) throw new Error("Không có file để upload.");

  const safeName = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `chat-media/${Date.now()}-${safeName}`;
  const contentType = file.type || "application/octet-stream";

  try {
    const presignRes = await api.post("/upload/presign", {
      key,
      contentType,
      fileName: file.name
    });

    const uploadUrl = presignRes.data?.uploadUrl;
    if (!uploadUrl) {
      return { key, url: makeFallbackUrl(file), contentType };
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file
    });

    if (!uploadResponse.ok) {
      return { key, url: makeFallbackUrl(file), contentType };
    }

    return {
      key: presignRes.data?.key || key,
      url: presignRes.data?.publicUrl || presignRes.data?.url || makeFallbackUrl(file),
      contentType
    };
  } catch (err) {
    console.warn("[uploadToS3] Fallback local URL due to upload error:", err?.message || err);
    return {
      key,
      url: makeFallbackUrl(file),
      contentType
    };
  }
}

export default uploadToS3;
