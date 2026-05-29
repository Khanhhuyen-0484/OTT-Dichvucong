import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileClock,
  FileText,
  Layers3,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import GovHeader from "../components/GovHeader.jsx";
import { getAllMyApplications, getApiErrorMessage, getServiceNotifications } from "../lib/api";
import { useAuth } from "../context/AuthContext.jsx";
import { connectSocket } from "../lib/socket.js";
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

function applicationCodeOf(item) {
  return item?.applicationCode || item?.dossierCode || item?.dossierId || item?.id || "";
}

function applicationUrlOf(item) {
  if (item?.localDraft && item?.serviceId) return `/services/${item.serviceId}`;
  return `/my-applications/${item?.dossierId || item?.applicationId || item?.applicationCode || item?.dossierCode || item?.id || ""}`;
}

function readLocalDrafts(user) {
  const userKey = user?.id || user?.email || user?.phone || "guest";
  const drafts = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("dvc-draft-")) continue;
    try {
      const draft = JSON.parse(localStorage.getItem(key) || "{}");
      if (!draft?.serviceId) continue;
      if (draft.userKey && draft.userKey !== userKey) continue;
      drafts.push({
        ...draft,
        localDraft: true,
        id: key,
        applicationCode: `DRAFT-${draft.serviceId}`,
        serviceName: draft.serviceName || "Hồ sơ lưu nháp",
        fee: draft.fee || 0,
        status: "DRAFT",
        paymentStatus: "UNPAID",
        createdAt: draft.updatedAt || draft.createdAt,
      });
    } catch {}
  }
  return drafts.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

