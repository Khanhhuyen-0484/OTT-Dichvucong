function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function uploadToS3(file) {
  if (!file) {
    throw new Error("Không có file để upload.");
  }
  const mockBase = String(import.meta.env.VITE_S3_MOCK_BASE_URL || "https://mock-s3.local").trim();
  const safeName = sanitizeFilename(file.name);
  const key = `chat-media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  // Mock URL để tích hợp luồng S3 ngay cả khi chưa có credentials.
  const url = `${mockBase.replace(/\/+$/, "")}/${key}`;
  return {
    key,
    url,
    contentType: file.type || "application/octet-stream"
  };
}

export default uploadToS3;
