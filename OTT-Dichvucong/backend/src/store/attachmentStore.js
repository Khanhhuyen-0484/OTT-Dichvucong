function normalizeFileName(name) {
  return String(name || "file").replace(/[\\/]+/g, "_").trim();
}

function buildPublicUrl(fileName) {
  return `/uploads/${encodeURI(fileName)}`;
}

function ensureAttachment(item) {
  if (!item) return null;
  const fileName = normalizeFileName(item.fileName || item.name || item.originalName || item.filename || item.key);
  const rawPath = String(item.filePath || item.path || item.url || item.fileUrl || "").trim();
  const mimeType = String(item.mimeType || item.fileType || item.type || item.contentType || "").trim();
  const size = Number(item.size || item.fileSize || 0) || 0;
  const fileUrl = rawPath || buildPublicUrl(fileName);

  return {
    ...item,
    fileName,
    mimeType,
    fileType: mimeType,
    fileUrl,
    url: fileUrl,
    path: rawPath || fileUrl,
    size,
  };
}

function normalizeAttachments(list) {
  return Array.isArray(list) ? list.map(ensureAttachment).filter(Boolean) : [];
}

module.exports = {
  normalizeFileName,
  buildPublicUrl,
  ensureAttachment,
  normalizeAttachments,
};
