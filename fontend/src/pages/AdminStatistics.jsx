import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Clock3, CreditCard, Download, FileText, PieChart, ReceiptText, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import { getAdminStatistics, getApiErrorMessage } from "../lib/api";
import { applicationStatusLabel } from "../lib/statusLabels.js";

const STATUS_LABELS = {
  pending: "Chờ tiếp nhận",
  processing: "Đang xử lý",
  needMore: "Yêu cầu bổ sung",
  supplemented: "Đã bổ sung",
  approved: "Đã duyệt",
  completed: "Hoàn thành",
  resultDelivered: "Đã trả kết quả",
  rejected: "Từ chối",
};

const STATUS_KEYS = ["pending", "processing", "needMore", "supplemented", "approved", "completed", "resultDelivered", "rejected"];
const STATUS_COLORS = {
  pending: "#64748b",
  processing: "#0284c7",
  needMore: "#f97316",
  supplemented: "#6366f1",
  approved: "#10b981",
  completed: "#059669",
  resultDelivered: "#14b8a6",
  rejected: "#dc2626",
};

const tabs = [
  { key: "overview", label: "Tổng quan" },
  { key: "applications", label: "Hồ sơ" },
  { key: "revenue", label: "Doanh thu" },
  { key: "services", label: "Dịch vụ" },
];

const quickRanges = [
  { key: "today", label: "Hôm nay" },
  { key: "7days", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
  { key: "year", label: "Năm nay" },
  { key: "custom", label: "Tùy chọn" },
];

const currency = new Intl.NumberFormat("vi-VN");

function formatCurrency(amount) {
  return `${currency.format(Number(amount || 0))} VNĐ`;
}

function formatCompactCurrency(amount) {
  const value = Number(amount || 0);
  if (value >= 1000000) return `${Math.round(value / 1000000)}tr`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return currency.format(value);
}

function formatDateInput(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getQuickRange(range) {
  const now = new Date();
  let from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "7days") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  }

  if (range === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (range === "year") {
    from = new Date(now.getFullYear(), 0, 1);
  }

  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
}

function repairTextEncoding(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/[ÃÂÄÅÆ]|[\u0080-\u009F]/.test(text) || typeof TextDecoder === "undefined") return text;
  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 255);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    return decoded || text;
  } catch {
    return text;
  }
}

