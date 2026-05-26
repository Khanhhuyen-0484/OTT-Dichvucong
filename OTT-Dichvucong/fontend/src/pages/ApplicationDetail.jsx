import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import {
  downloadApplicationResult,
  getApiErrorMessage,
  getApplicationDetail,
  mockPaymentComplete,
  supplementApplication,
  verifyPaymentStatus
} from "../lib/api";

import momo1 from "../assets/payment-qrs/momo_a1.jpg";
import momo2 from "../assets/payment-qrs/momo_a2.jpg";
import momo3 from "../assets/payment-qrs/momo_a3.jpg";
import zalopay1 from "../assets/payment-qrs/zalopay_b1.jpg";
import zalopay2 from "../assets/payment-qrs/zalopayb2.jpg";
import zalopay3 from "../assets/payment-qrs/zalopay_b3.jpg";

function formatDate(dateStr) {
  return dateStr ? new Date(dateStr).toLocaleString("vi-VN") : "";
}

const STATUS_LABELS = {
  PENDING: "Đã nộp",
  PROCESSING: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  COMPLETED: "Đã hoàn thành",
  REJECTED: "Đã từ chối",
  APPROVED: "Đã phê duyệt",
  CANCELLED: "Đã hủy"
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Chưa rõ";
}

function isUnpaid(status, fee = 0) {
  if (Number(fee || 0) <= 0) return false;
  return ["UNPAID", "PENDING", "pending"].includes(status);
}

function paymentStatusLabel(status) {
  switch (status) {
    case "pending":
    case "PENDING":
    case "UNPAID":
      return "Chờ thanh toán";
    case "completed":
    case "PAID":
      return "Thanh toán thành công";
    case "expired":
    case "EXPIRED":
      return "Hết hạn thanh toán";
    default:
      return status || "Chờ thanh toán";
  }
}

function applicationPaymentLabel(item) {
  if (Number(item?.fee || 0) <= 0) return "Đã thanh toán";
  return paymentStatusLabel(item?.paymentStatus);
}

function attachmentUrl(file) {
  return file?.previewUrl || file?.publicUrl || file?.url || file?.fileUrl || file?.path || "";
}

function isStorageKey(key) {
  return ["attachments/", "chat-media/", "avatars/"].some((prefix) =>
    String(key || "").startsWith(prefix)
  );
}

function attachmentViewUrl(file) {
  const key = file?.s3Key || file?.storageKey || "";
  if (isStorageKey(key)) {
    return `/api/upload/file?key=${encodeURIComponent(key)}`;
  }

  if (isStorageKey(file?.key)) {
    return `/api/upload/file?key=${encodeURIComponent(file.key)}`;
  }

  const url = attachmentUrl(file);
  return url ? `/api/upload/file?url=${encodeURIComponent(url)}` : "";
}

