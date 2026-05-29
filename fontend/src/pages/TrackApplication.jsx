import React, { useState } from "react";
import { Search } from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import GovHeader from "../components/GovHeader.jsx";
import { getApiErrorMessage, trackApplication } from "../lib/api";
import { applicationStatusLabel, paymentStatusLabel } from "../lib/statusLabels.js";

const STATUS_LABELS = {
  DRAFT: "Lưu nháp",
  PENDING: "Chờ tiếp nhận",
  PROCESSING: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  SUPPLEMENTED: "Đã bổ sung",
  COMPLETED: "Đã hoàn thành",
  REJECTED: "Đã từ chối",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

export default function TrackApplication() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onTrack(event) {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const { data } = await trackApplication(code.trim());
      setResult(data);
    } catch (error) {
      setErr(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const application = result?.application;
  const timeline = result?.timeline || application?.timeline || application?.history || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <GovHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <BackToDashboardButton variant="soft" className="mb-5" />
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">Theo dõi hồ sơ</h1>
          <p className="mt-2 text-sm text-slate-600">Nhập mã hồ sơ để xem trạng thái xử lý, thanh toán và lịch sử cập nhật.</p>
          <form onSubmit={onTrack} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: HS-20260527-ABCD" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-[#003366]" />
            </div>
            <button disabled={loading} className="rounded-xl bg-[#003366] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {loading ? "Đang tra cứu..." : "Tra cứu"}
            </button>
          </form>
        </section>

        {err ? <div className="mt-6 rounded-2xl bg-red-50 p-5 text-red-700 ring-1 ring-red-200">{err}</div> : null}

        {application ? (
          <div className="mt-6 grid gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Thông tin hồ sơ</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Mã hồ sơ" value={application.applicationCode || application.dossierCode || application.dossierId || application.id} />
                <Info label="Dịch vụ" value={application.serviceName} />
                <Info label="Trạng thái" value={STATUS_LABELS[String(application.status || "").toUpperCase()] || applicationStatusLabel(application.status)} />
                <Info label="Ngày nộp" value={formatDate(application.createdAt)} />
                <Info label="Thanh toán" value={paymentStatusLabel(application.paymentStatus, "-")} />
                <Info label="Lệ phí" value={`${new Intl.NumberFormat("vi-VN").format(application.fee || 0)} VNĐ`} />
              </div>
            </section>

            {Array.isArray(result.notifications) && result.notifications.length ? (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="text-lg font-black text-amber-900">Thông báo</h2>
                <div className="mt-3 grid gap-3">
                  {result.notifications.map((item) => (
                    <div key={item.notificationId || item.id} className="rounded-xl bg-white p-4 text-sm ring-1 ring-amber-100">
                      <div className="font-bold text-amber-900">{item.title}</div>
                      <div className="mt-1 text-amber-800">{item.message}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Timeline xử lý</h2>
              <div className="mt-4 space-y-3">
                {timeline.length ? timeline.map((item, idx) => (
                  <div key={`${item.createdAt || idx}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-bold">{STATUS_LABELS[String(item.status || "").toUpperCase()] || applicationStatusLabel(item.status)}</span>
                      <span className="font-semibold">{item.action || "Cập nhật"}</span>
                      <span className="text-slate-500">{formatDate(item.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{item.note || "-"}</div>
                  </div>
                )) : <div className="text-sm text-slate-500">Chưa có lịch sử xử lý.</div>}
              </div>
            </section>
          </div>
        ) : null}
      </main>
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
