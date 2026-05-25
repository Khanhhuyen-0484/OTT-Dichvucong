import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileCheck2,
  FileText,
  House,
  LogOut,
  MessageCircleMore,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  Ban,
  BadgeAlert,
  Search,
  Filter,
  X,
  TrendingUp,
} from "lucide-react";
import UserAvatar from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getAdminAiHistory,
  getAdminAiRules,
  getAdminDashboard,
  getAdminDossiers,
  getAdminSupportConversation,
  getAdminSupportConversations,
  postAdminSupportMessage,
  postAdminSupportResolve,
  putAdminAiRules,
  getApiErrorMessage,
  api,
  updateAdminDossierStatus,
  resolvedApiBaseUrl,
} from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "services", label: "Quản lý dịch vụ", icon: FileText, path: "/admin/services" },
  { key: "statistics", label: "Thống kê", icon: TrendingUp, path: "/admin/statistics" },
  { key: "support", label: "Chat 1v1", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản trị AI", icon: Bot, path: "/admin/ai" }
];

const STATUS_META = {
  PENDING: { text: "Chờ tiếp nhận", color: "bg-slate-100 text-slate-700", icon: Clock3 },
  PROCESSING: { text: "Đang xử lý", color: "bg-sky-100 text-sky-700", icon: Play },
  NEED_MORE: { text: "Yêu cầu bổ sung", color: "bg-amber-100 text-amber-700", icon: BadgeAlert },
  REJECTED: { text: "Từ chối", color: "bg-red-100 text-red-700", icon: Ban },
  COMPLETED: { text: "Hoàn thành", color: "bg-emerald-100 text-emerald-700", icon: FileCheck2 },
};

