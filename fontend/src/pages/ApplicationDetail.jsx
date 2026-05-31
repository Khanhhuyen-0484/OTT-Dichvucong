import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import GovHeader from "../components/GovHeader.jsx";
import {
  downloadApplicationResult,
  createBankTransferPayment,
  getApiErrorMessage,
  getApplicationDetail,
  getBankTransferPaymentStatus,
  supplementApplication,
} from "../lib/api";
import { applicationStatusLabel, isPaidStatus, paymentStatusLabel } from "../lib/statusLabels.js";

// Placeholder QR images (use data URLs) — replace with real assets if available
const PLACEHOLDER_QR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-size='20'%3EQR%3C/text%3E%3C/svg%3E";
const momo1 = PLACEHOLDER_QR;
const momo2 = PLACEHOLDER_QR;
const momo3 = PLACEHOLDER_QR;
const zalopay1 = PLACEHOLDER_QR;
const zalopay2 = PLACEHOLDER_QR;
const zalopay3 = PLACEHOLDER_QR;

const STATUS_LABELS = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ tiếp nhận",
  PROCESSING: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  SUPPLEMENTED: "Đã bổ sung",
  COMPLETED: "Đã hoàn thành",
  REJECTED: "Đã từ chối",
};

const STATUS_STYLES = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PROCESSING: "border-blue-200 bg-blue-50 text-blue-700",
  NEED_MORE: "border-orange-200 bg-orange-50 text-orange-700",
  SUPPLEMENTED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

const PAYMENT_LABELS = {
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  MOMO: "MoMo",
  ZALOPAY: "ZaloPay",
  PAID: "Đã thanh toán",
  COMPLETED: "Đã thanh toán",
  PENDING: "Chờ thanh toán",
  UNPAID: "Chưa thanh toán",
};