export default function ApplicationDetail() {
  const { applicationCode } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [supplementText, setSupplementText] = useState("");
  const [supplementFiles, setSupplementFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const pollIntervalRef = useRef(null);

  const loadData = useCallback(async () => {
    const { data } = await getApplicationDetail(applicationCode);
    setItem(data.application || data);
  }, [applicationCode]);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch (e) {
        setErr(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  useEffect(() => () => stopPaymentPolling(), []);

  const getQRImage = useCallback(() => {
    const name = (item?.serviceName || "").toLowerCase();
    const idx = name.includes("khai sinh") ? 3 : name.includes("tạm trú") ? 2 : 1;
    const method = item?.paymentMethod || "ZaloPay";
    if (method === "MoMo") return idx === 2 ? momo2 : idx === 3 ? momo3 : momo1;
    return idx === 2 ? zalopay2 : idx === 3 ? zalopay3 : zalopay1;
  }, [item]);

  function stopPaymentPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  function startPaymentPolling() {
    stopPaymentPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await verifyPaymentStatus(applicationCode);
        const { paymentStatus: status } = statusRes.data;
        setPaymentStatus(status);
        if (status === "completed" || status === "PAID") {
          stopPaymentPolling();
          await loadData();
          setShowPaymentModal(false);
        }
      } catch {
        // Keep the modal open while users finish payment.
      }
    }, 3000);
  }

  async function handlePaymentClick() {
    setShowPaymentModal(true);
    setGeneratingQr(true);
    try {
      setQrCode(getQRImage());
      setPaymentStatus("pending");
      setPaymentExpireAt(item?.paymentExpireAt || new Date(Date.now() + 60 * 60 * 1000).toISOString());
      startPaymentPolling();
    } finally {
      setGeneratingQr(false);
    }
  }

  async function handleMockPaymentComplete() {
    await mockPaymentComplete(applicationCode);
    stopPaymentPolling();
    await loadData();
    setPaymentStatus("completed");
    setShowPaymentModal(false);
  }

  async function handleSupplementSubmit() {
    setBusy(true);
    try {
      const payload = {
        note: supplementText,
        attachments: supplementFiles.map((f) => ({ name: f.name, type: f.type, size: f.size }))
      };
      await supplementApplication(applicationCode, payload);
      await loadData();
      setSupplementText("");
      setSupplementFiles([]);
    } catch (e) {
      alert(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadResult() {
    try {
      const { data } = await downloadApplicationResult(applicationCode);
      setResult(data.result);
    } catch (e) {
      alert(getApiErrorMessage(e));
    }
  }

  return (
    <div className="min-h-screen">
      <GovHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/my-applications"
            className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-(--gov-navy) ring-1 ring-slate-200 hover:ring-slate-300"
          >
            ← Quay lại danh sách
          </Link>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            Đang tải chi tiết hồ sơ...
          </div>
        )}

        {!loading && err && (
          <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}

        {!loading && !err && item && (
          <>
            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h1 className="text-2xl font-black text-slate-900">Chi tiết hồ sơ</h1>
              <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <div><strong>Mã hồ sơ:</strong> {item.dossierCode || item.applicationCode || item.dossierId}</div>
                <div><strong>Dịch vụ:</strong> {item.serviceName}</div>
                <div><strong>Trạng thái:</strong> {statusLabel(item.status)}</div>
                <div><strong>Ngày nộp:</strong> {formatDate(item.createdAt)}</div>
                <div><strong>Lệ phí:</strong> {new Intl.NumberFormat("vi-VN").format(item.fee || 0)} VNĐ</div>
                <div><strong>Thanh toán:</strong> {applicationPaymentLabel(item)}</div>
                <div><strong>Phương thức thanh toán:</strong> {item.paymentMethod || "—"}</div>
              </div>

              {item.status === "COMPLETED" && (
                <button onClick={handleDownloadResult} className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                  Tải kết quả
                </button>
              )}

              {isUnpaid(item.paymentStatus, item.fee) && (
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-3 text-sm text-amber-800">
                    Hồ sơ chưa thanh toán. Vui lòng hoàn tất thanh toán để tiếp tục xử lý.
                  </p>
                  <button onClick={handlePaymentClick} className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">
                    Thanh toán ngay
                  </button>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">Thông tin kê khai</h2>
              <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <div><strong>Họ tên:</strong> {item.formData?.fullName || item.citizenName || "—"}</div>
                <div><strong>Email:</strong> {item.formData?.email || item.email || "—"}</div>
                <div><strong>Số điện thoại:</strong> {item.formData?.phone || item.phone || "—"}</div>
                <div><strong>CCCD/CMND:</strong> {item.formData?.citizenId || "—"}</div>
                <div className="sm:col-span-2"><strong>Địa chỉ:</strong> {item.formData?.address || "—"}</div>
                <div className="sm:col-span-2"><strong>Nội dung yêu cầu:</strong> {item.formData?.requestContent || "—"}</div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">Tài liệu đính kèm</h2>
              {!item.attachments?.length ? (
                <div className="mt-4 text-sm text-slate-600">Chưa có tài liệu đính kèm.</div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {item.attachments.map((file, idx) => {
                    const url = attachmentViewUrl(file);
                    const isImage = file.type?.startsWith("image/") || file.mimeType?.startsWith("image/");

                    return (
                      <div key={`${file.key || file.name}-${idx}`} className="rounded-xl border border-slate-200 p-4">
                        <div className="font-bold text-slate-900">{file.name || file.fileName || file.key || "Tài liệu"}</div>
                        <div className="mt-2 text-sm text-slate-600">
                          <div><strong>Loại:</strong> {file.type || file.mimeType || "—"}</div>
                          <div><strong>Kích thước:</strong> {file.size ? `${Math.round(file.size / 1024)} KB` : "—"}</div>
                        </div>
                        {url && isImage && (
                          <div className="mt-3">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={file.name || "Ảnh hồ sơ đã nộp"} className="h-64 w-full rounded-lg border bg-slate-50 object-contain" />
                            </a>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100">
                              Xem ảnh
                            </a>
                          </div>
                        )}
                        {url && !isImage && (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100">
                            Tải tệp
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">Timeline xử lý</h2>
              <div className="mt-4 space-y-3">
                {(item.timeline || item.history || []).map((t, idx) => (
                  <div key={`${t.createdAt || t.at || idx}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{statusLabel(t.status)}</span>
                      <span className="font-semibold">{t.action}</span>
                      <span className="text-slate-500">{formatDate(t.createdAt || t.at)}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{t.note || "—"}</div>
                    <div className="mt-1 text-xs text-slate-500">Bởi: {t.actor || "—"}</div>
                  </div>
                ))}
                {!(item.timeline || item.history || []).length && <div className="text-sm text-slate-500">Chưa có lịch sử xử lý.</div>}
              </div>
            </section>

            {(item.status === "NEED_MORE" || item.status === "REJECTED") && (
              <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="text-xl font-black text-slate-900">{item.status === "NEED_MORE" ? "Bổ sung hồ sơ" : "Lý do từ chối"}</h2>
                <div className="mt-3 text-sm text-slate-700">{item.decisionNote || item.timeline?.slice(-1)?.[0]?.note || "—"}</div>
                {item.status === "NEED_MORE" && (
                  <div className="mt-4 space-y-3">
                    <textarea value={supplementText} onChange={(e) => setSupplementText(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 p-3 outline-none" placeholder="Nhập thông tin bổ sung..." />
                    <input type="file" multiple onChange={(e) => setSupplementFiles([...e.target.files || []])} className="block w-full text-sm" />
                    <button disabled={busy} onClick={handleSupplementSubmit} className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Gửi bổ sung</button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-black text-slate-900">Thanh toán hồ sơ</h2>
            {generatingQr ? (
              <div className="py-8 text-center text-slate-600">Đang tạo mã QR...</div>
            ) : qrCode ? (
              <div>
                <div className="mb-4 rounded-lg bg-slate-50 p-4">
                  <img src={qrCode} alt="Payment QR Code" className="w-full" />
                  {paymentExpireAt && <p className="mt-3 text-center text-xs text-red-600">Hết hạn: {new Date(paymentExpireAt).toLocaleString("vi-VN")}</p>}
                </div>
                <div className="mb-4 text-center text-sm text-slate-600">{paymentStatusLabel(paymentStatus)}</div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPaymentModal(false)} className="flex-1 rounded-lg bg-slate-200 px-4 py-2 font-semibold">Thoát</button>
                  <button onClick={handleMockPaymentComplete} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Thanh toán</button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-red-600">Không thể tạo mã QR</div>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h3 className="text-xl font-black">Kết quả hồ sơ</h3>
            <pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-4 text-sm">{JSON.stringify(result, null, 2)}</pre>
            <button onClick={() => setResult(null)} className="mt-4 rounded-lg bg-slate-200 px-4 py-2 font-semibold">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
