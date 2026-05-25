import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import {
  getApiErrorMessage,
  getApplicationDetail,
  verifyPaymentStatus,
  mockPaymentComplete,
  supplementApplication,
  downloadApplicationResult
} from "../lib/api";

import momo1 from "../assets/payment-qrs/momo_a1.jpg";
import momo2 from "../assets/payment-qrs/momo_a2.jpg";
import momo3 from "../assets/payment-qrs/momo_a3.jpg";
import zalopay1 from "../assets/payment-qrs/zalopay_b1.jpg";
import zalopay2 from "../assets/payment-qrs/zalopayb2.jpg";
import zalopay3 from "../assets/payment-qrs/zalopay_b3.jpg";

function formatDate(dateStr) { return dateStr ? new Date(dateStr).toLocaleString("vi-VN") : ""; }
const STATUS_LABELS = { PENDING: "Chờ tiếp nhận", PROCESSING: "Đang xử lý", NEED_MORE: "Yêu cầu bổ sung", COMPLETED: "Đã hoàn thành", REJECTED: "Đã từ chối" };

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

  useEffect(() => { (async () => { try { const { data } = await getApplicationDetail(applicationCode); setItem(data.application || data); } catch (e) { setErr(getApiErrorMessage(e)); } finally { setLoading(false); } })(); }, [applicationCode]);
  useEffect(() => () => stopPaymentPolling(), []);

  const getQRImage = useCallback(() => { const name = (item?.serviceName || "").toLowerCase(); const idx = name.includes("khai sinh") ? 3 : name.includes("tạm trú") ? 2 : 1; const method = item?.paymentMethod || "ZaloPay"; if (method === "MoMo") return idx === 2 ? momo2 : idx === 3 ? momo3 : momo1; return idx === 2 ? zalopay2 : idx === 3 ? zalopay3 : zalopay1; }, [item]);
  function startPaymentPolling() { pollIntervalRef.current = setInterval(async () => { try { const statusRes = await verifyPaymentStatus(applicationCode); const { paymentStatus: status } = statusRes.data; setPaymentStatus(status); if (status === "completed" || status === "PAID") { stopPaymentPolling(); const { data } = await getApplicationDetail(applicationCode); setItem(data.application || data); setShowPaymentModal(false); } } catch {} }, 3000); }
  function stopPaymentPolling() { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
  async function handlePaymentClick() { setShowPaymentModal(true); setGeneratingQr(true); try { setQrCode(getQRImage()); setPaymentStatus("pending"); setPaymentExpireAt(item?.paymentExpireAt || new Date(Date.now() + 60 * 60 * 1000).toISOString()); startPaymentPolling(); } finally { setGeneratingQr(false); } }
  function handleMockPaymentComplete() { mockPaymentComplete(applicationCode).then(async () => { stopPaymentPolling(); const { data } = await getApplicationDetail(applicationCode); setItem(data.application || data); setShowPaymentModal(false); }); }
  async function handleSupplementSubmit() { setBusy(true); try { const payload = { note: supplementText, attachments: supplementFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })) }; await supplementApplication(applicationCode, payload); const { data } = await getApplicationDetail(applicationCode); setItem(data.application || data); setSupplementText(""); setSupplementFiles([]); } catch (e) { alert(getApiErrorMessage(e)); } finally { setBusy(false); } }
  async function handleDownloadResult() { try { const { data } = await downloadApplicationResult(applicationCode); setResult(data.result); } catch (e) { alert(getApiErrorMessage(e)); } }

  return <div className="min-h-screen"><GovHeader /><main className="mx-auto max-w-5xl px-4 py-10"><div className="flex flex-wrap items-center gap-3"><Link to="/my-applications" className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--gov-navy)] ring-1 ring-slate-200 hover:ring-slate-300">← Quay lại danh sách</Link></div>{loading && <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">Đang tải chi tiết hồ sơ...</div>}{!loading && err && <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">{err}</div>}{!loading && !err && item && <><section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200"><h1 className="text-2xl font-black text-slate-900">Chi tiết hồ sơ</h1><div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2"><div><strong>Mã hồ sơ:</strong> {item.applicationCode}</div><div><strong>Dịch vụ:</strong> {item.serviceName}</div><div><strong>Trạng thái:</strong> {STATUS_LABELS[item.status] || item.status}</div><div><strong>Ngày nộp:</strong> {formatDate(item.createdAt)}</div><div><strong>Lệ phí:</strong> {new Intl.NumberFormat("vi-VN").format(item.fee || 0)} VNĐ</div><div><strong>Phương thức thanh toán:</strong> {item.paymentMethod || "—"}</div></div>{item.status === "COMPLETED" && <button onClick={handleDownloadResult} className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Tải kết quả</button>}{item.status === "PENDING" && <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4"><p className="text-sm text-amber-800 mb-3">⚠️ Hồ sơ chưa thanh toán.</p><button onClick={handlePaymentClick} className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">💳 Thanh toán ngay</button></div>}</section><section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200"><h2 className="text-xl font-black text-slate-900">Timeline xử lý</h2><div className="mt-4 space-y-3">{(item.timeline || item.history || []).map((t, idx) => <div key={`${t.createdAt || idx}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{t.status}</span><span className="font-semibold">{t.action}</span><span className="text-slate-500">{formatDate(t.createdAt)}</span></div><div className="mt-2 text-sm text-slate-700">{t.note || "—"}</div><div className="mt-1 text-xs text-slate-500">Bởi: {t.actor || "—"}</div></div>)}{!(item.timeline || item.history || []).length && <div className="text-sm text-slate-500">Chưa có lịch sử xử lý.</div>}</div></section>{(item.status === "NEED_MORE" || item.status === "REJECTED") && <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200"><h2 className="text-xl font-black text-slate-900">{item.status === "NEED_MORE" ? "Bổ sung hồ sơ" : "Lý do từ chối"}</h2><div className="mt-3 text-sm text-slate-700">{item.decisionNote || item.timeline?.slice(-1)?.[0]?.note || "—"}</div>{item.status === "NEED_MORE" && <div className="mt-4 space-y-3"><textarea value={supplementText} onChange={(e) => setSupplementText(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 p-3 outline-none" placeholder="Nhập thông tin bổ sung..." /><input type="file" multiple onChange={(e) => setSupplementFiles([...e.target.files || []])} className="block w-full text-sm" /><button disabled={busy} onClick={handleSupplementSubmit} className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Gửi bổ sung</button></div>}</section>}</>}
      </main>{showPaymentModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="mb-4 text-xl font-black text-slate-900">Thanh toán hồ sơ</h2>{generatingQr ? <div className="py-8 text-center text-slate-600">Đang tạo mã QR...</div> : qrCode ? <div><div className="mb-4 rounded-lg bg-slate-50 p-4"><img src={qrCode} alt="Payment QR Code" className="w-full" />{paymentExpireAt && <p className="mt-3 text-center text-xs text-red-600">Hết hạn: {new Date(paymentExpireAt).toLocaleString("vi-VN")}</p>}</div><div className="mb-4 text-center text-sm text-slate-600">{paymentStatus === "pending" ? "⏳ Đang chờ thanh toán..." : "✅ Thanh toán thành công!"}</div><div className="flex gap-2"><button onClick={() => setShowPaymentModal(false)} className="flex-1 rounded-lg bg-slate-200 px-4 py-2 font-semibold">Đóng</button><button onClick={handleMockPaymentComplete} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Thanh toán</button></div></div> : <div className="py-4 text-center text-red-600">Không thể tạo mã QR</div>}</div></div>}{result && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6"><h3 className="text-xl font-black">Kết quả hồ sơ</h3><pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-4 text-sm">{JSON.stringify(result, null, 2)}</pre><button onClick={() => setResult(null)} className="mt-4 rounded-lg bg-slate-200 px-4 py-2 font-semibold">Đóng</button></div></div>}</div>;
}