function normalizeServiceName(value) {
  return repairTextEncoding(value)
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mergeApplicationsByService(items = []) {
  const map = new Map();

  items.forEach((item) => {
    const serviceName = repairTextEncoding(item.serviceName) || "Không rõ dịch vụ";
    const key = normalizeServiceName(serviceName) || String(item.serviceId || "unknown");
    const current = map.get(key) || {
      ...item,
      serviceName,
      serviceIds: new Set(),
      total: 0,
      completed: 0,
      rejected: 0,
      revenue: 0,
    };

    if (item.serviceId) current.serviceIds.add(item.serviceId);
    current.total += Number(item.total || 0);
    current.completed += Number(item.completed || 0);
    current.rejected += Number(item.rejected || 0);
    current.revenue += Number(item.revenue || 0);
    current.completedRate = current.total ? Math.round((current.completed / current.total) * 1000) / 10 : 0;
    current.serviceId = Array.from(current.serviceIds)[0] || item.serviceId || key;
    map.set(key, current);
  });

  return Array.from(map.values())
    .map(({ serviceIds, ...item }) => item)
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
}

function mergeRevenueByService(items = []) {
  const map = new Map();

  items.forEach((item) => {
    const serviceName = repairTextEncoding(item.serviceName) || "Không rõ dịch vụ";
    const key = normalizeServiceName(serviceName) || String(item.serviceId || "unknown");
    const current = map.get(key) || {
      ...item,
      serviceName,
      serviceIds: new Set(),
      revenue: 0,
      paidCount: 0,
    };

    if (item.serviceId) current.serviceIds.add(item.serviceId);
    current.revenue += Number(item.revenue || 0);
    current.paidCount += Number(item.paidCount || 0);
    current.serviceId = Array.from(current.serviceIds)[0] || item.serviceId || key;
    map.set(key, current);
  });

  return Array.from(map.values())
    .map(({ serviceIds, ...item }) => item)
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
}

function exportCsv(data) {
  const totals = data.totals || data.overview || {};
  const rows = [];
  rows.push(["Tổng hồ sơ", totals.totalApplications || 0]);
  rows.push(["Hồ sơ hôm nay", totals.todayApplications || 0]);
  rows.push(["Hồ sơ tháng này", totals.monthApplications || 0]);
  rows.push(["Tổng doanh thu", totals.totalRevenue || data.revenue?.totalRevenue || 0]);
  rows.push(["Doanh thu hôm nay", totals.todayRevenue || data.revenue?.todayRevenue || 0]);
  rows.push(["Doanh thu tháng này", totals.monthRevenue || data.revenue?.monthRevenue || 0]);
  rows.push([]);
  rows.push(["Trạng thái", "Số lượng"]);
  Object.entries(data.byStatus || {}).forEach(([key, value]) => rows.push([STATUS_LABELS[key] || key, value]));
  rows.push([]);
  rows.push(["Dịch vụ", "Doanh thu"]);
  (data.revenueByService || data.revenue?.byService || []).forEach((item) => {
    rows.push([item.serviceName || "Không rõ dịch vụ", item.revenue || 0]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "thong-ke-ho-so-doanh-thu.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function StatusDonut({ byStatus = {}, total = 0 }) {
  const visibleItems = STATUS_KEYS
    .map((key) => ({ key, value: Number(byStatus[key] || 0) }))
    .filter((item) => item.value > 0);
  const chartTotal = visibleItems.reduce((sum, item) => sum + item.value, 0);
  const displayTotal = chartTotal || total || 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = visibleItems.map((item) => {
    const length = displayTotal ? (item.value / displayTotal) * circumference : 0;
    const segment = { ...item, length, offset };
    offset += length;
    return segment;
  });

  if (!displayTotal) return <EmptyText>Chưa có dữ liệu trạng thái hồ sơ.</EmptyText>;

  return (
    <div className="grid gap-5 md:grid-cols-[190px_1fr] md:items-center">
      <div className="relative mx-auto h-44 w-44">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e0f2fe" strokeWidth="13" />
          {segments.map((item) => (
            <circle
              key={item.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={STATUS_COLORS[item.key]}
              strokeWidth="13"
              strokeDasharray={`${item.length} ${circumference - item.length}`}
              strokeDashoffset={-item.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-4xl font-black tracking-tight text-blue-700">{displayTotal}</div>
            <div className="mt-1 text-xs font-bold uppercase text-slate-500">Hồ sơ</div>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {visibleItems.map(({ key, value }) => {
          const percent = displayTotal ? Math.round((value / displayTotal) * 100) : 0;
          return (
            <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                <span className="truncate text-sm font-bold text-slate-700">{STATUS_LABELS[key]}</span>
              </div>
              <span className="shrink-0 text-sm font-black text-slate-900">{value} - {percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevenueLineChart({ items = [] }) {
  if (!items.length) return <EmptyText>Chưa có dữ liệu doanh thu theo ngày.</EmptyText>;
  const width = 640;
  const height = 210;
  const paddingX = 52;
  const paddingY = 24;
  const values = items.map((item) => Number(item.revenue || 0));
  const maxValue = Math.max(10000, ...values);
  const roundedMax = Math.ceil(maxValue / 10000) * 10000;
  const stepX = items.length > 1 ? (width - paddingX * 2) / (items.length - 1) : 0;
  const points = items.map((item, index) => {
    const x = items.length > 1 ? paddingX + index * stepX : width - paddingX;
    const y = height - paddingY - (Number(item.revenue || 0) / roundedMax) * (height - paddingY * 2);
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingY} ${line} ${points[points.length - 1]?.x || width - paddingX},${height - paddingY}`;
  const ticks = [0, 0.5, 1].map((ratio) => Math.round(roundedMax * ratio));
  const lastPoint = points[points.length - 1];

  return (
    <div className="group relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full rounded-3xl bg-linear-to-br from-slate-50 via-blue-50/60 to-cyan-50/50 ring-1 ring-slate-200/70">
        <defs>
          <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = height - paddingY - (tick / roundedMax) * (height - paddingY * 2);
          return (
            <g key={tick}>
              <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x="12" y={y + 4} className="fill-slate-400 text-[11px] font-bold">{formatCompactCurrency(tick)}</text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#revenueArea)" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#2563eb" stroke="#ffffff" strokeWidth="3" />
            <title>{`${point.date}: ${formatCurrency(point.revenue)} (${point.paidCount || 0} giao dịch)`}</title>
          </g>
        ))}
        {lastPoint ? (
          <text x={Math.max(82, Math.min(lastPoint.x - 28, width - 135))} y={Math.max(20, lastPoint.y - 12)} className="fill-blue-700 text-[12px] font-black">
            {formatCurrency(lastPoint.revenue)}
          </text>
        ) : null}
      </svg>
      <div className="mt-3 flex justify-between gap-3 text-xs font-semibold text-slate-500">
        <span>{items[0]?.date || ""}</span>
        <span>{items[items.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}

function ServiceBarChart({ items = [], mode = "applications" }) {
  if (!items.length) return <EmptyText>{mode === "revenue" ? "Chưa có doanh thu theo dịch vụ." : "Chưa có dữ liệu hồ sơ theo dịch vụ."}</EmptyText>;
  const topItems = items.slice(0, 8);
  const max = Math.max(1, ...topItems.map((item) => Number(mode === "revenue" ? item.revenue : item.total) || 0));
  return (
    <div className="space-y-4">
      {topItems.map((item) => {
        const value = Number(mode === "revenue" ? item.revenue : item.total) || 0;
        const percent = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={`${mode}-${item.serviceId || item.serviceName}`} className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-800">{item.serviceName || "Không rõ dịch vụ"}</div>
                <div className="text-xs font-semibold text-slate-500">
                  {mode === "revenue" ? `${item.paidCount || 0} giao dịch` : `Hoàn thành ${item.completed || 0}, từ chối ${item.rejected || 0}`}
                </div>
              </div>
              <div className="shrink-0 text-sm font-black text-[#003366]">{mode === "revenue" ? formatCurrency(value) : value}</div>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              <div className={`h-full rounded-full bg-linear-to-r ${mode === "revenue" ? "from-emerald-500 to-teal-400" : "from-blue-600 to-cyan-400"}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminStatistics() {
  const initialRange = getQuickRange("today");
  const [data, setData] = useState(null);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [activeTab, setActiveTab] = useState("overview");
  const [quickRange, setQuickRange] = useState("today");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load(nextFromDate = fromDate, nextToDate = toDate) {
    setLoading(true);
    setErr("");
    try {
      const res = await getAdminStatistics({ fromDate: nextFromDate, toDate: nextToDate });
      setData(res.data);
    } catch (error) {
      setErr(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function applyQuickRange(range) {
    setQuickRange(range);
    if (range === "custom") return;

    const nextRange = getQuickRange(range);
    setFromDate(nextRange.from);
    setToDate(nextRange.to);
    load(nextRange.from, nextRange.to);
  }

  useEffect(() => {
    load(initialRange.from, initialRange.to);
  }, []);

  const totals = data?.totals || {
    totalApplications: data?.overview?.totalApplications || 0,
    todayApplications: data?.overview?.todayApplications || 0,
    monthApplications: data?.overview?.monthApplications || 0,
    totalRevenue: data?.revenue?.totalRevenue || 0,
    todayRevenue: data?.revenue?.todayRevenue || 0,
    monthRevenue: data?.revenue?.monthRevenue || 0,
    paidCount: data?.revenue?.paidTransactions || 0,
    pendingPaymentCount: data?.revenue?.pendingPaymentCount || 0,
    unpaidCount: data?.revenue?.unpaidTransactions || 0,
  };

  const applicationsByService = useMemo(
    () => mergeApplicationsByService(data?.byService || []),
    [data]
  );
  const revenueByService = useMemo(
    () => mergeRevenueByService(data?.revenueByService || data?.revenue?.byService || []),
    [data]
  );
  const revenueByDate = data?.revenueByDate || data?.revenue?.byDate || [];
  const latestPayments = data?.latestPayments || [];
  const latestApplications = data?.latestApplications || [];

  const statusTotal = useMemo(
    () => Object.values(data?.byStatus || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    [data]
  );
  const maxServiceRevenue = useMemo(
    () => Math.max(1, ...revenueByService.map((item) => Number(item.revenue || 0))),
    [revenueByService]
  );
  const maxDateRevenue = useMemo(
    () => Math.max(1, ...revenueByDate.map((item) => Number(item.revenue || 0))),
    [revenueByDate]
  );
  const statGroups = [
    {
      title: "Nhóm hồ sơ",
      cards: [
        { label: "Tổng hồ sơ", value: totals.totalApplications || 0, description: "Tổng số hồ sơ hiện có", icon: FileText },
        { label: "Hồ sơ hôm nay", value: totals.todayApplications || 0, description: "Phát sinh trong hôm nay", icon: CalendarDays },
        { label: "Hồ sơ tháng này", value: totals.monthApplications || 0, description: "Phát sinh trong tháng này", icon: Clock3 },
      ],
    },
    {
      title: "Nhóm doanh thu",
      cards: [
        { label: "Tổng doanh thu", value: formatCurrency(totals.totalRevenue), description: "Doanh thu tích lũy", icon: WalletCards },
        { label: "Doanh thu hôm nay", value: formatCurrency(totals.todayRevenue), description: "Thanh toán trong hôm nay", icon: CreditCard },
        { label: "Doanh thu tháng này", value: formatCurrency(totals.monthRevenue), description: "Thanh toán trong tháng này", icon: TrendingUp },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#effcff_48%,#f8fafc_100%)] text-slate-900">
      <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-6 xl:px-8">
        <BackToDashboardButton label="Quay lại" variant="soft" className="mb-5" />

        <section className="relative overflow-hidden rounded-4xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-950/5 ring-1 ring-slate-200/70 backdrop-blur">
          <div className="absolute inset-0 bg-linear-to-br from-blue-100/70 via-cyan-50/80 to-emerald-100/60" />
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-cyan-300/25 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-blue-700 to-cyan-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-600/20">
                <TrendingUp className="h-4 w-4" />
                Thống kê
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Thống kê hồ sơ</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Theo dõi số lượng hồ sơ, trạng thái xử lý và doanh thu thanh toán theo khoảng thời gian.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {quickRanges.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => applyQuickRange(item.key)}
                    className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                      quickRange === item.key
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-white/85 text-slate-700 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setQuickRange("custom");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setQuickRange("custom");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => load()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Lọc
                </button>
                <button
                  type="button"
                  disabled={!data}
                  onClick={() => exportCsv(data)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-blue-700 to-cyan-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Xuất CSV
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-20 mt-6 flex flex-wrap gap-2 rounded-3xl border border-white/80 bg-white/90 p-2 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                activeTab === tab.key
                  ? "bg-linear-to-r from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? <div className="mt-6 rounded-3xl bg-white/90 p-6 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">Đang tải thống kê...</div> : null}
        {err ? <div className="mt-6 rounded-3xl bg-red-50/90 p-6 font-bold text-red-700 shadow-sm ring-1 ring-red-200">{err}</div> : null}

        {!loading && data ? (
          <div className="mt-6">
            {activeTab === "overview" ? (
              <section>
                <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                  <BarChart3 className="h-5 w-5" />
                  Tổng quan
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  {statGroups.map((group) => (
                    <section key={group.title} className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/70">
                      <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">{group.title}</div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {group.cards.map((card) => (
                          <StatCard
                            key={card.label}
                            label={card.label}
                            value={card.value}
                            description={card.description}
                            icon={card.icon}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <Panel
                    title="Tình trạng hồ sơ"
                    description="Thống kê theo trạng thái xử lý"
                    icon={<PieChart className="h-5 w-5" />}
                  >
                    <StatusDonut byStatus={data.byStatus || {}} total={statusTotal} />
                  </Panel>
                  <Panel
                    title="Xu hướng doanh thu"
                    description="Doanh thu theo thời gian"
                    icon={<TrendingUp className="h-5 w-5" />}
                    action={<TimeRangeFilter active={quickRange} onChange={applyQuickRange} />}
                  >
                    <RevenueLineChart items={revenueByDate} />
                  </Panel>
                </div>
              </section>
            ) : null}

            {activeTab === "applications" ? (
              <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <Panel title="Hồ sơ theo trạng thái" icon={<PieChart className="h-5 w-5" />}>
                  <StatusDonut byStatus={data.byStatus || {}} total={statusTotal} />
                </Panel>

                <Panel title="Hồ sơ mới nhất">
                  <LatestApplications items={latestApplications} />
                </Panel>
              </section>
            ) : null}

            {activeTab === "revenue" ? (
              <section className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <StatCard label="Tổng doanh thu" value={formatCurrency(totals.totalRevenue)} />
                  <StatCard label="Doanh thu hôm nay" value={formatCurrency(totals.todayRevenue)} />
                  <StatCard label="Doanh thu tháng này" value={formatCurrency(totals.monthRevenue)} />
                  <StatCard label="Đã thanh toán" value={totals.paidCount || 0} />
                  <StatCard
                    label="Chờ thanh toán"
                    value={totals.pendingPaymentCount || 0}
                    subValue={`Chưa thanh toán/thất bại: ${totals.unpaidCount || 0}`}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <Panel title="Doanh thu theo ngày">
                    <RevenueLineChart items={revenueByDate} />
                    <div className="mt-5 space-y-4">
                      {revenueByDate.length ? (
                        revenueByDate.map((item) => (
                          <RevenueBar
                            key={item.date}
                            label={item.date}
                            value={item.revenue}
                            total={maxDateRevenue}
                            meta={`${item.paidCount || 0} giao dịch`}
                          />
                        ))
                      ) : (
                        <EmptyText>Chưa có doanh thu theo ngày trong khoảng lọc.</EmptyText>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Giao dịch thanh toán mới nhất" icon={<ReceiptText className="h-5 w-5" />}>
                    <LatestPayments items={latestPayments} />
                  </Panel>
                </div>
              </section>
            ) : null}

            {activeTab === "services" ? (
              <section className="grid gap-6 lg:grid-cols-2">
                <Panel title="Hồ sơ theo dịch vụ">
                  <ServiceBarChart items={applicationsByService} mode="applications" />
                </Panel>

                <Panel title="Doanh thu theo dịch vụ">
                  <ServiceBarChart items={revenueByService} mode="revenue" />
                  <div className="mt-5 space-y-4">
                    {revenueByService.length ? (
                      revenueByService.map((item) => (
                        <RevenueBar
                          key={item.serviceId}
                          label={item.serviceName || "Không rõ dịch vụ"}
                          value={item.revenue}
                          total={maxServiceRevenue}
                          meta={`${item.paidCount || 0} giao dịch`}
                        />
                      ))
                    ) : (
                      <EmptyText>Chưa có doanh thu theo dịch vụ.</EmptyText>
                    )}
                  </div>
                </Panel>
              </section>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value, subValue, description, icon: Icon }) {
  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-blue-100/70 bg-linear-to-br from-white to-blue-50/45 p-5 shadow-md shadow-slate-950/5 ring-1 ring-slate-200/60 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-200/35 blur-2xl transition group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-blue-700">{value}</div>
        </div>
        {Icon ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-100/80 text-blue-700 ring-1 ring-blue-200/70">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {description ? <div className="relative mt-3 text-xs font-semibold text-slate-500">{description}</div> : null}
      {subValue ? <div className="mt-2 text-xs font-medium text-slate-500">{subValue}</div> : null}
    </div>
  );
}

function Panel({ title, description, icon, action, children }) {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/92 p-5 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icon ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">{icon}</span> : null}
          <div>
            <div className="text-base font-black text-slate-900">{title}</div>
            {description ? <div className="mt-1 text-sm font-semibold text-slate-500">{description}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyText({ children }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm font-semibold text-slate-500">{children}</div>;
}

function TimeRangeFilter({ active, onChange }) {
  const items = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày" },
    { key: "month", label: "Tháng này" },
  ];

  return (
    <div className="flex rounded-2xl bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
            active === item.key
              ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"
              : "text-slate-500 hover:text-blue-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MiniBar({ label, value, total }) {
  const percent = total ? Math.round((Number(value || 0) / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="text-slate-500">{value} hồ sơ</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-linear-to-r from-blue-600 to-cyan-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RevenueBar({ label, value, total, meta }) {
  const percent = Math.max(3, Math.round((Number(value || 0) / Number(total || 1)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-4 text-sm">
        <div className="min-w-0">
          <div className="truncate font-bold text-slate-700">{label}</div>
          {meta ? <div className="text-xs text-slate-500">{meta}</div> : null}
        </div>
        <span className="shrink-0 font-bold text-blue-700">{formatCurrency(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ApplicationsByService({ items }) {
  if (!items.length) {
    return <EmptyText>Chưa có dữ liệu hồ sơ theo dịch vụ.</EmptyText>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.serviceId} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900">{item.serviceName || "Không rõ dịch vụ"}</div>
              <div className="mt-1 text-xs text-slate-500">
                Hoàn thành {item.completed || 0}, từ chối {item.rejected || 0}
              </div>
            </div>
            <div className="text-2xl font-black text-blue-700">{item.total || 0}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LatestApplications({ items }) {
  if (!items.length) {
    return <EmptyText>Chưa có hồ sơ mới trong khoảng lọc.</EmptyText>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.dossierId} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-900">{item.serviceName || "Không rõ dịch vụ"}</div>
              <div className="mt-1 text-xs text-slate-500">{item.dossierCode || item.dossierId}</div>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
              {item.statusLabel || applicationStatusLabel(item.status)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

function LatestPayments({ items }) {
  if (!items.length) {
    return <EmptyText>Chưa có giao dịch thanh toán thành công.</EmptyText>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-linear-to-r from-slate-50 via-blue-50 to-cyan-50 text-xs uppercase text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-3 pr-4">Mã thanh toán</th>
            <th className="py-3 pr-4">Hồ sơ</th>
            <th className="py-3 pr-4">Dịch vụ</th>
            <th className="py-3 pr-4">Số tiền</th>
            <th className="py-3 pr-4">Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.paymentId || `${item.dossierId}-${item.paidAt}`} className="border-b border-slate-100 hover:bg-blue-50/50">
              <td className="py-3 pr-4 font-semibold text-slate-800">{item.paymentId || "-"}</td>
              <td className="py-3 pr-4 text-slate-600">{item.dossierId || "-"}</td>
              <td className="py-3 pr-4 text-slate-600">{item.serviceName || "Không rõ dịch vụ"}</td>
              <td className="py-3 pr-4 font-bold text-blue-700">{formatCurrency(item.amount)}</td>
              <td className="py-3 pr-4 text-slate-500">{formatDate(item.paidAt || item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
