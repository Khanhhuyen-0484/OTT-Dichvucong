import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  LayoutGrid,
  ListChecks,
  MessageCircleMore,
  Play,
  RefreshCw,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import {
  getAdminSupportConversation,
  postAdminSupportMessage,
  resolvedApiBaseUrl,
  updateAdminDossierStatus,
} from "../../lib/api";

const STATUS_META = {
  PENDING: { label: "Chờ tiếp nhận", tone: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400", icon: Clock3 },
  PROCESSING: { label: "Đang xử lý", tone: "bg-sky-100 text-sky-700 ring-sky-200", dot: "bg-sky-500", icon: Play },
  NEED_MORE: { label: "Cần bổ sung", tone: "bg-orange-100 text-orange-700 ring-orange-200", dot: "bg-orange-500", icon: AlertTriangle },
  SUPPLEMENTED: { label: "Đã bổ sung", tone: "bg-violet-100 text-violet-700 ring-violet-200", dot: "bg-violet-500", icon: FileText },
  APPROVED: { label: "Đã duyệt", tone: "bg-emerald-100 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
  COMPLETED: { label: "Đã hoàn thành", tone: "bg-emerald-100 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", icon: FileCheck2 },
  REJECTED: { label: "Từ chối", tone: "bg-rose-100 text-rose-700 ring-rose-200", dot: "bg-rose-500", icon: X },
  OVERDUE: { label: "Quá hạn", tone: "animate-pulse bg-rose-600 text-white ring-rose-600", dot: "bg-rose-600", icon: AlertTriangle },
};

const STAT_THEMES = {
  total: "from-indigo-600 via-blue-600 to-cyan-500 text-white ring-blue-200",
  pending: "from-slate-700 via-slate-600 to-slate-500 text-white ring-slate-200",
  processing: "from-sky-500 via-blue-500 to-indigo-500 text-white ring-sky-200",
  needMore: "from-orange-500 via-amber-500 to-yellow-400 text-white ring-orange-200",
  completed: "from-emerald-500 via-teal-500 to-cyan-500 text-white ring-emerald-200",
  overdue: "from-rose-600 via-red-500 to-orange-500 text-white ring-rose-200",
};

const WORKFLOW_STATUSES = ["PENDING", "PROCESSING", "NEED_MORE", "COMPLETED", "REJECTED"];
const DRAWER_TABS = [
  { key: "info", label: "Thông tin hồ sơ", icon: FileText },
  { key: "documents", label: "Tài liệu", icon: Archive },
  { key: "timeline", label: "Timeline", icon: ListChecks },
  { key: "chat", label: "Chat", icon: MessageCircleMore },
  { key: "ai", label: "AI hỗ trợ", icon: Bot },
];

const DOCUMENT_NAME_MAP = {
  idCard: "CCCD/CMND người nộp",
  citizenId: "CCCD/CMND người nộp",
  identity: "Giấy tờ tùy thân",
  birthCert: "Giấy chứng sinh",
  birthCertificate: "Giấy khai sinh",
  marriageCert: "Giấy đăng ký kết hôn",
  householdBook: "Sổ hộ khẩu",
  residence: "Giấy tờ cư trú",
  residenceProof: "Giấy tờ chứng minh nơi cư trú",
  temporaryResidence: "Giấy tờ đăng ký tạm trú",
  landPaper: "Giấy tờ đất",
  landCert: "Giấy chứng nhận quyền sử dụng đất",
  constructionPermit: "Giấy phép xây dựng",
  oldLicense: "Giấy phép lái xe cũ",
  driverLicense: "Giấy phép lái xe",
  health: "Giấy khám sức khỏe",
  healthCertificate: "Giấy khám sức khỏe",
  portrait: "Ảnh chân dung",
  passportPhoto: "Ảnh hộ chiếu",
  passport: "Hộ chiếu",
  businessLicense: "Giấy phép kinh doanh",
  representativeId: "CCCD/CMND người đại diện",
  authorizationLetter: "Giấy ủy quyền",
  other: "Giấy tờ khác",
};

function normalizeStatus(status) {
  const value = String(status || "PENDING").trim().toUpperCase();
  if (value === "SUBMITTED" || value === "RECEIVED" || value === "WAITING" || value === "WAITING_RECEIVE") return "PENDING";
  return value;
}

function dossierCode(item) {
  return item?.applicationCode || item?.dossierCode || item?.dossierId || item?.id || "";
}

function citizenName(item) {
  return item?.citizenName || item?.formData?.fullName || item?.user?.fullName || "-";
}

function citizenPhone(item) {
  return item?.phone || item?.formData?.phone || item?.user?.phone || "-";
}

function citizenId(item) {
  return item?.citizenId || item?.formData?.citizenId || item?.formData?.cccd || item?.identityNumber || "";
}

function assignedOfficer(item) {
  return item?.assigneeName || item?.officerName || item?.staffName || item?.assignedTo?.fullName || "Chưa phân công";
}

function paymentLabel(item) {
  const value = String(item?.paymentStatus || item?.payment?.status || "UNPAID").toUpperCase();
  if (value === "PAID" || value === "SUCCESS") return "Đã thanh toán";
  if (value === "PENDING") return "Chờ thanh toán";
  return "Chưa thanh toán";
}

function paymentTone(item) {
  const label = paymentLabel(item);
  if (label === "Đã thanh toán") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (label === "Chờ thanh toán") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function formatDate(value, mode = "date") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(mode === "datetime" ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function getDueDate(item) {
  const explicit = item?.dueAt || item?.deadline || item?.processingDeadline || item?.slaDeadline;
  if (explicit) return new Date(explicit);
  const created = item?.createdAt ? new Date(item.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return null;
  const fallback = new Date(created);
  fallback.setDate(fallback.getDate() + Number(item?.slaDays || item?.service?.slaDays || 7));
  return fallback;
}

function isClosed(item) {
  const status = normalizeStatus(item?.status);
  return status === "COMPLETED" || status === "APPROVED" || status === "REJECTED";
}

function isOverdue(item) {
  const due = getDueDate(item);
  return Boolean(due && !isClosed(item) && due.getTime() < Date.now());
}

function slaText(item) {
  const due = getDueDate(item);
  if (!due) return { label: "Chưa có hạn", tone: "text-slate-500" };
  const diff = due.getTime() - Date.now();
  const absDays = Math.ceil(Math.abs(diff) / 86400000);
  if (isClosed(item)) return { label: "Đã kết thúc", tone: "text-slate-500" };
  if (diff < 0) return { label: `Quá hạn ${absDays} ngày`, tone: "text-red-700 font-bold" };
  if (diff < 86400000) return { label: "Sắp quá hạn hôm nay", tone: "text-orange-700 font-bold" };
  return { label: `Còn ${absDays} ngày`, tone: "text-emerald-700 font-bold" };
}

function statusMeta(itemOrStatus) {
  if (typeof itemOrStatus === "object") {
    return STATUS_META[normalizeStatus(itemOrStatus?.status)] || STATUS_META.PENDING;
  }
  return STATUS_META[normalizeStatus(itemOrStatus)] || STATUS_META.PENDING;
}

function displayStatusMeta(item) {
  return isOverdue(item) ? STATUS_META.OVERDUE : statusMeta(item);
}

function attachmentUrl(fileUrl) {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return encodeURI(fileUrl);
  const base = String(resolvedApiBaseUrl || "/api").replace(/\/api\/?$/, "");
  return encodeURI(`${base}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`);
}

function attachmentFileName(file, index) {
  return file?.fileName || file?.name || file?.originalName || `Tài liệu ${index + 1}`;
}

function attachmentDocName(file, index) {
  const key = file?.docKey || file?.fieldName || file?.key || "";
  if (DOCUMENT_NAME_MAP[key]) return DOCUMENT_NAME_MAP[key];
  const normalizedKey = String(key)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return file?.label || file?.docName || file?.documentName || file?.title || normalizedKey || attachmentFileName(file, index);
}

function isImageAttachment(file, url = "") {
  const type = String(file?.mimeType || file?.type || "").toLowerCase();
  const name = String(file?.fileName || file?.name || file?.url || file?.fileUrl || url).toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(name);
}

function isSupplementAttachment(file) {
  const group = String(file?.attachmentGroup || file?.source || file?.group || "").toLowerCase();
  return group === "supplement" || group === "supplemented" || Boolean(file?.supplementedAt);
}

function StatTile({ label, value, icon: Icon, theme, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl border bg-white/80 p-4 text-left shadow-lg shadow-blue-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        active ? "border-cyan-200 ring-4 ring-cyan-400/15 shadow-cyan-500/20" : "border-white/80 ring-1 ring-slate-200/70"
      }`}
    >
      <div className={`absolute inset-0 bg-linear-to-br ${theme} opacity-[0.08]`} />
      <div className={`absolute inset-x-0 bottom-0 h-1.5 bg-linear-to-r ${theme}`} />
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-300/25 blur-2xl transition group-hover:scale-125" />
      <div className="flex items-center justify-between gap-3">
        <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-blue-700 shadow-inner ring-1 ring-white/80`}>
          <Icon className="h-5 w-5" />
        </div>
        <ChevronDown className="relative h-4 w-4 text-slate-300 transition group-hover:translate-y-0.5 group-hover:text-slate-500" />
      </div>
      <div className="relative mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
        </div>
        {active ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700">Đang lọc</span> : null}
      </div>
    </button>
  );
}

function StatusBadge({ item, status, showDot = true, compact = false }) {
  const meta = item ? displayStatusMeta(item) : statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ${compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"} ${meta.tone}`}>
      {showDot ? <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> : null}
      {meta.label}
    </span>
  );
}

function MiniField({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
      <div className="text-[10px] font-black uppercase text-slate-400">{label}</div>
      <div className="mt-1 wrap-break-word text-sm font-semibold text-slate-800">{value || "-"}</div>
    </div>
  );
}

export default function AdminDossierWorkspace({ dossiers = [], conversations = [], onReload, setMessage }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    status: "ALL",
    service: "ALL",
    payment: "ALL",
    officer: "ALL",
    date: "",
    overdue: "ALL",
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeDossier, setActiveDossier] = useState(null);
  const [drawerTab, setDrawerTab] = useState("info");
  const [viewMode, setViewMode] = useState("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [chatDetail, setChatDetail] = useState(null);
  const [chatText, setChatText] = useState("");
  const [noteModal, setNoteModal] = useState(null);

  const enriched = useMemo(
    () =>
      dossiers
        .map((item) => ({ ...item, _code: dossierCode(item), _overdue: isOverdue(item), _due: getDueDate(item) }))
        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)),
    [dossiers]
  );

  const stats = useMemo(() => {
    const byStatus = (status) => enriched.filter((item) => normalizeStatus(item.status) === status).length;
    return {
      total: enriched.length,
      pending: byStatus("PENDING"),
      processing: byStatus("PROCESSING"),
      needMore: byStatus("NEED_MORE"),
      completed: enriched.filter((item) => ["COMPLETED", "APPROVED"].includes(normalizeStatus(item.status))).length,
      overdue: enriched.filter((item) => item._overdue).length,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return enriched
      .filter((item) => {
        const searchable = [
          item._code,
          citizenName(item),
          citizenPhone(item),
          citizenId(item),
          item.serviceName,
          item.serviceId,
        ].join(" ").toLowerCase();
        const status = normalizeStatus(item.status);
        const created = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : "";
        return (
          (!needle || searchable.includes(needle)) &&
          (filters.status === "ALL" || (filters.status === "OVERDUE" ? item._overdue : status === filters.status)) &&
          (!filters.date || created === filters.date) &&
          (filters.overdue === "ALL" || (filters.overdue === "YES" ? item._overdue : !item._overdue))
        );
      })
      .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
  }, [enriched, filters, query]);

  const selectedDossiers = useMemo(() => enriched.filter((item) => selectedIds.includes(item._code)), [enriched, selectedIds]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, pageSize]);

  const activeConversation = useMemo(() => {
    if (!activeDossier) return null;
    const phone = String(citizenPhone(activeDossier)).replace(/\D/g, "");
    const name = String(citizenName(activeDossier)).toLowerCase();
    return conversations.find((conv) => {
      const convPhone = String(conv.phone || conv.citizenPhone || conv.user?.phone || "").replace(/\D/g, "");
      const convName = String(conv.citizenName || conv.fullName || conv.user?.fullName || "").toLowerCase();
      return (phone && convPhone && phone === convPhone) || (name && convName && name === convName);
    });
  }, [activeDossier, conversations]);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function openDrawer(item, tab = "info") {
    setActiveDossier(item);
    setDrawerTab(tab);
    setChatDetail(null);
  }

  function requestStatusUpdate(items, nextStatus, fallbackNote = "") {
    const targets = Array.isArray(items) ? items : [items];
    if (["NEED_MORE", "REJECTED"].includes(nextStatus)) {
      setNoteModal({ items: targets, status: nextStatus, note: fallbackNote });
      return;
    }
    updateStatus(targets, nextStatus, fallbackNote);
  }

  async function updateStatus(items, nextStatus, note = "") {
    if (!items.length) return;
    setBusy(true);
    try {
      await Promise.all(
        items.map((item) =>
          updateAdminDossierStatus(item._code, {
            status: nextStatus,
            action: String(nextStatus).toLowerCase(),
            note: note || statusMeta(nextStatus).label,
          })
        )
      );
      setSelectedIds([]);
      setMessage?.(`Đã cập nhật ${items.length} hồ sơ`);
      setActiveDossier((current) => {
        if (!current || !items.some((item) => item._code === current._code)) return current;
        const timeline = current.timeline || current.history || [];
        return {
          ...current,
          status: nextStatus,
          timeline: [...timeline, { status: nextStatus, action: String(nextStatus).toLowerCase(), note: note || statusMeta(nextStatus).label, actor: "admin", createdAt: new Date().toISOString() }],
        };
      });
      await onReload?.();
    } catch (error) {
      setMessage?.("Không cập nhật được trạng thái hồ sơ");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv(items) {
    const rows = [
      ["Mã hồ sơ", "Người nộp", "SĐT", "CCCD", "Dịch vụ", "Trạng thái", "Thanh toán", "Ngày tạo", "Hạn xử lý", "Cán bộ"],
      ...items.map((item) => [
        item._code,
        citizenName(item),
        citizenPhone(item),
        citizenId(item),
        item.serviceName || item.serviceId || "",
        statusMeta(item).label,
        paymentLabel(item),
        formatDate(item.createdAt),
        formatDate(item._due),
        assignedOfficer(item),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ho-so-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadChat() {
    if (!activeConversation?.id) return;
    try {
      const { data } = await getAdminSupportConversation(activeConversation.id);
      setChatDetail(data.conversation || null);
    } catch {
      setMessage?.("Không tải được hội thoại");
    }
  }

  async function sendChat() {
    const text = chatText.trim();
    if (!activeConversation?.id || !text) return;
    setBusy(true);
    try {
      await postAdminSupportMessage(activeConversation.id, text);
      setChatText("");
      await loadChat();
    } catch {
      setMessage?.("Gửi tin nhắn thất bại");
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(code) {
    setSelectedIds((prev) => (prev.includes(code) ? prev.filter((id) => id !== code) : [...prev, code]));
  }

  function openDatePicker(event) {
    try {
      event.currentTarget.showPicker?.();
    } catch {
      // Some browsers only allow showPicker from direct user gestures.
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.date, filters.overdue, filters.status, pageSize, query]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const allVisibleSelected = paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.includes(item._code));

  return (
    <div className="relative space-y-5">
      <div className="pointer-events-none absolute -left-10 -top-8 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-64 w-64 rounded-full bg-fuchsia-300/20 blur-3xl" />

      <section className="relative grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Tổng hồ sơ" value={stats.total} icon={ClipboardList} theme={STAT_THEMES.total} active={filters.status === "ALL"} onClick={() => setFilter("status", "ALL")} />
        <StatTile label="Chờ tiếp nhận" value={stats.pending} icon={Clock3} theme={STAT_THEMES.pending} active={filters.status === "PENDING"} onClick={() => setFilter("status", "PENDING")} />
        <StatTile label="Đang xử lý" value={stats.processing} icon={Play} theme={STAT_THEMES.processing} active={filters.status === "PROCESSING"} onClick={() => setFilter("status", "PROCESSING")} />
        <StatTile label="Cần bổ sung" value={stats.needMore} icon={AlertTriangle} theme={STAT_THEMES.needMore} active={filters.status === "NEED_MORE"} onClick={() => setFilter("status", "NEED_MORE")} />
        <StatTile label="Đã hoàn thành" value={stats.completed} icon={FileCheck2} theme={STAT_THEMES.completed} active={filters.status === "COMPLETED"} onClick={() => setFilter("status", "COMPLETED")} />
        <StatTile label="Quá hạn" value={stats.overdue} icon={CalendarClock} theme={STAT_THEMES.overdue} active={filters.status === "OVERDUE"} onClick={() => setFilter("status", "OVERDUE")} />
      </section>

      <section className="relative overflow-hidden rounded-4xl border border-white/70 bg-white/90 shadow-xl shadow-blue-950/5 ring-1 ring-slate-200/70 backdrop-blur">
        <div className="relative overflow-hidden bg-linear-to-r from-[#003366] via-blue-600 to-teal-400 px-5 py-6 text-white">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute right-20 top-6 h-24 w-24 rounded-full bg-cyan-200/20 blur-2xl" />
          <div className="relative flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-white ring-1 ring-white/20">
              <ClipboardCheck className="h-4 w-4" />
              Quản lý hồ sơ
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Bàn làm việc xử lý hồ sơ</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/85">Lọc, chọn nhiều hồ sơ, cập nhật trạng thái và xem chi tiết ngay trong panel.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onReload} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-blue-700 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl">
              <RefreshCw className="h-4 w-4" />
              Làm mới
              </button>
              <div className="rounded-2xl bg-white/15 p-1 shadow-inner ring-1 ring-white/20 backdrop-blur">
                <button type="button" onClick={() => setViewMode("table")} className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-black transition ${viewMode === "table" ? "bg-white text-blue-700 shadow-sm" : "text-white/75 hover:text-white"}`}>
                <ListChecks className="h-4 w-4" />
                Table
                </button>
                <button type="button" onClick={() => setViewMode("kanban")} className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-black transition ${viewMode === "kanban" ? "bg-white text-blue-700 shadow-sm" : "text-white/75 hover:text-white"}`}>
                <LayoutGrid className="h-4 w-4" />
                Kanban
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-[minmax(260px,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hồ sơ, tên, SĐT, CCCD, dịch vụ..." className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3.5 pl-12 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div className="flex rounded-2xl border border-slate-200 bg-white/95 px-4 shadow-sm transition">
            <input
              type="date"
              value={filters.date}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              onChange={(event) => setFilter("date", event.target.value)}
              className="admin-date-filter w-full cursor-pointer bg-transparent py-3.5 text-sm font-bold text-slate-700 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            />
          </div>
        </div>

        {selectedIds.length ? (
          <div className="relative mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50 via-cyan-50 to-indigo-50 px-4 py-3 shadow-sm">
            <div className="text-sm font-black text-blue-950">Đã chọn {selectedIds.length} hồ sơ</div>
            <div className="flex flex-wrap gap-2">
              <BatchButton disabled={busy} onClick={() => requestStatusUpdate(selectedDossiers, "COMPLETED", "Duyệt hàng loạt")} label="Duyệt" />
              <BatchButton disabled={busy} onClick={() => requestStatusUpdate(selectedDossiers, "PROCESSING", "Chuyển xử lý hàng loạt")} label="Chuyển xử lý" />
              <BatchButton disabled={busy} onClick={() => requestStatusUpdate(selectedDossiers, "NEED_MORE", "Yêu cầu bổ sung hồ sơ")} label="Yêu cầu bổ sung" />
              <BatchButton disabled={busy} onClick={() => exportCsv(selectedDossiers)} label="Xuất Excel" icon={Download} />
            </div>
          </div>
        ) : null}
      </section>

      {viewMode === "table" ? (
        <DossierTable
          items={paginatedItems}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          onToggleAll={() => {
            const pageCodes = paginatedItems.map((item) => item._code);
            setSelectedIds((prev) => allVisibleSelected ? prev.filter((id) => !pageCodes.includes(id)) : Array.from(new Set([...prev, ...pageCodes])));
          }}
          onToggleSelect={toggleSelect}
          onOpen={openDrawer}
          onUpdate={(item, status) => requestStatusUpdate([item], status)}
          busy={busy}
          page={currentPage}
          pageSize={pageSize}
          totalItems={filtered.length}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      ) : (
        <KanbanBoard items={filtered} onOpen={openDrawer} onDropStatus={(item, status) => requestStatusUpdate([item], status, "Cập nhật từ Kanban")} />
      )}

      {activeDossier ? (
        <DossierDrawer
          dossier={activeDossier}
          tab={drawerTab}
          setTab={setDrawerTab}
          onClose={() => setActiveDossier(null)}
          onUpdate={(status) => requestStatusUpdate([activeDossier], status)}
          activeConversation={activeConversation}
          chatDetail={chatDetail}
          chatText={chatText}
          setChatText={setChatText}
          loadChat={loadChat}
          sendChat={sendChat}
          busy={busy}
        />
      ) : null}

      {noteModal ? (
        <NoteModal
          status={noteModal.status}
          count={noteModal.items.length}
          note={noteModal.note}
          setNote={(note) => setNoteModal((prev) => ({ ...prev, note }))}
          onClose={() => setNoteModal(null)}
          onSubmit={() => {
            const next = noteModal;
            setNoteModal(null);
            updateStatus(next.items, next.status, next.note);
          }}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function NoteModal({ status, count, note, setNote, onClose, onSubmit, busy }) {
  const isNeedMore = status === "NEED_MORE";
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-950">{isNeedMore ? "Ghi chú bổ sung hồ sơ" : "Lý do từ chối hồ sơ"}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Áp dụng cho {count} hồ sơ. Nội dung này sẽ hiển thị cho người dân.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          placeholder={isNeedMore ? "Nhập rõ giấy tờ/thông tin cần người dân bổ sung..." : "Nhập lý do từ chối hồ sơ..."}
          className="mt-4 w-full rounded-2xl border border-slate-200 p-4 text-sm font-semibold outline-none focus:border-[#003366] focus:ring-4 focus:ring-blue-100"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">Huỷ</button>
          <button type="button" onClick={onSubmit} disabled={busy || String(note || "").trim().length < 5} className="flex-1 rounded-2xl bg-[#003366] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchButton({ label, icon: Icon = CheckCircle2, ...props }) {
  return (
    <button type="button" {...props} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-blue-700 shadow-sm ring-1 ring-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white hover:shadow-md disabled:opacity-50">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function paginationPages(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  return Array.from(pages).sort((a, b) => a - b);
}

function PaginationButton({ children, active, disabled, onClick, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-xl px-3 text-xs font-black transition ${
        active
          ? "bg-linear-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-white disabled:hover:text-slate-600`}
    >
      {children}
    </button>
  );
}

function DossierPagination({ page, pageSize, totalItems, totalPages, onPageChange, onPageSizeChange }) {
  const firstItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(totalItems, page * pageSize);
  const pages = paginationPages(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-linear-to-r from-slate-50/90 via-white to-blue-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
        <span>Hiển thị</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>
          {firstItem}-{lastItem} trong tổng {totalItems} hồ sơ
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PaginationButton title="Trang đầu" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </PaginationButton>
        <PaginationButton title="Trang trước" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </PaginationButton>

        {pages.map((pageNumber, index) => {
          const previous = pages[index - 1];
          return (
            <React.Fragment key={pageNumber}>
              {previous && pageNumber - previous > 1 ? <span className="px-1 text-xs font-black text-slate-300">...</span> : null}
              <PaginationButton active={pageNumber === page} onClick={() => onPageChange(pageNumber)}>
                {pageNumber}
              </PaginationButton>
            </React.Fragment>
          );
        })}

        <PaginationButton title="Trang sau" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </PaginationButton>
        <PaginationButton title="Trang cuối" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </PaginationButton>
      </div>
    </div>
  );
}

function DossierTable({ items, selectedIds, allVisibleSelected, onToggleAll, onToggleSelect, onOpen, onUpdate, busy, page, pageSize, totalItems, totalPages, onPageChange, onPageSizeChange }) {
  return (
    <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/90 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] table-fixed text-left text-[13px]">
          <colgroup>
            <col className="w-[38px]" />
            <col className="w-[130px]" />
            <col className="w-[130px]" />
            <col className="w-[150px]" />
            <col className="w-[105px]" />
            <col className="w-[112px]" />
            <col className="w-[90px]" />
            <col className="w-[105px]" />
            <col className="w-[115px]" />
            <col className="w-[85px]" />
          </colgroup>
          <thead className="bg-linear-to-r from-slate-50 via-blue-50 to-cyan-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-4 text-center"><input type="checkbox" checked={allVisibleSelected} onChange={onToggleAll} className="h-4 w-4 rounded border-slate-300 text-blue-600" /></th>
              <th className="px-2 py-4">Mã hồ sơ</th>
              <th className="px-2 py-4">Người nộp</th>
              <th className="px-2 py-4">Dịch vụ</th>
              <th className="px-2 py-4 text-center">Trạng thái</th>
              <th className="px-2 py-4 text-center">Thanh toán</th>
              <th className="px-2 py-4 text-center">Ngày tạo</th>
              <th className="px-2 py-4 text-center">Hạn xử lý</th>
              <th className="px-2 py-4">Cán bộ</th>
              <th className="px-2 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {items.map((item) => {
              const sla = slaText(item);
              return (
                <tr key={item._code} className="group transition hover:bg-blue-50/55">
                  <td className="px-2 py-4 text-center"><input type="checkbox" checked={selectedIds.includes(item._code)} onChange={() => onToggleSelect(item._code)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /></td>
                  <td className="px-2 py-4">
                    <button type="button" onClick={() => onOpen(item)} title={item._code} className="max-w-full truncate rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100 transition group-hover:bg-blue-600 group-hover:text-white">{item._code}</button>
                  </td>
                  <td className="px-2 py-4">
                    <div className="truncate font-bold text-slate-900" title={citizenName(item)}>{citizenName(item)}</div>
                    <div className="truncate text-xs text-slate-500">{citizenPhone(item)}</div>
                  </td>
                  <td className="px-2 py-4">
                    <div className="truncate font-bold text-slate-800" title={item.serviceName || item.serviceId || "-"}>{item.serviceName || item.serviceId || "-"}</div>
                  </td>
                  <td className="px-2 py-4 text-center"><StatusBadge item={item} showDot={false} compact /></td>
                  <td className="px-2 py-4 text-center"><span className={`inline-flex max-w-full rounded-full px-2 py-1 text-[11px] font-bold leading-tight ring-1 ${paymentTone(item)}`}>{paymentLabel(item)}</span></td>
                  <td className="px-2 py-4 text-center text-slate-600">{formatDate(item.createdAt)}</td>
                  <td className="px-2 py-4 text-center">
                    <div className="font-semibold text-slate-800">{formatDate(item._due)}</div>
                    <div className={`text-[11px] ${sla.tone}`}>{sla.label}</div>
                  </td>
                  <td className="px-2 py-4 text-slate-700">
                    <div className="truncate" title={assignedOfficer(item)}>{assignedOfficer(item)}</div>
                  </td>
                  <td className="px-2 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <button type="button" onClick={() => onOpen(item)} className="w-full rounded-lg bg-linear-to-r from-blue-600 to-cyan-500 px-2 py-1.5 text-[11px] font-black text-white shadow-sm shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-md">Mở</button>
                      <button type="button" disabled={busy} onClick={() => onUpdate(item, "PROCESSING")} className="w-full rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-white disabled:opacity-50">Xử lý</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-sm font-semibold text-slate-500">Không có hồ sơ phù hợp bộ lọc.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <DossierPagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}

function KanbanBoard({ items, onOpen, onDropStatus }) {
  const [dragCode, setDragCode] = useState("");
  const byStatus = (status) => items.filter((item) => {
    if (status === "COMPLETED") return ["COMPLETED", "APPROVED"].includes(normalizeStatus(item.status));
    return normalizeStatus(item.status) === status;
  });

  return (
    <section className="grid gap-4 overflow-x-auto pb-2 xl:grid-cols-5">
      {WORKFLOW_STATUSES.map((status) => {
        const meta = statusMeta(status);
        const columnItems = byStatus(status);
        return (
          <div
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              const item = items.find((entry) => entry._code === dragCode);
              if (item) onDropStatus(item, status);
              setDragCode("");
            }}
            className="min-h-[460px] min-w-[260px] rounded-[1.75rem] border border-white/70 bg-white/75 p-3 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between">
              <StatusBadge status={status} />
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500 shadow-sm ring-1 ring-slate-200">{columnItems.length}</span>
            </div>
            <div className="space-y-3">
              {columnItems.map((item) => {
                const sla = slaText(item);
                return (
                  <button
                    key={item._code}
                    type="button"
                    draggable
                    onDragStart={() => setDragCode(item._code)}
                    onClick={() => onOpen(item)}
                    className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">{item._code}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} shadow-sm`} />
                    </div>
                    <div className="mt-3 line-clamp-2 text-sm font-black text-slate-900">{item.serviceName || item.serviceId || "Hồ sơ dịch vụ công"}</div>
                    <div className="mt-2 text-xs font-semibold text-slate-500">{citizenName(item)}</div>
                    <div className={`mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs ring-1 ring-slate-100 ${sla.tone}`}>{sla.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DossierDrawer({ dossier, tab, setTab, onClose, onUpdate, activeConversation, chatDetail, chatText, setChatText, loadChat, sendChat, busy }) {
  const formData = dossier.formData || {};
  const attachments = Array.isArray(dossier.attachments) ? dossier.attachments : [];
  const supplementAttachments = attachments.filter(isSupplementAttachment);
  const initialAttachments = attachments.filter((file) => !isSupplementAttachment(file));
  const documentGroups = [
    { key: "initial", title: "Giấy tờ đã nộp ban đầu", items: initialAttachments },
    { key: "supplement", title: "Giấy tờ đã bổ sung", items: supplementAttachments },
  ].filter((group) => group.items.length);
  const timeline = Array.isArray(dossier.timeline) ? dossier.timeline : Array.isArray(dossier.history) ? dossier.history : [];
  const sla = slaText(dossier);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <button type="button" aria-label="Đóng panel" className="hidden flex-1 md:block" onClick={onClose} />
      <aside className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-[#003366]">{dossier._code}</span>
                <StatusBadge item={dossier} />
                <span className={`text-xs ${sla.tone}`}>{sla.label}</span>
              </div>
              <h2 className="mt-2 truncate text-xl font-black text-slate-900">{dossier.serviceName || dossier.serviceId || "Hồ sơ dịch vụ công"}</h2>
              <p className="mt-1 text-sm text-slate-500">{citizenName(dossier)} · {citizenPhone(dossier)}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onUpdate("PROCESSING")} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Chuyển xử lý</button>
            <button type="button" disabled={busy} onClick={() => onUpdate("NEED_MORE")} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Yêu cầu bổ sung</button>
            <button type="button" disabled={busy} onClick={() => onUpdate("COMPLETED")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Hoàn thành</button>
            <button type="button" disabled={busy} onClick={() => onUpdate("REJECTED")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Từ chối</button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 py-2">
          {DRAWER_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" onClick={() => { setTab(item.key); if (item.key === "chat") loadChat(); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${tab === item.key ? "bg-white text-[#003366] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white"}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "info" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniField label="Mã hồ sơ" value={dossier._code} />
              <MiniField label="Dịch vụ" value={dossier.serviceName || dossier.serviceId} />
              <MiniField label="Người nộp" value={citizenName(dossier)} />
              <MiniField label="Số điện thoại" value={citizenPhone(dossier)} />
              <MiniField label="CCCD/CMND" value={citizenId(dossier)} />
              <MiniField label="Email" value={dossier.email || formData.email} />
              <MiniField label="Địa chỉ" value={dossier.address || formData.address} />
              <MiniField label="Thanh toán" value={paymentLabel(dossier)} />
              <MiniField label="Ngày tạo" value={formatDate(dossier.createdAt, "datetime")} />
              <MiniField label="Hạn xử lý" value={formatDate(dossier._due, "datetime")} />
              <div className="sm:col-span-2">
                <MiniField label="Nội dung yêu cầu" value={formData.requestContent || formData.note || dossier.description || "-"} />
              </div>
            </div>
          ) : null}

          {tab === "documents" ? (
            <div className="space-y-6">
              {documentGroups.length ? documentGroups.map((group) => (
                <section key={group.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase text-slate-700">{group.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{group.items.length}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.items.map((file, index) => (
                      <AttachmentCard key={`${group.key}-${attachmentFileName(file, index)}-${index}`} file={file} index={index} />
                    ))}
                  </div>
                </section>
              )) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm font-semibold text-slate-500">Chưa có tài liệu đính kèm.</div>}
            </div>
          ) : null}

          {tab === "timeline" ? (
            <div className="space-y-4">
              {(timeline.length ? timeline : [{ status: "PENDING", action: "Tạo hồ sơ", createdAt: dossier.createdAt }]).map((item, index) => {
                const meta = statusMeta(item.status);
                const Icon = meta.icon || Clock3;
                return (
                  <div key={`${item.createdAt || index}-${index}`} className="relative pl-10">
                    <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-slate-200">
                      <Icon className="h-4 w-4 text-[#003366]" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={item.status} />
                        <span className="font-bold text-slate-900">{item.action || "Cập nhật trạng thái"}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{item.note || "-"}</div>
                      <div className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt, "datetime")} · {item.actor || item.by || "-"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {tab === "chat" ? (
            <div className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <div className="font-black text-slate-900">Chat với người dân</div>
                <div className="text-xs text-slate-500">{activeConversation ? "Đã tìm thấy hội thoại hỗ trợ liên quan" : "Chưa tìm thấy hội thoại hỗ trợ theo người nộp"}</div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {activeConversation ? (
                  (chatDetail?.messages || []).length ? chatDetail.messages.map((msg) => (
                    <div key={msg.id || msg.createdAt} className={`mb-3 flex ${msg.from === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${msg.from === "admin" ? "bg-[#003366] text-white" : "bg-white text-slate-900 ring-1 ring-slate-200"}`}>{msg.text}</div>
                    </div>
                  )) : <div className="text-sm font-semibold text-slate-500">Bấm tab Chat hoặc Làm mới để tải hội thoại.</div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Người dân chưa mở kênh chat hỗ trợ cho hồ sơ này.</div>
                )}
              </div>
              <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
                <input value={chatText} onChange={(event) => setChatText(event.target.value)} disabled={!activeConversation || busy} placeholder="Nhập phản hồi cho người dân..." className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#003366] disabled:bg-slate-100" />
                <button type="button" onClick={sendChat} disabled={!activeConversation || busy || !chatText.trim()} className="rounded-xl bg-[#003366] px-3 py-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          ) : null}

          {tab === "ai" ? (
            <div className="space-y-4">
              <AiInsight title="Tóm tắt hồ sơ" icon={Bot}>
                Hồ sơ {dossier._code} thuộc dịch vụ {dossier.serviceName || dossier.serviceId || "dịch vụ công"}, người nộp {citizenName(dossier)}, trạng thái hiện tại là {statusMeta(dossier).label.toLowerCase()}.
              </AiInsight>
              <AiInsight title="Phát hiện thiếu giấy tờ" icon={AlertTriangle}>
                {attachments.length ? `Đã có ${attachments.length} tài liệu đính kèm. Cần đối chiếu danh mục giấy tờ bắt buộc của dịch vụ trước khi phê duyệt.` : "Chưa thấy tài liệu đính kèm trong hồ sơ. Nên yêu cầu người dân bổ sung giấy tờ bắt buộc."}
              </AiInsight>
              <AiInsight title="Gợi ý xử lý" icon={ClipboardCheck}>
                {isOverdue(dossier) ? "Hồ sơ đã quá hạn, nên ưu tiên xử lý hoặc phản hồi lý do chậm cho người dân." : "Kiểm tra thông tin định danh, tài liệu và trạng thái thanh toán trước khi chuyển bước tiếp theo."}
              </AiInsight>
              <AiInsight title="Phản hồi mẫu" icon={MessageCircleMore}>
                Chào anh/chị {citizenName(dossier)}, hồ sơ {dossier._code} đang được cán bộ kiểm tra. Chúng tôi sẽ cập nhật ngay khi có kết quả xử lý hoặc yêu cầu bổ sung.
              </AiInsight>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function AttachmentCard({ file, index }) {
  const name = attachmentFileName(file, index);
  const docName = attachmentDocName(file, index);
  const url = attachmentUrl(file.fileUrl || file.url || file.path || "");
  const image = isImageAttachment(file, url);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {image && url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block aspect-16/10 bg-slate-100">
          <img src={url} alt={docName} className="h-full w-full object-cover transition duration-200 hover:scale-[1.02]" loading="lazy" />
        </a>
      ) : (
        <div className="flex aspect-16/10 items-center justify-center bg-slate-50">
          <div className="rounded-2xl bg-blue-50 p-4 text-blue-700"><FileText className="h-8 w-8" /></div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><FileText className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-slate-400">Tên giấy tờ</div>
            <div className="mt-0.5 line-clamp-2 font-black text-slate-900">{docName}</div>
            <div className="mt-2 truncate text-sm font-semibold text-slate-600">{name}</div>
            <div className="mt-1 text-xs text-slate-500">{file.mimeType || file.type || "-"} · {file.size ? `${Math.round(file.size / 1024)} KB` : "-"}</div>
            {file.supplementedAt ? <div className="mt-1 text-xs font-semibold text-orange-700">Bổ sung: {formatDate(file.supplementedAt, "datetime")}</div> : null}
            {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[#003366] px-3 py-2 text-xs font-bold text-white">Mở tài liệu</a> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiInsight({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Icon className="h-4 w-4" /></div>
        {title}
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}
