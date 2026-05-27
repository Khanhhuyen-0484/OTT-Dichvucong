import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import GovHeader from "../components/GovHeader.jsx";
import { getAllMyApplications, getApiErrorMessage, getServiceNotifications } from "../lib/api";
import { connectSocket } from "../lib/socket.js";

const STATUS_LABELS = {
  DRAFT: "Lưu nháp",
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

function statusClass(status) {
  switch (String(status || "").toUpperCase()) {
    case "DRAFT":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "PENDING":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "PROCESSING":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "NEED_MORE":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "SUPPLEMENTED":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "COMPLETED":
      return "bg-green-50 text-green-700 ring-green-200";
    case "REJECTED":
      return "bg-slate-100 text-slate-700 ring-slate-300";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function applicationCodeOf(item) {
  return item?.applicationCode || item?.dossierCode || item?.dossierId || item?.id || "";
}

function applicationUrlOf(item) {
  return `/my-applications/${item?.dossierId || item?.applicationId || item?.applicationCode || item?.dossierCode || item?.id || ""}`;
}

export default function MyApplications() {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [submitted, setSubmitted] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [view, setView] = useState("submitted");
  const [notifications, setNotifications] = useState([]);

  async function loadData() {
    try {
      const [{ data }, notificationRes] = await Promise.all([
        getAllMyApplications(),
        getServiceNotifications().catch(() => ({ data: { notifications: [] } })),
      ]);
      setItems(data.applications || []);
      setDrafts(data.drafts || []);
      setSubmitted(data.submitted || []);
      setNote(data.note || "");
      setNotifications(notificationRes.data.notifications || []);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    const handleUpdate = (payload) => {
      if (payload?.notification) {
        setNotifications((current) => [payload.notification, ...current.filter((item) => item.notificationId !== payload.notification.notificationId)]);
      }
      loadData();
    };
    socket.on("service-application-updated", handleUpdate);
    return () => socket.off("service-application-updated", handleUpdate);
  }, []);

  const visibleItems = view === "submitted" ? submitted : view === "draft" ? drafts : items;

  const needMoreNotifications = useMemo(() => {
    const activeNeedMoreCodes = new Set(
      [...items, ...submitted, ...drafts]
        .filter((item) => String(item.status || "").toUpperCase() === "NEED_MORE")
        .map(applicationCodeOf)
    );
    return notifications.filter((item) => {
      const type = String(item.status || item.type || "").toUpperCase();
      const code = item.dossierId || item.applicationId || item.applicationCode || item.dossierCode || item.id;
      return type === "NEED_MORE" && activeNeedMoreCodes.has(String(code || ""));
    });
  }, [notifications, items, submitted, drafts]);

  return (
    <div className="min-h-screen">
      <GovHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4">
          <BackToDashboardButton variant="soft" className="self-start" />
          <div>
            <h1 className="text-3xl font-black text-slate-900">Hồ sơ của tôi</h1>
            <p className="mt-2 text-slate-600">Xem hồ sơ nháp, hồ sơ đã nộp và các yêu cầu bổ sung trong một nơi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/services" className="inline-flex rounded-xl bg-[var(--gov-navy)] px-4 py-3 text-sm font-bold text-white hover:bg-[#19306f]">
              Nộp hồ sơ mới
            </Link>
          </div>
        </div>

        {loading && <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">Đang tải lịch sử hồ sơ...</div>}
        {!loading && err && <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">{err}</div>}
        {!loading && !err && note && <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">{note}</div>}

        {!loading && !err && needMoreNotifications.length > 0 && (
          <section className="mt-6 rounded-2xl bg-orange-50 p-5 ring-1 ring-orange-200">
            <div className="text-lg font-black text-orange-900">Thông báo cần bổ sung hồ sơ</div>
            <div className="mt-3 grid gap-3">
              {needMoreNotifications.slice(0, 5).map((notification) => (
                <div key={notification.notificationId || notification.id} className="rounded-xl bg-white p-4 text-sm ring-1 ring-orange-100">
                  <div className="font-bold text-orange-900">{notification.title || "Hồ sơ cần bổ sung"}</div>
                  <div className="mt-2 rounded-lg bg-orange-50 p-3 text-orange-900">
                    <div className="text-xs font-black uppercase text-orange-700">Ghi chú của admin</div>
                    <div className="mt-1">{notification.message || "Admin yêu cầu bổ sung thông tin hồ sơ."}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-orange-600">{formatDate(notification.createdAt)}</div>
                    <Link to={notification.actionUrl || applicationUrlOf(notification)} className="inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700">
                      Bổ sung hồ sơ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !err && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => setView("submitted")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${view === "submitted" ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]" : "bg-white text-slate-700 ring-slate-200"}`}>Hồ sơ đã nộp</button>
            <button type="button" onClick={() => setView("draft")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${view === "draft" ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]" : "bg-white text-slate-700 ring-slate-200"}`}>Hồ sơ lưu nháp</button>
            <button type="button" onClick={() => setView("all")} className={`rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${view === "all" ? "bg-[var(--gov-navy)] text-white ring-[var(--gov-navy)]" : "bg-white text-slate-700 ring-slate-200"}`}>Tất cả</button>
          </div>
        )}

        {!loading && !err && visibleItems.length === 0 && (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
            <div className="text-lg font-bold text-slate-900">
              {view === "draft" ? "Chưa có hồ sơ lưu nháp" : view === "submitted" ? "Chưa có hồ sơ đã nộp" : "Chưa có hồ sơ nào"}
            </div>
            <p className="mt-2 text-slate-600">
              {view === "draft" ? "Hồ sơ chưa thanh toán xong sẽ hiển thị tại đây." : view === "submitted" ? "Các hồ sơ đã thanh toán thành công sẽ hiển thị tại đây." : "Bạn chưa có hồ sơ nào."}
            </p>
          </div>
        )}

        {!loading && !err && visibleItems.length > 0 && (
          <div className="mt-6 grid gap-4">
            {visibleItems.map((item) => {
              const status = String(item.status || "").toUpperCase();
              const paymentStatus = String(item.paymentStatus || "").toUpperCase();
              return (
                <div key={applicationCodeOf(item)} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-black text-slate-900">{item.serviceName}</div>
                      <div className="mt-2 text-sm text-slate-600">
                        <div><strong>Mã hồ sơ:</strong> {applicationCodeOf(item)}</div>
                        <div><strong>Ngày nộp:</strong> {formatDate(item.createdAt)}</div>
                        <div><strong>Lệ phí:</strong> {new Intl.NumberFormat("vi-VN").format(item.fee || 0)} VNĐ</div>
                        <div><strong>Thanh toán:</strong> {item.paymentMethod || "-"}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${statusClass(status)}`}>
                        {STATUS_LABELS[status] || item.status || "Chưa rõ"}
                      </span>
                      <Link
                        to={`/my-applications/${applicationCodeOf(item)}`}
                        className={`inline-flex rounded-xl px-4 py-2 text-sm font-bold ring-1 ${status === "NEED_MORE" ? "bg-orange-600 text-white ring-orange-600 hover:bg-orange-700" : "bg-white text-[var(--gov-navy)] ring-slate-200 hover:ring-slate-300"}`}
                      >
                        {status === "NEED_MORE" ? "Bổ sung hồ sơ" : status === "DRAFT" || paymentStatus === "UNPAID" ? "Tiếp tục hồ sơ" : "Xem chi tiết"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
