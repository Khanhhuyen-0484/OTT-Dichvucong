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
} from "lucide-react";
import UserAvatar from "../components/UserAvatar.jsx";
import AdminDossierWorkspace from "../components/admin/AdminDossierWorkspace.jsx";
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
} from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "services", label: "Quản lý dịch vụ", icon: FileText, path: "/admin/services" },
  { key: "statistics", label: "Thống kê", icon: TrendingUp, path: "/admin/statistics" },
  { key: "support", label: "Chat 1v1", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản trị AI", icon: Bot, path: "/admin/ai" },
];

const STATUS_META = {
  PENDING: { text: "Chờ tiếp nhận", color: "bg-slate-100 text-slate-700", icon: CheckCircle2 },
  PROCESSING: { text: "Đang xử lý", color: "bg-sky-100 text-sky-700", icon: Play },
  NEED_MORE: { text: "Yêu cầu bổ sung", color: "bg-amber-100 text-amber-700", icon: BadgeAlert },
  SUPPLEMENTED: { text: "Đã bổ sung", color: "bg-indigo-100 text-indigo-700", icon: FileText },
  REJECTED: { text: "Từ chối", color: "bg-red-100 text-red-700", icon: Ban },
  COMPLETED: { text: "Hoàn thành", color: "bg-emerald-100 text-emerald-700", icon: FileCheck2 },
};

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

