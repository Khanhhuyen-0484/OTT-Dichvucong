import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BadgeAlert,
  Ban,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  Filter,
  House,
  LogOut,
  MessageCircleMore,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  UserCog,
  UsersRound,
} from "lucide-react";
import UserAvatar from "../components/UserAvatar.jsx";
import AdminDossierWorkspace from "../components/admin/AdminDossierWorkspace.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getAdminAiHistory,
  getAdminAiRules,
  getAdminDashboard,
  getAdminDossiers,
  getAdminUsers,
  getAdminSupportConversation,
  getAdminSupportConversations,
  postAdminSupportMessage,
  postAdminSupportResolve,
  putAdminAiRules,
  updateAdminUserRole,
} from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "services", label: "Quản lý dịch vụ", icon: FileText, path: "/admin/services" },
  { key: "statistics", label: "Thống kê", icon: TrendingUp, path: "/admin/statistics" },
  { key: "users", label: "Quản lý người dùng", icon: UsersRound, path: "/admin/users" },
  { key: "support", label: "Chat 1v1", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản trị AI", icon: Bot, path: "/admin/ai" },
];

const STATUS_META = {
  PENDING: { text: "Chờ tiếp nhận", color: "bg-slate-100 text-slate-700", icon: CheckCircle2 },
  PROCESSING: { text: "Đang xử lý", color: "bg-sky-100 text-sky-700", icon: Play },
  NEED_MORE: { text: "Yêu cầu bổ sung", color: "bg-amber-100 text-amber-700", icon: BadgeAlert },
  SUPPLEMENTED: { text: "Đã bổ sung", color: "bg-indigo-100 text-indigo-700", icon: FileText },
  APPROVED: { text: "Đã duyệt", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { text: "Từ chối", color: "bg-red-100 text-red-700", icon: Ban },
  COMPLETED: { text: "Hoàn thành", color: "bg-emerald-100 text-emerald-700", icon: FileCheck2 },
};

STATUS_META.RESULT_DELIVERED = { text: "Đã trả kết quả", color: "bg-emerald-100 text-emerald-700", icon: FileCheck2 };

function formatDate(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

function formatChatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat("vi-VN", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" }).format(date);
}

function conversationName(conv) {
  return conv?.citizenName || conv?.fullName || conv?.user?.fullName || "Người dân";
}

function conversationAvatar(conv) {
  return conv?.avatarUrl || conv?.user?.avatarUrl || conv?.sender?.avatarUrl || "";
}

function conversationUser(conv) {
  return { fullName: conversationName(conv), email: conv?.email || conv?.user?.email || "" };
}

function latestConversationMessage(conv) {
  const messages = Array.isArray(conv?.messages) ? conv.messages.filter(Boolean) : [];
  return conv?.latestMessage || conv?.lastMessage || messages[messages.length - 1] || null;
}

function statusLabel(status) {
  return STATUS_META[String(status || "").toUpperCase()] || { text: status || "Chưa rõ", color: "bg-slate-100 text-slate-700" };
}

function DashboardIllustration() {
  return (
    <div className="relative hidden h-32 w-80 shrink-0 lg:block">
      <div className="absolute right-10 top-4 h-24 w-36 rounded-3xl border border-blue-100 bg-white/75 shadow-xl shadow-blue-500/10 rotate-6">
        <div className="mx-4 mt-4 h-2 rounded-full bg-blue-200" />
        <div className="mx-4 mt-3 h-2 w-20 rounded-full bg-cyan-100" />
        <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
          <div className="h-8 rounded-xl bg-blue-100" />
          <div className="h-8 rounded-xl bg-violet-100" />
          <div className="h-8 rounded-xl bg-cyan-100" />
        </div>
      </div>
      <div className="absolute bottom-3 right-1 flex items-end gap-2">
        <div className="h-10 w-5 rounded-t-xl bg-blue-300" />
        <div className="h-16 w-5 rounded-t-xl bg-cyan-400" />
        <div className="h-24 w-5 rounded-t-xl bg-blue-600" />
      </div>
      <div className="absolute bottom-4 left-14 h-10 w-10 rounded-2xl bg-emerald-100 shadow-lg">
        <div className="mx-auto mt-2 h-5 w-2 rounded-full bg-emerald-500" />
      </div>
      <div className="absolute inset-x-10 bottom-0 h-3 rounded-full bg-blue-200/40 blur-md" />
    </div>
  );
}

function DashboardStatCard({ title, value, icon: Icon, tone }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-xl">
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${tone.glow}`} />
      <div className="relative flex items-start gap-4">
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone.iconBg} ${tone.iconText} shadow-sm`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-700">{title}</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState({ pending: 0, processing: 0, needMore: 0, approved: 0, completed: 0, rejected: 0, waitingMessages: 0 });
  const [dossiers, setDossiers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationDetail, setConversationDetail] = useState(null);
  const [chatText, setChatText] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSummary, setUserSummary] = useState({ total: 0, admins: 0, citizens: 0 });
  const [userQuery, setUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path === "/admin/chat") return "support";
    if (path === "/admin/documents") return "records";
    if (path === "/admin/ai") return "ai";
    if (path === "/admin/users") return "users";
    return "dashboard";
  }, [location.pathname]);

  const filteredDossiers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...dossiers]
      .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
      .filter((item) => {
        const code = String(item.applicationCode || item.dossierCode || item.dossierId || item.id || "").toLowerCase();
        const name = String(item.citizenName || item.formData?.fullName || "").toLowerCase();
        const phone = String(item.phone || item.formData?.phone || "").toLowerCase();
        const status = String(item.status || "PENDING").toUpperCase();
        return (!q || code.includes(q) || name.includes(q) || phone.includes(q)) && (statusFilter === "ALL" || status === statusFilter);
      });
  }, [dossiers, query, statusFilter]);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => {
      const am = latestConversationMessage(a);
      const bm = latestConversationMessage(b);
      const at = am?.createdAt || am?.at || a.updatedAt || "";
      const bt = bm?.createdAt || bm?.at || b.updatedAt || "";
      return String(bt).localeCompare(String(at));
    }),
    [conversations]
  );

  const sortedAiHistory = useMemo(() => [...aiHistory].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))), [aiHistory]);
  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.id === activeConversationId) || conversationDetail || null,
    [activeConversationId, conversationDetail, conversations]
  );
  const activeNavItem = NAV_ITEMS.find((item) => item.key === activeTab);
  const pageTitle = activeNavItem?.label || "Quản trị viên";
  const pageDescription = activeTab === "records"
    ? "Theo dõi dữ liệu, xử lý hồ sơ và phản hồi người dân trên cùng một không gian."
    : activeTab === "users"
      ? "Theo dõi tài khoản công dân, cán bộ và phân quyền truy cập hệ thống."
    : activeTab === "support"
      ? "Theo dõi hội thoại, hỗ trợ người dân và xử lý phản hồi nhanh hơn."
      : activeTab === "ai"
        ? "Cấu hình quy tắc phản hồi, kiểm soát tri thức và theo dõi lịch sử AI."
        : "Theo dõi hoạt động và vận hành hệ thống dịch vụ công.";
  const isRecordsPage = activeTab === "records";
  const isWideAdminPage = activeTab === "dashboard" || activeTab === "records" || activeTab === "support" || activeTab === "ai" || activeTab === "users";

  async function loadDashboard() {
    const [statsRes, dossierRes, convRes] = await Promise.all([getAdminDashboard(), getAdminDossiers(""), getAdminSupportConversations()]);
    const stats = statsRes.data || {};
    setDashboard({
      pending: stats.pending ?? stats.totalPending ?? 0,
      processing: stats.processing ?? stats.totalProcessing ?? 0,
      needMore: stats.needMore ?? stats.totalNeedMore ?? 0,
      approved: stats.approved ?? stats.totalApproved ?? 0,
      completed: stats.completed ?? stats.totalCompleted ?? 0,
      rejected: stats.rejected ?? stats.totalRejected ?? 0,
      waitingMessages: stats.waitingMessages ?? 0,
    });
    setDossiers([...(dossierRes.data.dossiers || [])].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)));
    setConversations(convRes.data.conversations || []);
  }

  async function loadConversation(id) {
    if (!id) return;
    try {
      const res = await getAdminSupportConversation(id);
      setConversationDetail(res.data.conversation);
    } catch {
      setMessage("Không tải được hội thoại");
    }
  }

  async function loadAiData() {
    const [historyRes, rulesRes] = await Promise.all([getAdminAiHistory(), getAdminAiRules()]);
    setAiHistory(historyRes.data.history || []);
    setRuleText(rulesRes.data.rulesText || "");
  }

  async function loadUsers() {
    const res = await getAdminUsers({ q: userQuery, role: userRoleFilter });
    setUsers(res.data.users || []);
    setUserSummary(res.data.summary || { total: 0, admins: 0, citizens: 0 });
  }

  useEffect(() => {
    loadDashboard().catch(() => setMessage("Không tải được dữ liệu quản trị"));
  }, []);

  useEffect(() => {
    if (activeConversationId) loadConversation(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (activeTab === "ai") loadAiData().catch(() => setMessage("Không tải được dữ liệu AI"));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "users") loadUsers().catch(() => setMessage("Không tải được danh sách người dùng"));
  }, [activeTab, userRoleFilter]);

  async function sendSupportMessage() {
    const text = chatText.trim();
    if (!activeConversationId || !text) return;
    setBusy(true);
    try {
      await postAdminSupportMessage(activeConversationId, text);
      setChatText("");
      await Promise.all([loadConversation(activeConversationId), loadDashboard()]);
    } catch {
      setMessage("Gửi tin nhắn thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function markResolved() {
    if (!activeConversationId) return;
    setBusy(true);
    try {
      await postAdminSupportResolve(activeConversationId);
      await Promise.all([loadConversation(activeConversationId), loadDashboard()]);
      setMessage("Đã đánh dấu hội thoại là đã giải quyết");
    } catch {
      setMessage("Không cập nhật được trạng thái hội thoại");
    } finally {
      setBusy(false);
    }
  }

  async function saveAiRules() {
    setBusy(true);
    try {
      await putAdminAiRules(ruleText);
      await loadAiData();
      setMessage("Đã cập nhật bộ quy tắc AI");
    } catch {
      setMessage("Lưu bộ quy tắc AI thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function searchUsers(e) {
    e?.preventDefault?.();
    setBusy(true);
    try {
      await loadUsers();
    } catch {
      setMessage("Không tìm được danh sách người dùng");
    } finally {
      setBusy(false);
    }
  }

  async function changeUserRole(userId, role) {
    if (!userId || !role) return;
    setBusy(true);
    try {
      await updateAdminUserRole(userId, role);
      await loadUsers();
      setMessage("Đã cập nhật vai trò người dùng");
    } catch {
      setMessage("Cập nhật vai trò người dùng thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.14),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_46%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-white/70 bg-white/85 shadow-sm backdrop-blur">
        <div className={`mx-auto flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between ${isWideAdminPage ? "w-full md:px-6 xl:px-8" : "max-w-7xl"}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-linear-to-br from-blue-700 via-blue-600 to-cyan-500 p-2 text-white shadow-lg shadow-blue-600/25"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trang quản trị</div>
              <div className="text-xl font-black text-slate-900">Cổng Dịch vụ công</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
            <UserAvatar user={user} size={44} />
            <div>
              <div className="text-sm font-bold text-slate-900">{user?.fullName || "Quản trị viên"}</div>
              <div className="text-xs text-slate-500">{user?.email || "Chưa có email"}</div>
            </div>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <LogOut className="h-4 w-4" />Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className={`mx-auto flex gap-6 px-4 py-6 ${isWideAdminPage ? "w-full md:px-6 xl:px-8" : "max-w-7xl"}`}>
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="sticky top-6 rounded-4xl border border-white/80 bg-white/80 p-3 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Điều hướng</div>
              <div className="mt-1 text-sm font-black text-slate-900">Bảng quản trị</div>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button key={item.key} type="button" onClick={() => navigate(item.path)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${active ? "bg-linear-to-r from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-600/20" : "bg-white/70 text-slate-700 ring-1 ring-slate-100 hover:bg-blue-50 hover:text-blue-700"}`}>
                  <Icon className="h-4 w-4" />{item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3 overflow-hidden rounded-4xl border border-white/80 bg-white/80 p-5 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-500">
                {activeTab === "dashboard" ? `Xin chào, ${user?.fullName || "Quản trị viên"}` : "Đang đăng nhập với quyền"}
              </div>
              <div className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                {activeTab === "dashboard" ? "Tổng quan hệ thống" : pageTitle}
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-500">{pageDescription}</p>
            </div>
            {activeTab === "dashboard" ? <DashboardIllustration /> : null}
            <button type="button" onClick={loadDashboard} className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md">
              <RefreshCw className="h-4 w-4" />Làm mới
            </button>
          </div>

          {message ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div> : null}

          {activeTab === "dashboard" && (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Dashboard điều hành</h1>
              <p className="mt-1 text-sm text-slate-600">Tổng quan số liệu hồ sơ theo workflow mới.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <DashboardStatCard title="Chờ tiếp nhận" value={String(dashboard.pending || 0)} icon={CheckCircle2} tone={{ iconBg: "bg-blue-50", iconText: "text-blue-600", glow: "bg-blue-200/60" }} />
                <DashboardStatCard title="Đang xử lý" value={String(dashboard.processing || 0)} icon={Play} tone={{ iconBg: "bg-violet-50", iconText: "text-violet-600", glow: "bg-violet-200/60" }} />
                <DashboardStatCard title="Cần bổ sung" value={String(dashboard.needMore || 0)} icon={BadgeAlert} tone={{ iconBg: "bg-orange-50", iconText: "text-orange-600", glow: "bg-orange-200/60" }} />
                <DashboardStatCard title="Đã duyệt" value={String(dashboard.approved || 0)} icon={CheckCircle2} tone={{ iconBg: "bg-emerald-50", iconText: "text-emerald-600", glow: "bg-emerald-200/60" }} />
                <DashboardStatCard title="Hoàn thành" value={String(dashboard.completed || 0)} icon={FileCheck2} tone={{ iconBg: "bg-emerald-50", iconText: "text-emerald-600", glow: "bg-emerald-200/60" }} />
                <DashboardStatCard title="Từ chối" value={String(dashboard.rejected || 0)} icon={Ban} tone={{ iconBg: "bg-rose-50", iconText: "text-rose-600", glow: "bg-rose-200/60" }} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <button type="button" onClick={() => navigate("/admin/chat")} className="group relative overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-5 text-left shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-200/60 blur-2xl" />
                  <div className="relative flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                      <MessageCircleMore className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-700">Tin nhắn chờ xử lý</div>
                      <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{String(dashboard.waitingMessages || 0)}</div>
                      <div className="mt-3 text-xs font-bold text-blue-600">Xem chi tiết →</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === "records" && (
            <AdminDossierWorkspace
              dossiers={dossiers}
              conversations={conversations}
              onReload={loadDashboard}
              setMessage={setMessage}
            />
          )}

          {activeTab === "records-legacy" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"><ClipboardList className="h-4 w-4" />Quản lý hồ sơ</div>
                    <h1 className="mt-3 text-3xl font-black text-slate-900">Danh sách hồ sơ</h1>
                    <p className="mt-2 text-sm text-slate-600">Chọn một hồ sơ để mở trang chi tiết và xử lý workflow.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_260px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo mã hồ sơ, tên, số điện thoại..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#003366]" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-transparent py-3 text-sm font-semibold text-slate-700 outline-none">
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="PENDING">Chờ tiếp nhận</option>
                      <option value="PROCESSING">Đang xử lý</option>
                      <option value="NEED_MORE">Yêu cầu bổ sung</option>
                      <option value="SUPPLEMENTED">Đã bổ sung</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="REJECTED">Từ chối</option>
                      <option value="COMPLETED">Hoàn thành</option>
                      <option value="RESULT_DELIVERED">Đã trả kết quả</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="grid gap-3">
                {filteredDossiers.map((item) => {
                  const code = item.applicationCode || item.dossierCode || item.dossierId || item.id;
                  const st = statusLabel(item.status);
                  return (
                    <button key={code} type="button" onClick={() => navigate(`/admin/dossiers/${code}`)} className="group w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#003366]/40 hover:shadow-md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-[#003366]">{code}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.color}`}>{st.text}</span>
                          </div>
                          <h2 className="mt-3 truncate text-xl font-black text-slate-900">{item.serviceName || item.serviceId || "Hồ sơ dịch vụ công"}</h2>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                            <span><strong className="text-slate-800">Người nộp:</strong> {item.citizenName || item.formData?.fullName || "-"}</span>
                            <span><strong className="text-slate-800">SĐT:</strong> {item.phone || item.formData?.phone || "-"}</span>
                            <span><strong className="text-slate-800">Ngày tạo:</strong> {formatDate(item.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white transition group-hover:bg-[#00264d]"><FileText className="h-4 w-4" />Xem chi tiết</div>
                      </div>
                    </button>
                  );
                })}
                {!filteredDossiers.length && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">Không có hồ sơ phù hợp bộ lọc.</div>}
              </section>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-5">
              <section className="rounded-4xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
                      <UsersRound className="h-4 w-4" />
                      Người dùng hệ thống
                    </div>
                    <h1 className="mt-3 text-3xl font-black text-slate-950">Quản lý người dùng</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Theo dõi tài khoản công dân/cán bộ, tìm kiếm nhanh và phân quyền truy cập hệ thống.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-2xl font-black text-slate-950">{userSummary.total || 0}</div>
                      <div className="mt-1 text-xs font-black uppercase text-slate-500">Tổng tài khoản</div>
                    </div>
                    <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
                      <div className="text-2xl font-black text-blue-800">{userSummary.admins || 0}</div>
                      <div className="mt-1 text-xs font-black uppercase text-blue-700">Cán bộ/Admin</div>
                    </div>
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                      <div className="text-2xl font-black text-emerald-800">{userSummary.citizens || 0}</div>
                      <div className="mt-1 text-xs font-black uppercase text-emerald-700">Người dân</div>
                    </div>
                  </div>
                </div>

                <form onSubmit={searchUsers} className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Tìm theo tên, email, số điện thoại..."
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="citizen">Người dân</option>
                    <option value="admin">Cán bộ/Admin</option>
                  </select>
                  <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-800 disabled:opacity-60">
                    <Search className="h-4 w-4" />
                    Tìm kiếm
                  </button>
                </form>
              </section>

              <section className="overflow-hidden rounded-4xl border border-white/80 bg-white/90 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                <div className="grid grid-cols-[minmax(260px,1.4fr)_minmax(160px,0.8fr)_140px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-black uppercase tracking-wide text-slate-500 max-lg:hidden">
                  <div>Người dùng</div>
                  <div>Liên hệ</div>
                  <div>Vai trò</div>
                  <div>Thao tác</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {users.map((item) => {
                    const isCurrentUser = item.id === user?.id;
                    return (
                      <div key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(260px,1.4fr)_minmax(160px,0.8fr)_140px_180px] lg:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar user={item} src={item.avatarUrl} size={46} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-950">{item.fullName || "Người dùng"}</div>
                            <div className="mt-1 truncate text-xs font-semibold text-slate-500">ID: {item.id || "-"}</div>
                          </div>
                        </div>
                        <div className="min-w-0 text-sm font-semibold text-slate-700">
                          <div className="truncate">{item.email || "-"}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">{item.phone || "-"}</div>
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${item.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {item.role === "admin" ? "Cán bộ/Admin" : "Người dân"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4 text-slate-400" />
                          <select
                            value={item.role === "admin" ? "admin" : "citizen"}
                            disabled={busy || isCurrentUser}
                            onChange={(e) => changeUserRole(item.id, e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="citizen">Người dân</option>
                            <option value="admin">Cán bộ/Admin</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {!users.length ? (
                    <div className="p-10 text-center text-sm font-semibold text-slate-500">Không có người dùng phù hợp bộ lọc.</div>
                  ) : null}
                </div>
              </section>
            </div>
          )}

          {activeTab === "support" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Trung tâm hỗ trợ trực tuyến</h1>
                  <p className="mt-1 text-sm text-slate-600">Kênh chat 1v1 giữa người dân và cán bộ xử lý.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700"><Bell className="h-4 w-4" />{dashboard.waitingMessages} hội thoại mới</div>
              </div>
              <div className="mt-4 grid h-[calc(100vh-230px)] min-h-[620px] gap-5 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col rounded-4xl border border-white/80 bg-white/90 p-3 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                  <div className="flex items-center justify-between px-2 py-3">
                    <div className="text-sm font-black text-slate-900">Người dân đang chờ</div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{sortedConversations.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {sortedConversations.map((conv) => {
                      const isActive = activeConversationId === conv.id;
                      const latest = latestConversationMessage(conv);
                      const preview = latest?.text || latest?.content || "-";
                      const lastTime = latest?.createdAt || latest?.at || conv.updatedAt;
                      const unreadCount = Number(conv.unreadCount || 0);
                      return (
                        <button key={conv.id} type="button" onClick={() => setActiveConversationId(conv.id)} className={`flex w-full items-center gap-3 rounded-3xl p-3 text-left transition ${isActive ? "bg-linear-to-r from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-600/20" : "bg-white/80 text-slate-900 ring-1 ring-slate-100 hover:bg-blue-50"}`}>
                          <UserAvatar user={conversationUser(conv)} src={conversationAvatar(conv)} size={46} className={isActive ? "ring-white/30" : "ring-slate-100"} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-black">{conversationName(conv)}</div>
                              <div className={`shrink-0 text-[11px] font-semibold ${isActive ? "text-white/70" : "text-slate-400"}`}>{formatChatTime(lastTime)}</div>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <div className={`truncate text-xs ${isActive ? "text-white/80" : unreadCount ? "font-bold text-slate-900" : "text-slate-500"}`}>{preview}</div>
                              {unreadCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{unreadCount}</span> : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col rounded-4xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {activeConversation ? (
                        <UserAvatar user={conversationUser(activeConversation)} src={conversationAvatar(activeConversation)} size={48} className="ring-slate-100" />
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><MessageCircleMore className="h-5 w-5" /></div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase text-slate-500">Hội thoại</div>
                        <div className="truncate text-lg font-black text-slate-900">{activeConversation ? conversationName(activeConversation) : "Chưa chọn hội thoại"}</div>
                        {activeConversation ? <div className="truncate text-xs text-slate-500">{activeConversation.phone || activeConversation.email || "Người dân"}</div> : null}
                      </div>
                    </div>
                    <button type="button" disabled={!activeConversationId || busy} onClick={markResolved} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50">Đã giải quyết</button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl bg-linear-to-br from-slate-50 via-blue-50/50 to-cyan-50/40 p-4 md:p-5">
                    {Array.isArray(conversationDetail?.messages) ? conversationDetail.messages.map((msg) => {
                      const fromAdmin = msg.from === "admin";
                      const senderUser = fromAdmin ? { fullName: "Cán bộ hỗ trợ" } : (msg.sender || conversationUser(activeConversation));
                      return (
                        <div key={msg.id || msg.createdAt} className={`mb-3 flex items-end gap-2 ${fromAdmin ? "justify-end" : "justify-start"}`}>
                          {!fromAdmin ? <UserAvatar user={senderUser} src={msg.sender?.avatarUrl || conversationAvatar(activeConversation)} size={32} className="ring-white" /> : null}
                          <div className={`flex max-w-[82%] flex-col sm:max-w-[72%] ${fromAdmin ? "items-end" : "items-start"}`}>
                            {!fromAdmin ? <div className="mb-1 px-1 text-[11px] font-bold text-slate-500">{senderUser.fullName || conversationName(activeConversation)}</div> : null}
                            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${fromAdmin ? "rounded-br-md bg-linear-to-r from-blue-700 to-cyan-500 text-white" : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200"}`}>{msg.text}</div>
                            <div className="mt-1 px-1 text-[11px] text-slate-400">{formatChatTime(msg.createdAt || msg.at)}</div>
                          </div>
                        </div>
                      );
                    }) : <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-semibold text-slate-500">Chọn một hội thoại để xem nội dung</div>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Nhập tin nhắn..." className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <button type="button" disabled={busy} onClick={sendSupportMessage} className="rounded-2xl bg-linear-to-r from-blue-700 to-cyan-500 px-5 py-3 font-black text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"><Send className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-5">
              <section className="relative overflow-hidden rounded-4xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                <div className="absolute inset-0 bg-linear-to-br from-violet-100/70 via-blue-50/80 to-cyan-100/60" />
                <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-300/25 blur-3xl" />
                <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-violet-600 to-cyan-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-600/20">
                      <Bot className="h-4 w-4" />
                      Trung tâm AI
                    </div>
                    <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Quản trị AI</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Cập nhật bộ quy tắc vận hành, kiểm soát nội dung trả lời và xem lại lịch sử tương tác của trợ lý AI.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="text-2xl font-black text-slate-950">{ruleText.trim().length}</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Ký tự quy tắc</div>
                    </div>
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="text-2xl font-black text-slate-950">{sortedAiHistory.length}</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Lượt hỏi AI</div>
                    </div>
                    <div className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm ring-1 ring-slate-200/70">
                      <div className="text-2xl font-black text-emerald-600">ON</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Trạng thái</div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)] 2xl:grid-cols-[minmax(480px,0.85fr)_minmax(0,1.15fr)]">
                <section className="relative overflow-hidden rounded-4xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-200/40 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          <FileText className="h-5 w-5" />
                        </div>
                        <h2 className="mt-3 text-xl font-black text-slate-950">Bộ quy tắc AI</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">Nhập hướng dẫn, phạm vi trả lời và tiêu chuẩn phản hồi cho trợ lý AI.</p>
                      </div>
                      <button type="button" disabled={busy} onClick={saveAiRules} className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 disabled:opacity-50">
                        <FileCheck2 className="h-4 w-4" />
                        Lưu quy tắc
                      </button>
                    </div>
                    <textarea
                      value={ruleText}
                      onChange={(e) => setRuleText(e.target.value)}
                      rows={18}
                      placeholder="Nhập quy tắc vận hành AI, ví dụ: giọng văn, phạm vi hỗ trợ, những nội dung cần từ chối..."
                      className="mt-5 min-h-[520px] w-full resize-none rounded-3xl border border-slate-200 bg-white/95 p-5 text-sm font-semibold leading-7 text-slate-700 shadow-inner outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </div>
                </section>

                <section className="relative overflow-hidden rounded-4xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
                  <div className="absolute -right-12 top-10 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />
                  <div className="relative flex h-full min-h-[680px] flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                          <MessageCircleMore className="h-5 w-5" />
                        </div>
                        <h2 className="mt-3 text-xl font-black text-slate-950">Lịch sử hội thoại AI</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">Theo dõi câu hỏi và phản hồi gần đây của trợ lý AI.</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">{sortedAiHistory.length} bản ghi</span>
                    </div>

                    <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {sortedAiHistory.length ? sortedAiHistory.map((item) => (
                        <article key={item.id || item.at || item.question} className="rounded-3xl border border-white/80 bg-linear-to-br from-white via-blue-50/35 to-cyan-50/50 p-4 shadow-sm ring-1 ring-slate-200/70">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-400">{item.at || "Không rõ thời gian"}</div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">AI log</span>
                          </div>
                          <div className="mt-3 rounded-2xl bg-white/85 p-3 ring-1 ring-slate-100">
                            <div className="text-[11px] font-black uppercase tracking-wide text-violet-500">Câu hỏi</div>
                            <div className="mt-1 text-sm font-black text-slate-900">{item.question || "-"}</div>
                          </div>
                          <div className="mt-3 rounded-2xl bg-linear-to-br from-cyan-50 via-blue-50 to-violet-50 p-3 text-slate-800 shadow-sm ring-1 ring-blue-100">
                            <div className="text-[11px] font-black uppercase tracking-wide text-cyan-700">Phản hồi AI</div>
                            <div className="mt-1 text-sm leading-6 text-slate-700">{item.answer || "-"}</div>
                          </div>
                        </article>
                      )) : (
                        <div className="grid min-h-[360px] place-items-center rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center">
                          <div>
                            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                              <Bot className="h-6 w-6" />
                            </div>
                            <div className="mt-3 text-sm font-black text-slate-700">Chưa có lịch sử AI</div>
                            <div className="mt-1 text-sm text-slate-500">Các tương tác mới sẽ xuất hiện tại đây.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