export default function MyApplications() {
  const { user } = useAuth();
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
      const localDrafts = readLocalDrafts(user);
      setDrafts([...(data.drafts || []), ...localDrafts]);
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

  const stats = useMemo(() => {
    const completed = items.filter((item) => String(item.status || "").toUpperCase() === "COMPLETED").length;
    const processing = items.filter((item) => ["PENDING", "PROCESSING", "SUPPLEMENTED"].includes(String(item.status || "").toUpperCase())).length;
    return [
      { label: "Đã nộp", value: submitted.length, icon: <ClipboardList />, tone: "blue" },
      { label: "Lưu nháp", value: drafts.length, icon: <FileClock />, tone: "amber" },
      { label: "Đang xử lý", value: processing, icon: <Layers3 />, tone: "sky" },
      { label: "Hoàn thành", value: completed, icon: <CheckCircle2 />, tone: "emerald" },
    ];
  }, [items, submitted.length, drafts.length]);

  const tabs = [
    { key: "submitted", label: "Hồ sơ đã nộp", count: submitted.length },
    { key: "draft", label: "Hồ sơ lưu nháp", count: drafts.length },
    { key: "all", label: "Tất cả", count: items.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <GovHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <BackToDashboardButton to="/" replace variant="soft" className="mb-5 self-start" />

        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-950/8">
          <div className="bg-linear-to-r from-[#003366] via-[#075b99] to-[#0f766e] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/85 ring-1 ring-white/20">
                  <FileText className="h-3.5 w-3.5" />
                  Quản lý hồ sơ
                </div>
                <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">Hồ sơ của tôi</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-blue-50">
                  Theo dõi hồ sơ đã nộp, hồ sơ lưu nháp và các yêu cầu bổ sung trong một màn hình gọn gàng.
                </p>
              </div>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-(--gov-navy) shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                Nộp hồ sơ mới
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </section>

        {loading && (
          <div className="mt-6 grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
            ))}
          </div>
        )}
        {!loading && err && <div className="mt-6 rounded-3xl bg-red-50 p-6 font-semibold text-red-700 ring-1 ring-red-200">{err}</div>}
        {!loading && !err && note && <div className="mt-6 rounded-3xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">{note}</div>}

        {!loading && !err && needMoreNotifications.length > 0 && (
          <section className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-black text-orange-950">Thông báo cần bổ sung hồ sơ</div>
                <p className="mt-1 text-sm font-semibold text-orange-800">Các hồ sơ dưới đây cần được cập nhật thêm thông tin.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {needMoreNotifications.slice(0, 5).map((notification) => (
                <div key={notification.notificationId || notification.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-orange-100">
                  <div className="font-black text-orange-950">{notification.title || "Hồ sơ cần bổ sung"}</div>
                  <div className="mt-2 rounded-2xl bg-orange-50 p-3 text-orange-900">
                    <div className="text-xs font-black uppercase text-orange-700">Ghi chú của admin</div>
                    <div className="mt-1 font-semibold">{notification.message || "Admin yêu cầu bổ sung thông tin hồ sơ."}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold text-orange-600">{formatDate(notification.createdAt)}</div>
                    <Link to={notification.actionUrl || applicationUrlOf(notification)} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-700">
                      Bổ sung hồ sơ
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && !err && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setView(tab.key)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-black ring-1 transition ${
                    view === tab.key
                      ? "bg-(--gov-navy) text-white ring-(--gov-navy) shadow-lg shadow-blue-950/15"
                      : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-blue-50 hover:text-(--gov-navy)"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${view === tab.key ? "bg-white/15 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!loading && !err && visibleItems.length === 0 && (
          <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-(--gov-navy)">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div className="mt-4 text-lg font-black text-slate-950">
              {view === "draft" ? "Chưa có hồ sơ lưu nháp" : view === "submitted" ? "Chưa có hồ sơ đã nộp" : "Chưa có hồ sơ nào"}
            </div>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">
              {view === "draft" ? "Hồ sơ chưa thanh toán xong sẽ hiển thị tại đây." : view === "submitted" ? "Các hồ sơ đã thanh toán thành công sẽ hiển thị tại đây." : "Bạn chưa có hồ sơ nào."}
            </p>
          </div>
        )}

        {!loading && !err && visibleItems.length > 0 && (
          <div className="mt-6 grid gap-4">
            {visibleItems.map((item) => (
              <ApplicationCard key={applicationCodeOf(item)} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, tone }) {
  const toneClass = {
    blue: "bg-blue-50 text-(--gov-navy) ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  }[tone] || "bg-slate-50 text-slate-700 ring-slate-100";

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-3xl font-black text-slate-950">{value}</div>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${toneClass}`}>
          {React.cloneElement(icon, { className: "h-5 w-5" })}
        </div>
      </div>
    </div>
  );
}

function ApplicationCard({ item }) {
  const status = String(item.status || "").toUpperCase();
  const paymentStatus = String(item.paymentStatus || "").toUpperCase();
  const paymentMethod = String(item.paymentMethod || "").toUpperCase();
  const code = applicationCodeOf(item);
  const detailUrl = applicationUrlOf(item);
  const actionLabel = status === "NEED_MORE" ? "Bổ sung hồ sơ" : status === "DRAFT" || paymentStatus === "UNPAID" ? "Tiếp tục hồ sơ" : "Xem chi tiết";
  const actionClass = status === "NEED_MORE"
    ? "bg-orange-600 text-white ring-orange-600 hover:bg-orange-700"
    : "bg-white text-(--gov-navy) ring-blue-100 hover:bg-blue-50 hover:ring-blue-200";

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/8">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-(--gov-navy) ring-1 ring-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-950">{item.serviceName || "Dịch vụ công"}</h2>
              <p className="mt-1 wrap-break-word text-xs font-bold text-slate-500">{item.localDraft ? `Đang dừng ở bước ${item.step || 1}/4${item.stepTitle ? ` - ${item.stepTitle}` : ""}` : `Mã hồ sơ: ${code || "-"}`}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoChip icon={<CalendarDays />} label="Ngày nộp" value={formatDate(item.createdAt) || "-"} />
            <InfoChip icon={<ReceiptText />} label="Lệ phí" value={`${currency.format(item.fee || 0)} VNĐ`} />
            <InfoChip icon={<WalletCards />} label="Thanh toán" value={PAYMENT_LABELS[paymentStatus] || PAYMENT_LABELS[paymentMethod] || paymentStatusLabel(paymentStatus || paymentMethod, "-")} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-black ring-1 ${statusClass(status)}`}>
            {STATUS_LABELS[status] || applicationStatusLabel(status || item.status)}
          </span>
          <Link
            to={detailUrl}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ring-1 transition ${actionClass}`}
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function InfoChip({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
        {React.cloneElement(icon, { className: "h-3.5 w-3.5" })}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}
