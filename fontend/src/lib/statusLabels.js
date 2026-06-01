const APPLICATION_STATUS_LABELS = {
  ALL: "Tất cả",
  DRAFT: "Lưu nháp",
  PENDING: "Chờ tiếp nhận",
  SUBMITTED: "Đã nộp",
  RECEIVED: "Đã tiếp nhận",
  PROCESSING: "Đang xử lý",
  IN_PROGRESS: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  REQUEST_SUPPLEMENT: "Yêu cầu bổ sung",
  SUPPLEMENTED: "Đã bổ sung",
  APPROVED: "Đã duyệt",
  COMPLETED: "Đã hoàn thành",
  DONE: "Đã hoàn thành",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  OVERDUE: "Quá hạn",
  RESULT_DELIVERED: "Đã trả kết quả",
};

const PAYMENT_STATUS_LABELS = {
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  MOMO: "MoMo",
  ZALOPAY: "ZaloPay",
  CASH: "Tiền mặt",
  PAID: "Đã thanh toán",
  COMPLETED: "Đã thanh toán",
  SUCCESS: "Đã thanh toán",
  SUCCEEDED: "Đã thanh toán",
  PENDING: "Chờ thanh toán",
  WAITING: "Chờ thanh toán",
  UNPAID: "Chưa thanh toán",
  FAILED: "Thanh toán thất bại",
  EXPIRED: "Đã hết hạn",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function readableFallback(value, fallback = "Chưa rõ") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

export function applicationStatusLabel(status, fallback = "Chưa rõ") {
  const key = normalizeStatus(status);
  return APPLICATION_STATUS_LABELS[key] || readableFallback(status, fallback);
}

export function paymentStatusLabel(status, fallback = "Chưa rõ") {
  const key = normalizeStatus(status);
  return PAYMENT_STATUS_LABELS[key] || readableFallback(status, fallback);
}

export function isPaidStatus(status) {
  return ["PAID", "COMPLETED", "SUCCESS", "SUCCEEDED"].includes(normalizeStatus(status));
}

export { APPLICATION_STATUS_LABELS, PAYMENT_STATUS_LABELS };
