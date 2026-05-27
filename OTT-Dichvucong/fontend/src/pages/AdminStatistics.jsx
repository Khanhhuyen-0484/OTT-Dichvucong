import React, { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Filter, RefreshCw, TrendingUp, Users, BadgeCheck, Clock3, CircleAlert, CircleCheck, CircleX, DollarSign, FileText, BarChart3, PieChart, CalendarRange } from "lucide-react";
import { getAdminStatistics, getApiErrorMessage } from "../lib/api";

const STATUS_LABELS = {
  pending: "Chờ tiếp nhận",
  processing: "Đang xử lý",
  needMore: "Yêu cầu bổ sung",
  completed: "Hoàn thành",
  rejected: "Từ chối",
};

const FILTERS = [
  { id: "today", label: "Hôm nay" },
  { id: "month", label: "Tháng này" },
  { id: "year", label: "Năm này" },
  { id: "custom", label: "Tùy chọn" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}
function formatNumber(value) { return new Intl.NumberFormat("vi-VN").format(Number(value || 0)); }
function toDateInput(v) { return v ? new Date(v).toISOString().slice(0, 10) : ""; }
function buildMonthRange(mode) {
  const now = new Date();
  if (mode === "today") {
    const d = now.toISOString().slice(0, 10);
    return { fromDate: d, toDate: d };
  }
  if (mode === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { fromDate: from, toDate: to };
  }
  if (mode === "year") {
    const from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
    return { fromDate: from, toDate: to };
  }
  return { fromDate: "", toDate: "" };
}

function Card({ icon: Icon, title, value, sub }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-slate-500">{title}</div><div className="mt-2 text-3xl font-black text-slate-900">{value}</div>{sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}</div><div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><Icon className="h-5 w-5" /></div></div></div>;
}

function MiniBar({ label, value, total, color = "bg-[#003366]" }) {
  const width = total ? Math.max(4, Math.round((Number(value || 0) / Number(total || 1)) * 100)) : 0;
  return <div className="space-y-1"><div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className="font-bold text-slate-900">{formatNumber(value)}</span></div><div className="h-3 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>;
}

function exportCsv(data) {
  const rows = [];
  rows.push(["Tổng hồ sơ", data.overview.totalApplications]);
  rows.push(["Hồ sơ hôm nay", data.overview.todayApplications]);
  rows.push(["Hồ sơ tháng này", data.overview.monthApplications]);
  rows.push([]);
  rows.push(["Trạng thái", "Số lượng"]);
  Object.entries(data.byStatus || {}).forEach(([k, v]) => rows.push([STATUS_LABELS[k] || k, v]));
  rows.push([]);
  rows.push(["Dịch vụ", "Tổng", "Hoàn thành", "Từ chối", "Tỷ lệ hoàn thành (%)"]);
  (data.byService || []).forEach((s) => rows.push([s.serviceName, s.total, s.completed, s.rejected, s.completedRate]));
  rows.push([]);
  rows.push(["Doanh thu tổng", data.revenue.totalRevenue]);
  rows.push(["Giao dịch đã thanh toán", data.revenue.paidTransactions]);
  rows.push(["Giao dịch chưa thanh toán", data.revenue.unpaidTransactions]);
  rows.push([]);
  rows.push(["Tháng", "Doanh thu"]);
  (data.revenue.byMonth || []).forEach((m) => rows.push([m.month, m.revenue]));

  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statistics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminStatistics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    const next = buildMonthRange(mode);
    if (mode !== "custom") {
      setFromDate(next.fromDate);
      setToDate(next.toDate);
    }
  }, [mode]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await getAdminStatistics(params);
      setData(res.data || {});
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const statusTotal = useMemo(() => Object.values(data?.byStatus || {}).reduce((a, b) => a + Number(b || 0), 0), [data]);
  const serviceTop = data?.byService?.[0] || null;
  const revenueTop = data?.revenue?.byService?.[0] || null;

  const statusCards = [
    { key: "pending", icon: Clock3 },
    { key: "processing", icon: FileText },
    { key: "needMore", icon: CircleAlert },
    { key: "completed", icon: CircleCheck },
    { key: "rejected", icon: CircleX },
  ];

  return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl space-y-6"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"><BadgeCheck className="h-4 w-4" /> Admin • Thống kê</div><h1 className="mt-3 text-3xl font-black text-slate-900">Thống kê hệ thống</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Xem tổng quan hồ sơ, trạng thái xử lý, thống kê theo dịch vụ và doanh thu lệ phí theo thời gian.</p></div><div className="flex flex-wrap gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"><RefreshCw className="h-4 w-4" /> Làm mới</button><button onClick={() => exportCsv(data || { overview: {}, byStatus: {}, byService: [], revenue: { byService: [], byMonth: [] } })} className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white hover:opacity-95"><Download className="h-4 w-4" /> Xuất báo cáo</button></div></div></div>

    <div className="grid gap-4 lg:grid-cols-4">
      <Card icon={Users} title="Tổng hồ sơ" value={formatNumber(data?.overview?.totalApplications)} sub="Toàn hệ thống" />
      <Card icon={CalendarRange} title="Hồ sơ hôm nay" value={formatNumber(data?.overview?.todayApplications)} sub="Theo ngày hiện tại" />
      <Card icon={BarChart3} title="Hồ sơ tháng này" value={formatNumber(data?.overview?.monthApplications)} sub="Theo tháng hiện tại" />
      <Card icon={DollarSign} title="Tổng doanh thu" value={`${formatCurrency(data?.revenue?.totalRevenue)} đ`} sub={`${formatNumber(data?.revenue?.paidTransactions)} giao dịch đã thanh toán`} />
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="text-lg font-black text-slate-900">Bộ lọc thời gian</h2><p className="text-sm text-slate-600">Chọn nhanh hoặc chọn khoảng ngày tuỳ chỉnh.</p></div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => <button key={f.id} onClick={() => setMode(f.id)} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === f.id ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{f.label}</button>)}
        </div>
      </div>
      {mode === "custom" ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><label className="space-y-1 text-sm font-semibold text-slate-700"><span>Từ ngày</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none" /></label><label className="space-y-1 text-sm font-semibold text-slate-700"><span>Đến ngày</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none" /></label><div className="flex items-end"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><Filter className="h-4 w-4" /> Áp dụng</button></div></div> : <div className="mt-4 text-sm text-slate-500">Đang xem: {FILTERS.find((x) => x.id === mode)?.label}</div>}
    </div>

    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
    {loading && !data ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-600">Đang tải thống kê...</div> : null}

    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"><div className="mb-4 flex items-center gap-2 text-base font-black text-slate-900"><PieChart className="h-5 w-5" /> Hồ sơ theo trạng thái</div><div className="space-y-4">{statusCards.map((item) => <MiniBar key={item.key} label={STATUS_LABELS[item.key]} value={data?.byStatus?.[item.key]} total={statusTotal} color={item.key === "completed" ? "bg-emerald-500" : item.key === "rejected" ? "bg-red-500" : item.key === "needMore" ? "bg-amber-500" : item.key === "processing" ? "bg-sky-500" : "bg-slate-700"} />)}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="mb-4 flex items-center gap-2 text-base font-black text-slate-900"><BarChart3 className="h-5 w-5" /> Hồ sơ theo dịch vụ</div><div className="space-y-4">{(data?.byService || []).slice(0, 8).map((s) => <div key={s.serviceId} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold text-slate-900">{s.serviceName}</div><div className="text-xs text-slate-500">{s.serviceId}</div></div><div className="text-right text-sm text-slate-600">Tổng <span className="font-bold text-slate-900">{formatNumber(s.total)}</span> • HT <span className="font-bold text-emerald-600">{formatNumber(s.completed)}</span> • TC <span className="font-bold text-red-600">{formatNumber(s.rejected)}</span></div></div><div className="mt-3 h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-[#003366]" style={{ width: `${Math.max(4, Number(s.completedRate || 0))}%` }} /></div><div className="mt-2 text-xs text-slate-500">Tỷ lệ hoàn thành: <span className="font-bold text-slate-700">{Number(s.completedRate || 0).toFixed(1)}%</span></div></div>)}{!(data?.byService || []).length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chưa có dữ liệu dịch vụ.</div> : null}</div></div>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"><div className="mb-4 flex items-center gap-2 text-base font-black text-slate-900"><TrendingUp className="h-5 w-5" /> Doanh thu theo dịch vụ</div><div className="space-y-4">{(data?.revenue?.byService || []).slice(0, 8).map((s) => <MiniBar key={s.serviceId} label={s.serviceName} value={s.revenue} total={data?.revenue?.totalRevenue || 1} color="bg-emerald-500" />)}{!(data?.revenue?.byService || []).length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chưa có doanh thu.</div> : null}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="mb-4 flex items-center gap-2 text-base font-black text-slate-900"><FileSpreadsheet className="h-5 w-5" /> Doanh thu theo tháng</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(data?.revenue?.byMonth || []).map((m) => <div key={m.month} className="rounded-2xl border border-slate-200 p-4"><div className="text-xs text-slate-500">{m.month}</div><div className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(m.revenue)} đ</div></div>)}{!(data?.revenue?.byMonth || []).length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Chưa có dữ liệu doanh thu theo tháng.</div> : null}</div></div>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"><div className="text-base font-black text-slate-900">Tổng quan nhanh</div><div className="mt-4 space-y-3 text-sm text-slate-700"><div className="flex items-center justify-between"><span>Tổng hồ sơ</span><strong>{formatNumber(data?.overview?.totalApplications)}</strong></div><div className="flex items-center justify-between"><span>Tổng doanh thu</span><strong>{formatCurrency(data?.revenue?.totalRevenue)} đ</strong></div><div className="flex items-center justify-between"><span>Giao dịch đã thanh toán</span><strong>{formatNumber(data?.revenue?.paidTransactions)}</strong></div><div className="flex items-center justify-between"><span>Giao dịch chưa thanh toán</span><strong>{formatNumber(data?.revenue?.unpaidTransactions)}</strong></div>{serviceTop ? <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Dịch vụ có nhiều hồ sơ nhất</div><div className="mt-1 font-bold text-slate-900">{serviceTop.serviceName}</div><div className="text-xs text-slate-500">{formatNumber(serviceTop.total)} hồ sơ</div></div> : null}{revenueTop ? <div className="rounded-2xl bg-emerald-50 p-4"><div className="text-xs text-emerald-700">Dịch vụ có doanh thu cao nhất</div><div className="mt-1 font-bold text-slate-900">{revenueTop.serviceName}</div><div className="text-xs text-emerald-700">{formatCurrency(revenueTop.revenue)} đ</div></div> : null}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="text-base font-black text-slate-900">Bảng chi tiết thống kê</div><div className="mt-4 overflow-auto"><table className="min-w-full border-collapse text-sm"><thead><tr className="bg-slate-50 text-left text-slate-500"><th className="border-b border-slate-200 px-4 py-3">Dịch vụ</th><th className="border-b border-slate-200 px-4 py-3">Tổng</th><th className="border-b border-slate-200 px-4 py-3">Hoàn thành</th><th className="border-b border-slate-200 px-4 py-3">Từ chối</th><th className="border-b border-slate-200 px-4 py-3">Tỷ lệ</th><th className="border-b border-slate-200 px-4 py-3">Doanh thu</th></tr></thead><tbody>{(data?.byService || []).map((row) => <tr key={row.serviceId} className="border-b border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{row.serviceName}</td><td className="px-4 py-3">{formatNumber(row.total)}</td><td className="px-4 py-3 text-emerald-600 font-semibold">{formatNumber(row.completed)}</td><td className="px-4 py-3 text-red-600 font-semibold">{formatNumber(row.rejected)}</td><td className="px-4 py-3">{Number(row.completedRate || 0).toFixed(1)}%</td><td className="px-4 py-3">{formatCurrency(row.revenue)} đ</td></tr>)}{!(data?.byService || []).length ? <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Không có dữ liệu.</td></tr> : null}</tbody></table></div></div>
    </div>
  </div></div>;
}