const WORKFLOW_BUTTONS = [
  { key: "PENDING", label: "Tiếp nhận", icon: Clock3, className: "bg-slate-700 hover:bg-slate-800 text-white" },
  { key: "PROCESSING", label: "Đang xử lý", icon: Play, className: "bg-sky-600 hover:bg-sky-700 text-white" },
  { key: "NEED_MORE", label: "Yêu cầu bổ sung", icon: BadgeAlert, className: "bg-amber-500 hover:bg-amber-600 text-white" },
  { key: "REJECTED", label: "Từ chối", icon: Ban, className: "bg-red-600 hover:bg-red-700 text-white" },
  { key: "COMPLETED", label: "Hoàn thành", icon: FileCheck2, className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
];

function Widget({ title, value, colorClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "ND";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AvatarDisplay({ name, src, size = 40, isActiveCard = false }) {
  if (src) return <img src={src} alt={name || "avatar"} style={{ width: size, height: size, flexShrink: 0 }} className="rounded-full object-cover ring-2 ring-slate-200" />;
  return <div style={{ width: size, height: size, flexShrink: 0 }} className={`rounded-full flex items-center justify-center text-sm font-bold select-none ${isActiveCard ? "bg-white/20 text-white" : "bg-[#003366] text-white"}`}>{getInitials(name)}</div>;
}

function statusLabel(status) {
  return STATUS_META[String(status || "").toUpperCase()] || { text: status || "Chưa rõ", color: "bg-slate-100 text-slate-700" };
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:grid-cols-3 sm:gap-3">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="sm:col-span-2 break-words text-sm font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try { return new Date(value).toLocaleString("vi-VN"); } catch { return value; }
}

function getAttachmentUrl(fileUrl) {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return encodeURI(fileUrl);
  const base = String(resolvedApiBaseUrl || "/api").replace(/\/api\/?$/, "");
  return encodeURI(`${base}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`);
}

function getDownloadUrl(file) {
  const raw = file?.fileUrl || file?.url || file?.path || "";
  return getAttachmentUrl(raw);
}


function normalizeAttachment(file) {
  if (!file) return null;
  const fileUrl = file.fileUrl || file.url || file.path || "";
  const mimeType = file.mimeType || file.fileType || file.type || "";
  return { ...file, fileUrl, mimeType, type: mimeType, previewUrl: getAttachmentUrl(fileUrl) };
}

function renderFileName(file) {
  return file?.fileName || file?.name || file?.originalName || file?.filename || file?.label || "Tài liệu";
}

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dashboard, setDashboard] = useState({ pending: 0, processing: 0, needMore: 0, completed: 0, rejected: 0, waitingMessages: 0 });
  const [dossiers, setDossiers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationDetail, setConversationDetail] = useState(null);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [chatText, setChatText] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [workflowModal, setWorkflowModal] = useState(null);

  const activeTab = useMemo(() => {
    const p = location.pathname;
    if (p === "/admin/chat") return "support";
    if (p === "/admin/documents") return "records";
    if (p === "/admin/services") return "services";
    if (p === "/admin/statistics") return "statistics";
    if (p === "/admin/ai") return "ai";
    return "dashboard";
  }, [location.pathname]);

  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => (b.latestMessage?.createdAt || b.latestMessage?.at || "").localeCompare(a.latestMessage?.createdAt || a.latestMessage?.at || "")), [conversations]);
  const sortedAiHistory = useMemo(() => [...aiHistory].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))), [aiHistory]);

  const filteredDossiers = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return dossiers.filter((item) => {
      const code = String(item.applicationCode || item.id || "").toLowerCase();
      const name = String(item.citizenName || item.formData?.fullName || "").toLowerCase();
      const phone = String(item.phone || item.formData?.phone || "").toLowerCase();
      const status = String(item.status || "PENDING").toUpperCase();
      const matchesQuery = !q || code.includes(q) || name.includes(q) || phone.includes(q);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [dossiers, query, statusFilter]);

  async function loadDashboard() {
    const [statsRes, dossierRes, convRes] = await Promise.all([getAdminDashboard(), getAdminDossiers(""), getAdminSupportConversations()]);
    setDashboard(statsRes.data);
    setDossiers(dossierRes.data.dossiers || []);
    setConversations(convRes.data.conversations || []);
  }
  async function loadConversation(id) { if (!id) return; try { const res = await getAdminSupportConversation(id); setConversationDetail(res.data.conversation); } catch { setMessage("Không tải được hội thoại"); } }
  async function loadAiData() { const [historyRes, rulesRes] = await Promise.all([getAdminAiHistory(), getAdminAiRules()]); setAiHistory(historyRes.data.history || []); setRuleText(rulesRes.data.rulesText || ""); }

  useEffect(() => { loadDashboard().catch(() => setMessage("Không tải được dữ liệu quản trị")); }, []);
  useEffect(() => { if (activeConversationId) loadConversation(activeConversationId).catch(() => setMessage("Không tải được hội thoại")); }, [activeConversationId]);
  useEffect(() => { if (activeTab === "ai") loadAiData().catch(() => setMessage("Không tải được dữ liệu AI")); }, [activeTab]);

  async function sendSupportMessage(content) { if (!activeConversationId) return; const text = String(content || "").trim(); if (!text) return; setBusy(true); try { await postAdminSupportMessage(activeConversationId, text); setChatText(""); await Promise.all([loadConversation(activeConversationId), loadDashboard()]); } catch { setMessage("Gửi tin nhắn thất bại"); } finally { setBusy(false); } }
  async function markResolved() { if (!activeConversationId) return; setBusy(true); try { await postAdminSupportResolve(activeConversationId); await Promise.all([loadConversation(activeConversationId), loadDashboard()]); setMessage("Đã đánh dấu hội thoại là đã giải quyết"); } catch { setMessage("Không cập nhật được trạng thái hội thoại"); } finally { setBusy(false); } }
  async function saveAiRules() { setBusy(true); try { await putAdminAiRules(ruleText); await loadAiData(); setMessage("Đã cập nhật bộ quy tắc AI"); } catch { setMessage("Lưu bộ quy tắc AI thất bại"); } finally { setBusy(false); } }

  async function refreshDossiers(codeToKeep = null) {
    const refreshed = await getAdminDossiers("");
    const nextList = refreshed.data.dossiers || [];
    setDossiers(nextList);
    const nextSelected = codeToKeep ? nextList.find((x) => (x.applicationCode || x.id) === codeToKeep) : nextList.find((x) => (x.applicationCode || x.id) === (selectedDossier?.applicationCode || selectedDossier?.id));
    setSelectedDossier(nextSelected || nextList[0] || null);
    await loadDashboard();
  }

  async function submitWorkflow(status, note = "") {
    if (!selectedDossier?.applicationCode && !selectedDossier?.id) return;
    const code = selectedDossier.applicationCode || selectedDossier.id;
    setBusy(true);
    try {
      await updateAdminDossierStatus(code, { status, note, action: String(status).toLowerCase() });
      await refreshDossiers(code);
      setMessage("Đã cập nhật trạng thái hồ sơ");
      setWorkflowModal(null);
    } catch (e) {
      setMessage(getApiErrorMessage(e) || "Không cập nhật được trạng thái hồ sơ");
    } finally {
      setBusy(false);
    }
  }

  function openModal(status) {
    setWorkflowModal({ status, note: "" });
  }

  function closeModal() {
    setWorkflowModal(null);
  }

  const renderMessageBubble = (msg) => {
    const isAdmin = msg.from === "admin";
    const senderName = msg.sender?.fullName || (isAdmin ? user?.fullName || "Cán bộ" : conversationDetail?.citizenName || "Người dân");
    const senderAvatar = msg.sender?.avatarUrl || null;
    const timeStr = new Date(msg.createdAt || msg.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return <div key={msg.id} style={{ display: "flex", flexDirection: isAdmin ? "row-reverse" : "row", alignItems: "flex-end", gap: 10, marginBottom: 16 }}><AvatarDisplay name={senderName} src={senderAvatar} size={36} /><div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start" }}><div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{senderName} • {timeStr}</div><div style={{ background: isAdmin ? "#003366" : "#fff", color: isAdmin ? "#fff" : "#0f172a", border: isAdmin ? "none" : "1px solid #e2e8f0", borderRadius: 18, padding: "12px 14px", boxShadow: "0 6px 16px rgba(15,23,42,0.06)", whiteSpace: "pre-wrap" }}>{msg.text}</div></div></div>;
  };

  const dossier = selectedDossier;
  const dossierStatus = String(dossier?.status || "PENDING").toUpperCase();
  const timeline = Array.isArray(dossier?.timeline) ? dossier.timeline : Array.isArray(dossier?.history) ? dossier.history : [];
  const attachments = Array.isArray(dossier?.attachments) ? dossier.attachments.map(normalizeAttachment).filter(Boolean) : [];
  const workflowDisabled = (status) => dossierStatus === status;
  const canEdit = Boolean(dossier);

  const renderDossierField = (label, value) => <Row label={label} value={value} />;

  return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="rounded-2xl bg-[#003366] p-2 text-white"><ShieldCheck className="h-6 w-6" /></div><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trang quản trị</div><div className="text-xl font-black text-slate-900">Cổng Dịch vụ công</div></div></div><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><UserAvatar user={user} size={44} /><div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{user?.fullName || "Quản trị viên"}</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">ADMIN</span></div><div className="text-xs text-slate-500">{user?.email || "Chưa có email"}</div></div><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><LogOut className="h-4 w-4" />Đăng xuất</button></div></div></div><div className="mx-auto flex max-w-7xl gap-6 px-4 py-6"><aside className="hidden w-72 shrink-0 md:block"><div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">{NAV_ITEMS.map((item) => { const Icon = item.icon; const active = activeTab === item.key; return <button key={item.key} type="button" onClick={() => navigate(item.path)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${active ? "bg-[#003366] text-white shadow-md" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div></aside><main className="min-w-0 flex-1"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-500">Đang đăng nhập với quyền</div><div className="text-2xl font-black text-slate-900">{user?.role === "admin" ? "Quản trị viên" : "Người dùng"}</div></div><button type="button" onClick={() => loadDashboard()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><RefreshCw className="h-4 w-4" />Làm mới</button></div>{message ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div> : null}{activeTab === "dashboard" && <div><h1 className="text-2xl font-black text-slate-900">Dashboard điều hành</h1><p className="mt-1 text-sm text-slate-600">Tổng quan số liệu hồ sơ theo workflow mới.</p><div className="mt-4 grid gap-4 md:grid-cols-5"><Widget title="PENDING" value={String(dashboard.pending || 0)} colorClass="text-slate-700" /><Widget title="PROCESSING" value={String(dashboard.processing || 0)} colorClass="text-sky-700" /><Widget title="NEED_MORE" value={String(dashboard.needMore || 0)} colorClass="text-amber-700" /><Widget title="COMPLETED" value={String(dashboard.completed || 0)} colorClass="text-emerald-700" /><Widget title="REJECTED" value={String(dashboard.rejected || 0)} colorClass="text-red-700" /></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Widget title="Tin nhắn chờ xử lý" value={String(dashboard.waitingMessages || 0)} colorClass="text-[#003366]" /></div></div>}{activeTab === "records" && <div className="grid gap-6 xl:grid-cols-[380px_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-black text-slate-900">Quản lý hồ sơ</h1><p className="mt-1 text-sm text-slate-600">Danh sách hồ sơ và bộ lọc nhanh.</p></div><button type="button" onClick={() => loadDashboard()} className="rounded-xl bg-slate-50 p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button></div><div className="mt-4 space-y-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo mã hồ sơ, tên, SĐT..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#003366]" /></div><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-500" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#003366]"><option value="ALL">Tất cả trạng thái</option><option value="PENDING">Chờ tiếp nhận</option><option value="PROCESSING">Đang xử lý</option><option value="NEED_MORE">Yêu cầu bổ sung</option><option value="REJECTED">Từ chối</option><option value="COMPLETED">Hoàn thành</option></select></div></div><div className="mt-4 max-h-[calc(100vh-380px)] space-y-3 overflow-auto pr-1">{filteredDossiers.map((item) => { const code = item.applicationCode || item.id; const st = statusLabel(item.status); const active = code === (dossier?.applicationCode || dossier?.id); return <button key={code} type="button" onClick={() => setSelectedDossier(item)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-[#003366] bg-[#003366]/5 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-black text-[#003366]">{code}</div><div className="mt-1 truncate text-sm text-slate-700">{item.citizenName || item.formData?.fullName || "-"}</div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${st.color}`}>{st.text}</span></div><div className="mt-3 grid gap-1 text-xs text-slate-500"><div className="truncate"><span className="font-semibold text-slate-600">Dịch vụ:</span> {item.serviceName || item.serviceId || "-"}</div><div><span className="font-semibold text-slate-600">Ngày tạo:</span> {formatDate(item.createdAt)}</div><div><span className="font-semibold text-slate-600">SĐT:</span> {item.phone || item.formData?.phone || "-"}</div></div></button>; })}{!filteredDossiers.length && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Không có hồ sơ phù hợp bộ lọc.</div>}</div></section><section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><h2 className="text-2xl font-black text-slate-900">Chi tiết hồ sơ</h2><p className="mt-1 text-sm text-slate-600">Thông tin đầy đủ theo hồ sơ đã chọn.</p></div>{dossier && <div className={`rounded-full px-3 py-1 text-xs font-bold ${statusLabel(dossier.status).color}`}>{statusLabel(dossier.status).text}</div>}</div>{dossier ? <div className="mt-5 space-y-6"><div className="grid gap-3 lg:grid-cols-2">{renderDossierField("Mã hồ sơ", dossier.applicationCode || dossier.id)}{renderDossierField("Dịch vụ đã nộp", dossier.serviceName || dossier.serviceId)}{renderDossierField("Người dân", dossier.citizenName || dossier.formData?.fullName)}{renderDossierField("Email", dossier.email || dossier.formData?.email)}{renderDossierField("Số điện thoại", dossier.phone || dossier.formData?.phone)}{renderDossierField("CCCD/CMND", dossier.formData?.citizenId || dossier.citizenId)}{renderDossierField("Địa chỉ", dossier.formData?.address || dossier.address)}{renderDossierField("Ngày tạo", formatDate(dossier.createdAt))}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-base font-black text-slate-900">Thông tin kê khai</h3><div className="mt-4 space-y-3">{Object.entries({ fullName: "Họ tên", email: "Email", phone: "SĐT", citizenId: "CCCD/CMND", address: "Địa chỉ", ward: "Phường/Xã", district: "Quận/Huyện", city: "Tỉnh/Thành phố", requestContent: "Nội dung yêu cầu" }).map(([key, label]) => <Row key={key} label={label} value={dossier.formData?.[key]} />)}</div></div><div><h3 className="text-base font-black text-slate-900">Tài liệu đính kèm</h3>{attachments.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{attachments.map((file, idx) => <div key={`${file.key || file.name || idx}`} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="font-bold text-slate-900">{file.label || file.key || file.name || `Tài liệu ${idx + 1}`}</div><div className="mt-2 text-sm text-slate-600"><div><strong>Tên tệp:</strong> {renderFileName(file) || "-"}</div><div><strong>Loại:</strong> {file.mimeType || file.type || "-"}</div><div><strong>Kích thước:</strong> {file.size ? `${Math.round(file.size / 1024)} KB` : "-"}</div><div className="mt-2 truncate text-xs text-slate-500" title={file.fileUrl || file.path || file.url || ""}>Đường dẫn: {file.fileUrl || file.path || file.url || "-"}</div></div>{file.previewUrl && (file.mimeType || file.type || "").startsWith("image/") && <div className="mt-3"><img src={file.previewUrl} alt={renderFileName(file) || "preview"} className="h-40 w-full rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /><div className="mt-2 flex flex-wrap gap-2"><a href={file.previewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-[#003366] px-3 py-2 text-sm font-semibold text-white">Mở ảnh</a><a href={getDownloadUrl(file)} download={renderFileName(file)} className="inline-flex rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Tải file</a></div></div>}{file.previewUrl && !(file.mimeType || file.type || "").startsWith("image/") && <a href={getDownloadUrl(file)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Tải file</a>}</div>)}</div> : <div className="mt-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Không có tài liệu đính kèm.</div>}</div><div><div className="flex items-center justify-between"><h3 className="text-base font-black text-slate-900">Timeline xử lý hồ sơ</h3><span className="text-xs text-slate-500">{timeline.length} mốc</span></div><div className="mt-4 space-y-3">{timeline.length ? timeline.map((t, idx) => { const st = statusLabel(t.status); return <div key={`${t.createdAt || idx}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${st.color}`}>{st.text}</span><span className="font-semibold text-slate-900">{t.action || "Cập nhật trạng thái"}</span><span className="text-slate-500">{formatDate(t.createdAt)}</span></div><div className="mt-2 text-sm text-slate-700">{t.note || "—"}</div><div className="mt-1 text-xs text-slate-500">Bởi: {t.actor || "—"}</div></div>; }) : <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Chưa có timeline.</div>}</div></div><div className="rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">Thao tác xử lý</h3><p className="mt-1 text-sm text-slate-600">Thực hiện các bước workflow cho hồ sơ đang chọn.</p></div><div className={`rounded-full px-3 py-1 text-xs font-bold ${statusLabel(dossierStatus).color}`}>{statusLabel(dossierStatus).text}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{WORKFLOW_BUTTONS.map((btn) => { const Icon = btn.icon; const isCurrent = dossierStatus === btn.key; const disableByState = btn.key === "PENDING" ? false : btn.key === "PROCESSING" ? dossierStatus === "COMPLETED" || dossierStatus === "REJECTED" : btn.key === "NEED_MORE" ? dossierStatus === "COMPLETED" : btn.key === "REJECTED" ? dossierStatus === "COMPLETED" : btn.key === "COMPLETED" ? dossierStatus === "REJECTED" || dossierStatus === "COMPLETED" : false; const disabled = busy || !canEdit || disableByState || isCurrent; return <button key={btn.key} type="button" disabled={disabled} onClick={() => (btn.key === "NEED_MORE" || btn.key === "REJECTED") ? openModal(btn.key) : submitWorkflow(btn.key, btn.key === "COMPLETED" ? "Hồ sơ đã hoàn thành" : btn.key === "PROCESSING" ? "Hồ sơ đang được xử lý" : "Hồ sơ đã được tiếp nhận")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${btn.className}`}><Icon className="h-4 w-4" />{btn.label}</button>; })}</div></div></div> : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Chọn một hồ sơ ở cột trái để xem chi tiết.</div>}</section></div>}{activeTab === "support" && <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-slate-900">Trung tâm hỗ trợ trực tuyến</h1><p className="mt-1 text-sm text-slate-600">Kênh chat 1v1 giữa người dân và cán bộ xử lý.</p></div><div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700"><Bell className="h-4 w-4" />{dashboard.waitingMessages} hội thoại mới</div></div><div className="mt-4 grid gap-4 lg:grid-cols-12"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-4"><div className="mb-2 flex items-center justify-between"><div className="text-sm font-black text-slate-900">Người dân đang chờ</div><button type="button" onClick={() => loadDashboard()} className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button></div><div className="space-y-2 overflow-y-auto" style={{ maxHeight: 560 }}>{sortedConversations.map((conv) => { const isActive = activeConversationId === conv.id; const isWaiting = conv.status === "active" || conv.status === "waiting"; const lastMsg = conv.latestMessage; const preview = lastMsg?.text ? (lastMsg.text.length > 40 ? lastMsg.text.slice(0, 40) + "..." : lastMsg.text) : "—"; const timeStr = lastMsg?.createdAt || lastMsg?.at ? new Date(lastMsg.createdAt || lastMsg.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""; const citizenName = conv.citizenName || conv.fullName || conv.name || conv.userName || null; const avatarSrc = conv.avatarUrl || conv.avatar || conv.citizenAvatar || conv.citizenAvatarUrl || null; return <button key={conv.id} type="button" onClick={() => setActiveConversationId(conv.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left" }} className={`rounded-xl p-3 transition-all ring-1 hover:shadow-md ${isActive ? "bg-[#003366] text-white ring-[#003366]/50 shadow-md" : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50 hover:ring-[#003366]/20"}`}><AvatarDisplay name={citizenName} src={avatarSrc} size={40} isActiveCard={isActive} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="truncate text-sm font-bold leading-tight">{citizenName || "Người dân"}</span><div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>{isWaiting && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Mới</span>}{timeStr && <span className={`text-[11px] ${isActive ? "text-white/70" : "text-slate-400"}`}>{timeStr}</span>}</div></div>{conv.dossierId && <div className={`mt-0.5 truncate text-xs ${isActive ? "text-white/60" : "text-slate-400"}`}>{conv.dossierId}</div>}<div className={`mt-1 truncate text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>{preview}</div></div></button>; })}</div></div><div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-8"><div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div><div className="text-sm font-semibold text-slate-500">Hội thoại</div><div className="text-lg font-black text-slate-900">{conversationDetail?.citizenName || "Chưa chọn hội thoại"}</div></div><button type="button" disabled={!activeConversationId} onClick={markResolved} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Đã giải quyết</button></div><div style={{ maxHeight: 420, overflow: "auto" }}>{Array.isArray(conversationDetail?.messages) ? conversationDetail.messages.map(renderMessageBubble) : <div className="text-sm text-slate-500">Chọn một hội thoại để xem nội dung</div>}</div><div className="mt-4 flex gap-2"><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Nhập tin nhắn..." className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none" /><button type="button" onClick={() => sendSupportMessage(chatText)} className="rounded-xl bg-[#003366] px-4 py-3 font-bold text-white"><Send className="h-4 w-4" /></button></div></div></div></div>}{activeTab === "ai" && <div><h1 className="text-2xl font-black text-slate-900">Quản trị AI</h1><p className="mt-1 text-sm text-slate-600">Cập nhật bộ quy tắc và theo dõi lịch sử hội thoại AI.</p><div className="mt-4 grid gap-4 lg:grid-cols-12"><div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5"><textarea value={ruleText} onChange={(e) => setRuleText(e.target.value)} rows={12} className="w-full rounded-xl border border-slate-200 p-4 outline-none" /><button type="button" onClick={saveAiRules} className="mt-3 rounded-xl bg-[#003366] px-4 py-2.5 font-bold text-white">Lưu bộ quy tắc</button></div><div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7"><div className="text-sm font-bold text-slate-900">Lịch sử AI</div><div className="mt-3 space-y-3">{sortedAiHistory.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">{item.at}</div><div className="font-semibold">{item.question}</div><div className="text-sm text-slate-700">{item.answer}</div></div>)}</div></div></div></div>}</main></div>{workflowModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-xl font-black text-slate-900">{workflowModal.status === "NEED_MORE" ? "Nhập lý do yêu cầu bổ sung" : "Nhập lý do từ chối"}</h3><button onClick={closeModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><p className="mt-2 text-sm text-slate-600">Hồ sơ sẽ được cập nhật trạng thái ngay sau khi bạn xác nhận.</p><textarea value={workflowModal.note} onChange={(e) => setWorkflowModal({ ...workflowModal, note: e.target.value })} rows={5} className="mt-4 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#003366]" placeholder="Nhập lý do..." /><div className="mt-4 flex gap-2"><button onClick={closeModal} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200">Hủy</button><button onClick={() => submitWorkflow(workflowModal.status, workflowModal.note)} disabled={busy || !String(workflowModal.note || "").trim()} className="flex-1 rounded-xl bg-[#003366] px-4 py-3 font-bold text-white disabled:opacity-50">Xác nhận</button></div></div></div>}</div>;
}