const currency = new Intl.NumberFormat("vi-VN");

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
  const [paymentInfo, setPaymentInfo] = useState(null);
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
    stopPaymentPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await getBankTransferPaymentStatus(applicationCode);
        const { paymentStatus: status } = statusRes.data;
        setPaymentInfo(statusRes.data?.payment || null);
        setPaymentStatus(status);
        if (isPaidStatus(status)) {
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
      const { data } = await createBankTransferPayment({
        dossierId: applicationCodeOf(item) || applicationCode,
        amount: item?.fee || 0,
      });
      setPaymentInfo(data || null);
      setQrCode(data?.qrUrl || data?.qrImageUrl || data?.qrCode || getQRImage());
      setPaymentStatus("pending");
      setPaymentExpireAt(item?.paymentExpireAt || new Date(Date.now() + 60 * 60 * 1000).toISOString());
      startPaymentPolling();
    } catch (error) {
      alert(getApiErrorMessage(error));
      setShowPaymentModal(false);
    } finally {
      setGeneratingQr(false);
    }
  }

  async function handleCheckPaymentStatus() {
    try {
      const { data } = await getBankTransferPaymentStatus(applicationCode);
      const nextStatus = data?.paymentStatus || "UNPAID";
      setPaymentInfo(data?.payment || null);
      setPaymentStatus(nextStatus);
      if (isPaidStatus(nextStatus)) {
        stopPaymentPolling();
        await loadDetail();
        setShowPaymentModal(false);
      }
    } catch (error) {
      alert(getApiErrorMessage(error));
    }
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

  const statusKey = String(item?.status || "").toUpperCase();
  const statusLabel = STATUS_LABELS[statusKey] || applicationStatusLabel(item?.status, "-");
  const paymentMethodKey = String(item?.paymentMethod || "").toUpperCase();
  const paymentStatusKey = String(item?.paymentStatus || "").toUpperCase();
  const feeText = `${currency.format(item?.fee || 0)} VNĐ`;
  const hasUnpaidFee = Number(item?.fee || 0) > 0 && !isPaidStatus(paymentStatusKey);
  const formData = item?.formData || {};
  const timeline = item?.timeline || item?.history || [];
  const applicantInfo = [
    { label: "Họ tên", value: item?.citizenName || formData.fullName },
    { label: "CCCD/CMND", value: item?.citizenId || formData.citizenId },
    { label: "Email", value: item?.email || formData.email },
    { label: "Số điện thoại", value: item?.phone || formData.phone },
    { label: "Địa chỉ", value: item?.address || formData.address, wide: true },
    { label: "Nội dung hồ sơ", value: formData.requestContent || formData.note, wide: true },
  ].filter((info) => info.value);

  return (
    <div className="min-h-screen">
      <GovHeader />
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <Link
          to="/my-applications"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-(--gov-navy) shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>

        {loading && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="h-6 w-48 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        )}
        {!loading && err && <div className="mt-6 rounded-3xl bg-red-50 p-6 font-semibold text-red-700 ring-1 ring-red-200">{err}</div>}

        {!loading && !err && item && (
          <div className="mt-6 space-y-6">
            <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-950/8">
              <div className="bg-linear-to-r from-[#003366] via-[#075b99] to-[#0f766e] p-4 text-white sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/85 ring-1 ring-white/20">
                      <FileText className="h-3.5 w-3.5" />
                      Chi tiết hồ sơ
                    </div>
                    <h1 className="mt-4 text-xl font-black leading-tight md:text-3xl">{item.serviceName || "Dịch vụ công"}</h1>
                    <p className="mt-2 break-all text-sm font-semibold text-blue-50">Mã hồ sơ: {applicationCodeOf(item)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <StatusBadge status={statusKey} label={statusLabel} />
                    {item.status === "COMPLETED" ? (
                      <button
                        type="button"
                        onClick={handleDownloadResult}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-emerald-600"
                      >
                        <Download className="h-4 w-4" />
                        Tải kết quả
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5 lg:grid-cols-4">
                <Info icon={<ShieldCheck />} label="Trạng thái" value={statusLabel} accent="blue" />
                <Info icon={<CalendarDays />} label="Ngày nộp" value={formatDate(item.createdAt)} accent="slate" />
                <Info icon={<ReceiptText />} label="Lệ phí" value={feeText} accent="emerald" />
                <Info icon={<CreditCard />} label="Thanh toán" value={PAYMENT_LABELS[paymentStatusKey] || PAYMENT_LABELS[paymentMethodKey] || paymentStatusLabel(paymentStatusKey || paymentMethodKey, "-")} accent="amber" />
              </div>

              {hasUnpaidFee && (["DRAFT", "PENDING"].includes(statusKey) || ["UNPAID", "PENDING"].includes(paymentStatusKey)) && (
                <div className="mx-5 mb-5 rounded-3xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                        <WalletCards className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black text-amber-900">Hồ sơ đang lưu nháp</p>
                        <p className="mt-1 text-sm font-semibold text-amber-800">Hoàn tất thanh toán để gửi hồ sơ sang bộ phận tiếp nhận xử lý.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handlePaymentClick}
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 transition sm:w-auto hover:-translate-y-0.5 hover:bg-red-700"
                    >
                      Thanh toán ngay
                    </button>
                  </div>
                </div>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle icon={<Landmark />} title="Thông tin hồ sơ" subtitle="Các thông tin chính người dân đã nộp" />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Info label="Mã hồ sơ" value={applicationCodeOf(item)} />
                  <Info label="Phương thức thanh toán" value={PAYMENT_LABELS[paymentMethodKey] || item.paymentMethod || "-"} />
                  {applicantInfo.length ? (
                    applicantInfo.map((info) => (
                      <Info key={info.label} label={info.label} value={info.value} wide={info.wide} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm font-semibold text-slate-500 sm:col-span-2">
                      Chưa có thông tin công dân chi tiết.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle icon={<Clock3 />} title="Timeline xử lý" subtitle="Theo dõi các mốc xử lý hồ sơ" />
                <div className="mt-5 space-y-4">
                  {timeline.map((t, idx) => (
                    <TimelineItem key={`${t.createdAt || idx}`} item={t} isLast={idx === timeline.length - 1} />
                  ))}
                  {!timeline.length && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                      Chưa có lịch sử xử lý.
                    </div>
                  )}
                </div>
              </section>
            </div>

            {(item.status === "NEED_MORE" || item.status === "REJECTED") && (
              <section className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  icon={<AlertTriangle />}
                  title={item.status === "NEED_MORE" ? "Bổ sung hồ sơ" : "Lý do từ chối"}
                  subtitle="Ghi chú phản hồi từ cán bộ xử lý"
                />
                <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900 ring-1 ring-orange-200">
                  <div className="font-black">Ghi chú của admin</div>
                  <div className="mt-1 font-semibold">{adminNote || "-"}</div>
                </div>

                {item.status === "NEED_MORE" && (
                  <div className="mt-5 space-y-4">
                    <SupplementForm form={supplementForm} setForm={setSupplementForm} />
                    <textarea value={supplementText} onChange={(e) => setSupplementText(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-semibold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100" placeholder="Nhập nội dung bổ sung theo ghi chú của admin..." />
                    <input type="file" multiple onChange={(e) => setSupplementFiles([...(e.target.files || [])])} className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold" />
                    <button disabled={busy || !supplementText.trim()} onClick={handleSupplementSubmit} className="inline-flex rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
                      Gửi bổ sung hồ sơ
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h2 className="mb-4 text-xl font-black text-slate-900">Thanh toán hồ sơ</h2>
            {generatingQr ? <div className="py-8 text-center text-slate-600">Đang tạo mã QR...</div> : qrCode ? (
              <div>
                <div className="mb-4 rounded-lg bg-slate-50 p-3 sm:p-4">
                  <img src={qrCode} alt="Payment QR Code" className="mx-auto w-full max-w-72" />
                  {paymentExpireAt && <p className="mt-3 text-center text-xs text-red-600">Hết hạn: {new Date(paymentExpireAt).toLocaleString("vi-VN")}</p>}
                </div>
                {paymentInfo ? (
                  <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <PaymentLine label="Ngân hàng" value={paymentInfo.bankCode || paymentInfo.bankName} />
                    <PaymentLine label="Số tài khoản" value={paymentInfo.bankAccount || paymentInfo.accountNo} />
                    <PaymentLine label="Chủ tài khoản" value={paymentInfo.bankAccountName || paymentInfo.accountName} />
                    <PaymentLine label="Số tiền" value={paymentInfo.amount ? `${currency.format(paymentInfo.amount)} VNĐ` : feeText} />
                    <PaymentLine label="Nội dung" value={paymentInfo.transferContent} strong />
                  </div>
                ) : null}
                <div className="mb-4 text-center text-sm text-slate-600">{isPaidStatus(paymentStatus) ? "Thanh toán thành công!" : paymentStatusLabel(paymentStatus, "Đang chờ thanh toán...")}</div>
                <div className="grid gap-2 sm:flex">
                  <button onClick={() => setShowPaymentModal(false)} className="flex-1 rounded-lg bg-slate-200 px-4 py-2 font-semibold">Đóng</button>
                  <button onClick={handleCheckPaymentStatus} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Kiểm tra thanh toán</button>
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

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-(--gov-navy) ring-1 ring-blue-100">
        {React.cloneElement(icon, { className: "h-5 w-5" })}
      </div>
      <div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }) {
  const className = STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black shadow-sm ${className}`}>
      <CheckCircle2 className="h-4 w-4" />
      {label}
    </span>
  );
}

function PaymentLine({ label, value, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 font-semibold text-slate-500">{label}</span>
      <span className={`text-right text-slate-900 ${strong ? "font-black" : "font-bold"}`}>{value || "-"}</span>
    </div>
  );
}

function Info({ label, value, icon, accent = "slate", wide = false }) {
  const accentClass = {
    blue: "bg-blue-50 text-(--gov-navy) ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-50 text-slate-600 ring-slate-100",
  }[accent] || "bg-slate-50 text-slate-600 ring-slate-100";

  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${accentClass}`}>
            {React.cloneElement(icon, { className: "h-5 w-5" })}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 wrap-break-word text-sm font-black text-slate-950">{value || "-"}</div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item, isLast }) {
  const status = String(item.status || "").toUpperCase();
  const label = STATUS_LABELS[status] || applicationStatusLabel(item.status, "Cập nhật");
  const className = STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="relative pl-8">
      {!isLast ? <div className="absolute left-[11px] top-7 h-full w-px bg-slate-200" /> : null}
      <div className="absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full bg-white ring-4 ring-blue-50">
        <div className="h-2.5 w-2.5 rounded-full bg-(--gov-navy)" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${className}`}>{label}</span>
          {item.action ? <span className="font-black text-slate-900">{item.action}</span> : null}
        </div>
        <div className="mt-2 text-sm font-semibold text-slate-700">{item.note || "-"}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
          <span>{formatDate(item.createdAt)}</span>
          <span>Bởi: {item.actor || "-"}</span>
        </div>
      </div>
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