function Widget({ title, value, colorClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</div>
    </div>
  );
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
  const [chatText, setChatText] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path === "/admin/chat") return "support";
    if (path === "/admin/documents") return "records";
    if (path === "/admin/ai") return "ai";
    return "dashboard";
  }, [location.pathname]);

  const filteredDossiers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((item) => {
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

  async function loadDashboard() {
    const [statsRes, dossierRes, convRes] = await Promise.all([getAdminDashboard(), getAdminDossiers(""), getAdminSupportConversations()]);
    const stats = statsRes.data || {};
    setDashboard({
      pending: stats.pending ?? stats.totalPending ?? 0,
      processing: stats.processing ?? stats.totalProcessing ?? 0,
      needMore: stats.needMore ?? stats.totalNeedMore ?? 0,
      completed: stats.completed ?? stats.totalCompleted ?? 0,
      rejected: stats.rejected ?? stats.totalRejected ?? 0,
      waitingMessages: stats.waitingMessages ?? 0,
    });
    setDossiers(dossierRes.data.dossiers || []);
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

  useEffect(() => {
    loadDashboard().catch(() => setMessage("Không tải được dữ liệu quản trị"));
  }, []);

  useEffect(() => {
    if (activeConversationId) loadConversation(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    if (activeTab === "ai") loadAiData().catch(() => setMessage("Không tải được dữ liệu AI"));
  }, [activeTab]);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#003366] p-2 text-white"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trang quản trị</div>
              <div className="text-xl font-black text-slate-900">Cổng Dịch vụ công</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button key={item.key} type="button" onClick={() => navigate(item.path)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${active ? "bg-[#003366] text-white shadow-md" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                  <Icon className="h-4 w-4" />{item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-500">Đang đăng nhập với quyền</div>
              <div className="text-2xl font-black text-slate-900">Quản trị viên</div>
            </div>
            <button type="button" onClick={loadDashboard} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <RefreshCw className="h-4 w-4" />Làm mới
            </button>
          </div>

          {message ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div> : null}

          {activeTab === "dashboard" && (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Dashboard điều hành</h1>
              <p className="mt-1 text-sm text-slate-600">Tổng quan số liệu hồ sơ theo workflow mới.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-5">
                <Widget title="Chờ tiếp nhận" value={String(dashboard.pending || 0)} colorClass="text-slate-700" />
                <Widget title="Đang xử lý" value={String(dashboard.processing || 0)} colorClass="text-sky-700" />
                <Widget title="Cần bổ sung" value={String(dashboard.needMore || 0)} colorClass="text-amber-700" />
                <Widget title="Hoàn thành" value={String(dashboard.completed || 0)} colorClass="text-emerald-700" />
                <Widget title="Từ chối" value={String(dashboard.rejected || 0)} colorClass="text-red-700" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Widget title="Tin nhắn chờ xử lý" value={String(dashboard.waitingMessages || 0)} colorClass="text-[#003366]" />
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
                      <option value="REJECTED">Từ chối</option>
                      <option value="COMPLETED">Hoàn thành</option>
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

          {activeTab === "support" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Trung tâm hỗ trợ trực tuyến</h1>
                  <p className="mt-1 text-sm text-slate-600">Kênh chat 1v1 giữa người dân và cán bộ xử lý.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700"><Bell className="h-4 w-4" />{dashboard.waitingMessages} hội thoại mới</div>
              </div>
              <div className="mt-4 grid h-[calc(100vh-260px)] min-h-[460px] gap-4 overflow-hidden xl:grid-cols-12">
                <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-sm xl:col-span-4">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="text-sm font-black text-slate-900">Người dân đang chờ</div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{sortedConversations.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                    {sortedConversations.map((conv) => {
                      const isActive = activeConversationId === conv.id;
                      const latest = latestConversationMessage(conv);
                      const preview = latest?.text || latest?.content || "-";
                      const lastTime = latest?.createdAt || latest?.at || conv.updatedAt;
                      const unreadCount = Number(conv.unreadCount || 0);
                      return (
                        <button key={conv.id} type="button" onClick={() => setActiveConversationId(conv.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${isActive ? "bg-[#003366] text-white shadow-md" : "bg-white text-slate-900 hover:bg-slate-50"}`}>
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
                <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-8">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
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
                    <button type="button" disabled={!activeConversationId || busy} onClick={markResolved} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Đã giải quyết</button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-slate-50 p-3 md:p-4">
                    {Array.isArray(conversationDetail?.messages) ? conversationDetail.messages.map((msg) => {
                      const fromAdmin = msg.from === "admin";
                      const senderUser = fromAdmin ? { fullName: "Cán bộ hỗ trợ" } : (msg.sender || conversationUser(activeConversation));
                      return (
                        <div key={msg.id || msg.createdAt} className={`mb-3 flex items-end gap-2 ${fromAdmin ? "justify-end" : "justify-start"}`}>
                          {!fromAdmin ? <UserAvatar user={senderUser} src={msg.sender?.avatarUrl || conversationAvatar(activeConversation)} size={32} className="ring-white" /> : null}
                          <div className={`flex max-w-[82%] flex-col sm:max-w-[72%] ${fromAdmin ? "items-end" : "items-start"}`}>
                            {!fromAdmin ? <div className="mb-1 px-1 text-[11px] font-bold text-slate-500">{senderUser.fullName || conversationName(activeConversation)}</div> : null}
                            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${fromAdmin ? "rounded-br-md bg-[#003366] text-white" : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200"}`}>{msg.text}</div>
                            <div className="mt-1 px-1 text-[11px] text-slate-400">{formatChatTime(msg.createdAt || msg.at)}</div>
                          </div>
                        </div>
                      );
                    }) : <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-semibold text-slate-500">Chọn một hội thoại để xem nội dung</div>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Nhập tin nhắn..." className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none" />
                    <button type="button" disabled={busy} onClick={sendSupportMessage} className="rounded-xl bg-[#003366] px-4 py-3 font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Quản trị AI</h1>
              <p className="mt-1 text-sm text-slate-600">Cập nhật bộ quy tắc và theo dõi lịch sử hội thoại AI.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5">
                  <textarea value={ruleText} onChange={(e) => setRuleText(e.target.value)} rows={12} className="w-full rounded-xl border border-slate-200 p-4 outline-none" />
                  <button type="button" disabled={busy} onClick={saveAiRules} className="mt-3 rounded-xl bg-[#003366] px-4 py-2.5 font-bold text-white disabled:opacity-50">Lưu bộ quy tắc</button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7">
                  <div className="text-sm font-bold text-slate-900">Lịch sử AI</div>
                  <div className="mt-3 space-y-3">{sortedAiHistory.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">{item.at}</div><div className="font-semibold">{item.question}</div><div className="text-sm text-slate-700">{item.answer}</div></div>)}</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
