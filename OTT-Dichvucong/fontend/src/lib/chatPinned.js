export const MAX_PINNED_MESSAGES = 3;

export function getPinnedMessages(messages = []) {
  return messages
    .filter((m) => m && (m.isPinned ?? m.pinned) && !m.unsentForAll)
    .sort((a, b) => {
      const ta = new Date(a.pinnedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.pinnedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
}

export function getPinnedPreviewText(message) {
  if (!message) return "Tin nhắn ghim";
  if (message.unsentForAll) return "Tin nhắn đã được thu hồi";
  if (message.text?.trim()) return message.text.trim();
  if (message.media?.type === "image" || message.type === "image") return "Ảnh";
  if (message.media?.type === "video" || message.type === "video") return "Video";
  if (message.location) return "Vị trí";
  if (message.media?.type === "file" || message.fileUrl) {
    return message.media?.name || message.fileName || "Tệp đính kèm";
  }
  if (message.messageType === "call_log" || message.callLog) return "Cuộc gọi";
  return "Tin nhắn ghim";
}

export function canPinMore(messages = [], messageId) {
  const target = messages.find((m) => m.id === messageId);
  if (target && (target.isPinned ?? target.pinned)) return true;
  return getPinnedMessages(messages).length < MAX_PINNED_MESSAGES;
}
