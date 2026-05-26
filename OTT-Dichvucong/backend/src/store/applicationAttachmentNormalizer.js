function normalizeAttachment(item) {
  if (!item) return null;
  const fileName = String(item.fileName || item.name || item.originalName || item.filename || item.key || "").trim();
  const rawUrl = String(item.fileUrl || item.url || item.path || item.filePath || item.previewUrl || item.publicUrl || "").trim();
  const mimeType = String(item.mimeType || item.fileType || item.type || item.contentType || "").trim();
  const size = Number(item.size || item.fileSize || 0) || 0;

  return {
    ...item,
    fileName,
    mimeType,
    fileType: mimeType,
    fileUrl: rawUrl,
    url: rawUrl,
    path: rawUrl,
    previewUrl: rawUrl,
    publicUrl: rawUrl,
    size,
  };
}

function normalizeAttachments(list) {
  return Array.isArray(list) ? list.map(normalizeAttachment).filter(Boolean) : [];
}

module.exports = { normalizeAttachment, normalizeAttachments };
