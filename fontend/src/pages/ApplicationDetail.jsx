import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import {
  downloadApplicationResult,
  getApiErrorMessage,
  getApplicationDetail,
  mockPaymentComplete,
  supplementApplication,
  verifyPaymentStatus,
} from "../lib/api";

// Placeholder QR images (use data URLs) — replace with real assets if available
const PLACEHOLDER_QR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-size='20'%3EQR%3C/text%3E%3C/svg%3E";
const momo1 = PLACEHOLDER_QR;
const momo2 = PLACEHOLDER_QR;
const momo3 = PLACEHOLDER_QR;
const zalopay1 = PLACEHOLDER_QR;
const zalopay2 = PLACEHOLDER_QR;
const zalopay3 = PLACEHOLDER_QR;

const STATUS_LABELS = {
  PENDING: "Chờ tiếp nhận",
  PROCESSING: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  SUPPLEMENTED: "Đã bổ sung",
  COMPLETED: "Đã hoàn thành",
  REJECTED: "Đã từ chối",
};

function formatDate(dateStr) {
  return dateStr ? new Date(dateStr).toLocaleString("vi-VN") : "";
}

function applicationCodeOf(item) {
  return item?.applicationCode || item?.dossierCode || item?.dossierId || item?.id || "";
}

export default function ApplicationDetail() {
  const { applicationCode } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [supplementText, setSupplementText] = useState("");
  const [supplementForm, setSupplementForm] = useState({ fullName: "", citizenId: "", email: "", phone: "", address: "", requestContent: "" });
  const [supplementFiles, setSupplementFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const pollIntervalRef = useRef(null);

  async function loadDetail() {
    try {
      const { data } = await getApplicationDetail(applicationCode);
      const nextItem = data.application || data;
      const formData = nextItem?.formData || {};
      setItem(nextItem);
      setNotifications(data.notifications || []);
      setSupplementForm({
        fullName: nextItem?.citizenName || formData.fullName || "",
        citizenId: nextItem?.citizenId || formData.citizenId || "",
        email: nextItem?.email || formData.email || "",
        phone: nextItem?.phone || formData.phone || "",
        address: nextItem?.address || formData.address || "",
        requestContent: formData.requestContent || formData.note || "",
      });
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [applicationCode]);

  useEffect(() => () => stopPaymentPolling(), []);

  const getQRImage = useCallback(() => {
    const name = (item?.serviceName || "").toLowerCase();
    const idx = name.includes("khai sinh") ? 3 : name.includes("tạm trú") ? 2 : 1;
    const method = item?.paymentMethod || "ZaloPay";
    if (method === "MoMo") return idx === 2 ? momo2 : idx === 3 ? momo3 : momo1;
    return idx === 2 ? zalopay2 : idx === 3 ? zalopay3 : zalopay1;
  }, [item]);

  const adminNeedMoreNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const type = String(n.status || n.type || "").toUpperCase();
      const code = String(n.dossierId || n.applicationId || "");
      return type === "NEED_MORE" && (!code || code === String(applicationCode));
    });
  }, [notifications, applicationCode]);

  const adminNote = item?.decisionNote || item?.timeline?.slice(-1)?.[0]?.note || adminNeedMoreNotifications[0]?.message || "";

  function startPaymentPolling() {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await verifyPaymentStatus(applicationCode);
        const { paymentStatus: status } = statusRes.data;
        setPaymentStatus(status);
        if (status === "completed" || status === "PAID") {
          stopPaymentPolling();
          await loadDetail();
          setShowPaymentModal(false);
        }
      } catch {}
    }, 3000);
  }

  function stopPaymentPolling() {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
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
    await loadDetail();
    setShowPaymentModal(false);
  }

  async function handleSupplementSubmit() {
    setBusy(true);
    try {
      const payload = {
        note: supplementText,
        formData: { ...supplementForm, supplementNote: supplementText },
        attachments: supplementFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      };
      await supplementApplication(applicationCode, payload);
      await loadDetail();
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
          <Link to="/my-applications" className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--gov-navy)] ring-1 ring-slate-200 hover:ring-slate-300">
            ← Quay lại danh sách
          </Link>
        </div>

        {loading && <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">Đang tải chi tiết hồ sơ...</div>}
        {!loading && err && <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">{err}</div>}

        {!loading && !err && item && (
          <>
            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h1 className="text-2xl font-black text-slate-900">Chi tiết hồ sơ</h1>
              <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <Info label="Mã hồ sơ" value={applicationCodeOf(item)} />
                <Info label="Dịch vụ" value={item.serviceName} />
                <Info label="Trạng thái" value={STATUS_LABELS[item.status] || item.status} />
                <Info label="Ngày nộp" value={formatDate(item.createdAt)} />
                <Info label="Lệ phí" value={`${new Intl.NumberFormat("vi-VN").format(item.fee || 0)} VNĐ`} />
                <Info label="Phương thức thanh toán" value={item.paymentMethod || "-"} />
              </div>

              {item.status === "COMPLETED" && <button onClick={handleDownloadResult} className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Tải kết quả</button>}
              {item.status === "PENDING" && (
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-3 text-sm text-amber-800">Hồ sơ chưa thanh toán.</p>
                  <button onClick={handlePaymentClick} className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">Thanh toán ngay</button>
                </div>
              )}
            </section>

            {(item.status === "NEED_MORE" || item.status === "REJECTED") && (
              <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="text-xl font-black text-slate-900">{item.status === "NEED_MORE" ? "Bổ sung hồ sơ" : "Lý do từ chối"}</h2>
                <div className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-900 ring-1 ring-orange-200">
                  <div className="font-black">Ghi chú của admin</div>
                  <div className="mt-1">{adminNote || "-"}</div>
                </div>

                {item.status === "NEED_MORE" && (
                  <div className="mt-4 space-y-4">
                    <SupplementForm form={supplementForm} setForm={setSupplementForm} />
                    <textarea value={supplementText} onChange={(e) => setSupplementText(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" placeholder="Nhập nội dung bổ sung theo ghi chú của admin..." />
                    <input type="file" multiple onChange={(e) => setSupplementFiles([...(e.target.files || [])])} className="block w-full text-sm" />
                    <button disabled={busy || !supplementText.trim()} onClick={handleSupplementSubmit} className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                      Gửi bổ sung hồ sơ
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">Timeline xử lý</h2>
              <div className="mt-4 space-y-3">
                {(item.timeline || item.history || []).map((t, idx) => (
                  <div key={`${t.createdAt || idx}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{STATUS_LABELS[t.status] || t.status}</span>
                      <span className="font-semibold">{t.action}</span>
                      <span className="text-slate-500">{formatDate(t.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{t.note || "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">Bởi: {t.actor || "-"}</div>
                  </div>
                ))}
                {!(item.timeline || item.history || []).length && <div className="text-sm text-slate-500">Chưa có lịch sử xử lý.</div>}
              </div>
            </section>
          </>
        )}
      </main>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-black text-slate-900">Thanh toán hồ sơ</h2>
            {generatingQr ? <div className="py-8 text-center text-slate-600">Đang tạo mã QR...</div> : qrCode ? (
              <div>
                <div className="mb-4 rounded-lg bg-slate-50 p-4">
                  <img src={qrCode} alt="Payment QR Code" className="w-full" />
                  {paymentExpireAt && <p className="mt-3 text-center text-xs text-red-600">Hết hạn: {new Date(paymentExpireAt).toLocaleString("vi-VN")}</p>}
                </div>
                <div className="mb-4 text-center text-sm text-slate-600">{paymentStatus === "pending" ? "Đang chờ thanh toán..." : "Thanh toán thành công!"}</div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPaymentModal(false)} className="flex-1 rounded-lg bg-slate-200 px-4 py-2 font-semibold">Đóng</button>
                  <button onClick={handleMockPaymentComplete} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Thanh toán</button>
                </div>
              </div>
            ) : <div className="py-4 text-center text-red-600">Không thể tạo mã QR</div>}
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

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}

function SupplementForm({ form, setForm }) {
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Họ tên" value={form.fullName} onChange={(value) => update("fullName", value)} />
      <TextField label="CCCD/CMND" value={form.citizenId} onChange={(value) => update("citizenId", value)} />
      <TextField label="Email" value={form.email} onChange={(value) => update("email", value)} />
      <TextField label="Số điện thoại" value={form.phone} onChange={(value) => update("phone", value)} />
      <TextField label="Địa chỉ" value={form.address} onChange={(value) => update("address", value)} full />
      <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
        Nội dung hồ sơ
        <textarea value={form.requestContent} onChange={(e) => update("requestContent", e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-orange-500" />
      </label>
    </div>
  );
}

function TextField({ label, value, onChange, full = false }) {
  return (
    <label className={`block text-sm font-bold text-slate-700 ${full ? "sm:col-span-2" : ""}`}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-orange-500" />
    </label>
  );
}
