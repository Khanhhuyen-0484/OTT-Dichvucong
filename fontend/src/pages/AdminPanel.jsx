import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  ClipboardList,
  House,
  LogOut,
  MessageCircleMore,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  FileText,
  CheckCircle2,
  Ban,
  Clock3
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
  api
} from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "support", label: "Chat 1v1", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản trị AI", icon: Bot, path: "/admin/ai" }
];

function Widget({ title, value, colorClass }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-slate-600">{title}</div><div className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</div></div>;
}
function getInitials(name) { if (!name) return "ND"; const parts = name.trim().split(" ").filter(Boolean); if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase(); }
function AvatarDisplay({ name, src, size = 40, isActiveCard = false }) { if (src) return <img src={src} alt={name || "avatar"} style={{ width: size, height: size, flexShrink: 0 }} className="rounded-full object-cover ring-2 ring-slate-200" />; return <div style={{ width: size, height: size, flexShrink: 0 }} className={`rounded-full flex items-center justify-center text-sm font-bold select-none ${isActiveCard ? "bg-white/20 text-white" : "bg-[#003366] text-white"}`}>{getInitials(name)}</div>; }

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "completed" || s === "paid") return { text: "Đã xử lý", color: "bg-emerald-100 text-emerald-700" };
  if (s === "need_more") return { text: "Cần bổ sung", color: "bg-amber-100 text-amber-700" };
  if (s === "rejected") return { text: "Từ chối", color: "bg-red-100 text-red-700" };
  if (s === "processing" || s === "pending") return { text: "Đang xử lý", color: "bg-sky-100 text-sky-700" };
  return { text: status || "Chưa rõ", color: "bg-slate-100 text-slate-700" };
}

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState({ totalNew: 0, totalOverdue: 0, waitingMessages: 0 });
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

  const activeTab = useMemo(() => {
    const p = location.pathname;
    if (p === "/admin/chat") return "support";
    if (p === "/admin/documents") return "records";
    if (p === "/admin/ai") return "ai";
    return "dashboard";
  }, [location.pathname]);

  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => (b.latestMessage?.createdAt || b.latestMessage?.at || "").localeCompare(a.latestMessage?.createdAt || a.latestMessage?.at || "")), [conversations]);
  const sortedAiHistory = useMemo(() => [...aiHistory].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))), [aiHistory]);

  async function loadDashboard() { const [statsRes, dossierRes, convRes] = await Promise.all([getAdminDashboard(), getAdminDossiers(""), getAdminSupportConversations()]); setDashboard(statsRes.data); setDossiers(dossierRes.data.dossiers || []); setConversations(convRes.data.conversations || []); }
  async function loadConversation(id) { if (!id) return; try { const res = await getAdminSupportConversation(id); setConversationDetail(res.data.conversation); } catch { setMessage("Không tải được hội thoại"); } }
  async function loadAiData() { const [historyRes, rulesRes] = await Promise.all([getAdminAiHistory(), getAdminAiRules()]); setAiHistory(historyRes.data.history || []); setRuleText(rulesRes.data.rulesText || ""); }

  useEffect(() => { loadDashboard().catch(() => setMessage("Không tải được dữ liệu quản trị")); }, []);
  useEffect(() => { if (activeConversationId) loadConversation(activeConversationId).catch(() => setMessage("Không tải được hội thoại")); }, [activeConversationId]);
  useEffect(() => { if (activeTab === "ai") loadAiData().catch(() => setMessage("Không tải được dữ liệu AI")); }, [activeTab]);

  async function sendSupportMessage(content) { if (!activeConversationId) return; const text = String(content || "").trim(); if (!text) return; setBusy(true); try { await postAdminSupportMessage(activeConversationId, text); setChatText(""); await Promise.all([loadConversation(activeConversationId), loadDashboard()]); } catch { setMessage("Gửi tin nhắn thất bại"); } finally { setBusy(false); } }
  async function markResolved() { if (!activeConversationId) return; setBusy(true); try { await postAdminSupportResolve(activeConversationId); await Promise.all([loadConversation(activeConversationId), loadDashboard()]); setMessage("Đã đánh dấu hội thoại là đã giải quyết"); } catch { setMessage("Không cập nhật được trạng thái hội thoại"); } finally { setBusy(false); } }
  async function saveAiRules() { setBusy(true); try { await putAdminAiRules(ruleText); await loadAiData(); setMessage("Đã cập nhật bộ quy tắc AI"); } catch { setMessage("Lưu bộ quy tắc AI thất bại"); } finally { setBusy(false); } }

  async function updateDossierStatus(action) {
    if (!selectedDossier?.applicationCode && !selectedDossier?.id) return;
    const code = selectedDossier.applicationCode || selectedDossier.id;
    let note = "";
    if (action !== "approve") {
      note = window.prompt("Nhập ghi chú cho trạng thái này", "") || "";
      if (!note.trim()) return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/dossiers/${code}/decision`, { action, note });
      const refreshed = await getAdminDossiers("");
      setDossiers(refreshed.data.dossiers || []);
      const next = (refreshed.data.dossiers || []).find((x) => (x.applicationCode || x.id) === code) || null;
      setSelectedDossier(next || null);
      setMessage("Đã cập nhật trạng thái hồ sơ");
      await loadDashboard();
    } catch (e) {
      setMessage(getApiErrorMessage(e) || "Không cập nhật được trạng thái hồ sơ");
    } finally {
      setBusy(false);
    }
  }

  const renderMessageBubble = (msg) => {
    const isAdmin = msg.from === "admin";
    const senderName = msg.sender?.fullName || (isAdmin ? user?.fullName || "Cán bộ" : conversationDetail?.citizenName || "Người dân");
    const senderAvatar = msg.sender?.avatarUrl || null;
    const timeStr = new Date(msg.createdAt || msg.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return <div key={msg.id} style={{ display: "flex", flexDirection: isAdmin ? "row-reverse" : "row", alignItems: "flex-end", gap: 10, marginBottom: 16 }}><AvatarDisplay name={senderName} src={senderAvatar} size={36} /><div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start" }}><div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{senderName} • {timeStr}</div><div style={{ background: isAdmin ? "#003366" : "#fff", color: isAdmin ? "#fff" : "#0f172a", border: isAdmin ? "none" : "1px solid #e2e8f0", borderRadius: 18, padding: "12px 14px", boxShadow: "0 6px 16px rgba(15,23,42,0.06)", whiteSpace: "pre-wrap" }}>{msg.text}</div></div></div>;
  };

  return <div className="min-h-screen bg-slate-50 text-slate-900"><div className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="rounded-2xl bg-[#003366] p-2 text-white"><ShieldCheck className="h-6 w-6" /></div><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trang quản trị</div><div className="text-xl font-black text-slate-900">Cổng Dịch vụ công</div></div></div><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><UserAvatar user={user} size={44} /><div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{user?.fullName || "Quản trị viên"}</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">ADMIN</span></div><div className="text-xs text-slate-500">{user?.email || "Chưa có email"}</div></div><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><LogOut className="h-4 w-4" />Đăng xuất</button></div></div></div><div className="mx-auto flex max-w-7xl gap-6 px-4 py-6"><aside className="hidden w-72 shrink-0 md:block"><div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">{NAV_ITEMS.map((item) => { const Icon = item.icon; const active = activeTab === item.key; return <button key={item.key} type="button" onClick={() => navigate(item.path)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${active ? "bg-[#003366] text-white shadow-md" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div></aside><main className="min-w-0 flex-1"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-500">Đang đăng nhập với quyền</div><div className="text-2xl font-black text-slate-900">{user?.role === "admin" ? "Quản trị viên" : "Người dùng"}</div></div><button type="button" onClick={() => loadDashboard()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><RefreshCw className="h-4 w-4" />Làm mới</button></div>{message ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div> : null}{activeTab === "dashboard" && <div><h1 className="text-2xl font-black text-slate-900">Dashboard điều hành</h1><p className="mt-1 text-sm text-slate-600">Tổng quan số liệu hồ sơ và hỗ trợ người dân theo thời gian thực.</p><div className="mt-4 grid gap-4 md:grid-cols-3"><Widget title="Hồ sơ mới" value={String(dashboard.totalNew)} colorClass="text-emerald-700" /><Widget title="Hồ sơ quá hạn" value={String(dashboard.totalOverdue)} colorClass="text-red-700" /><Widget title="Tin nhắn chờ xử lý" value={String(dashboard.waitingMessages)} colorClass="text-amber-700" /></div></div>}{activeTab === "records" && <div><h1 className="text-2xl font-black text-slate-900">Danh sách hồ sơ</h1><p className="mt-1 text-sm text-slate-600">Bấm vào từng hồ sơ để mở chi tiết ở cuối trang.</p><div className="mt-4 overflow-auto rounded-xl border border-slate-200"><table className="min-w-full bg-white text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 text-left font-semibold">Mã hồ sơ</th><th className="px-3 py-2 text-left font-semibold">Người dân</th><th className="px-3 py-2 text-left font-semibold">SĐT</th><th className="px-3 py-2 text-left font-semibold">Trạng thái</th></tr></thead><tbody>{dossiers.map((item) => { const code = item.applicationCode || item.id; const st = statusLabel(item.status); return <tr key={code} onClick={() => setSelectedDossier(item)} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"><td className="px-3 py-2 font-semibold text-[#003366]">{code}</td><td className="px-3 py-2">{item.citizenName || item.formData?.fullName || "-"}</td><td className="px-3 py-2">{item.phone || item.formData?.phone || "-"}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${st.color}`}>{st.text}</span></td></tr>; })}</tbody></table></div><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-900">Chi tiết hồ sơ</h2><p className="text-sm text-slate-500">Hiển thị nội dung và thao tác trạng thái ở cuối.</p></div>{selectedDossier && <div className={`rounded-full px-3 py-1 text-xs font-bold ${statusLabel(selectedDossier.status).color}`}>{statusLabel(selectedDossier.status).text}</div>}</div>{selectedDossier ? <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3 text-sm"><Row label="Mã hồ sơ" value={selectedDossier.applicationCode || selectedDossier.id} /><Row label="Người dân" value={selectedDossier.citizenName || selectedDossier.formData?.fullName} /><Row label="SĐT" value={selectedDossier.phone || selectedDossier.formData?.phone} /><Row label="Email" value={selectedDossier.email || selectedDossier.formData?.email} /><Row label="Dịch vụ" value={selectedDossier.serviceName || selectedDossier.serviceId} /><Row label="Ngày tạo" value={selectedDossier.createdAt ? new Date(selectedDossier.createdAt).toLocaleString("vi-VN") : "-"} /></div><div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm font-bold text-slate-700">Nội dung hồ sơ</div><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">{JSON.stringify(selectedDossier.formData || selectedDossier, null, 2)}</pre></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => updateDossierStatus("approve")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Duyệt</button><button type="button" disabled={busy} onClick={() => updateDossierStatus("request_more")} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Clock3 className="h-4 w-4" />Bổ sung</button><button type="button" disabled={busy} onClick={() => updateDossierStatus("reject")} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Ban className="h-4 w-4" />Từ chối</button></div></div></div> : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Bấm vào một dòng hồ sơ để xem chi tiết và thao tác trạng thái.</div>}</div></div>}{activeTab === "support" && <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-slate-900">Trung tâm hỗ trợ trực tuyến</h1><p className="mt-1 text-sm text-slate-600">Kênh chat 1v1 giữa người dân và cán bộ xử lý.</p></div><div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700"><Bell className="h-4 w-4" />{dashboard.waitingMessages} hội thoại mới</div></div><div className="mt-4 grid gap-4 lg:grid-cols-12"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-4"><div className="mb-2 flex items-center justify-between"><div className="text-sm font-black text-slate-900">Người dân đang chờ</div><button type="button" onClick={() => loadDashboard()} className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button></div><div className="space-y-2 overflow-y-auto" style={{ maxHeight: 560 }}>{sortedConversations.map((conv) => { const isActive = activeConversationId === conv.id; const isWaiting = conv.status === "active" || conv.status === "waiting"; const lastMsg = conv.latestMessage; const preview = lastMsg?.text ? (lastMsg.text.length > 40 ? lastMsg.text.slice(0, 40) + "..." : lastMsg.text) : "—"; const timeStr = lastMsg?.createdAt || lastMsg?.at ? new Date(lastMsg.createdAt || lastMsg.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""; const citizenName = conv.citizenName || conv.fullName || conv.name || conv.userName || null; const avatarSrc = conv.avatarUrl || conv.avatar || conv.citizenAvatar || conv.citizenAvatarUrl || null; return <button key={conv.id} type="button" onClick={() => setActiveConversationId(conv.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left" }} className={`rounded-xl p-3 transition-all ring-1 hover:shadow-md ${isActive ? "bg-[#003366] text-white ring-[#003366]/50 shadow-md" : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50 hover:ring-[#003366]/20"}`}><AvatarDisplay name={citizenName} src={avatarSrc} size={40} isActiveCard={isActive} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="font-bold text-sm leading-tight truncate">{citizenName || "Người dân"}</span><div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>{isWaiting && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Mới</span>}{timeStr && <span className={`text-[11px] ${isActive ? "text-white/70" : "text-slate-400"}`}>{timeStr}</span>}</div></div>{conv.dossierId && <div className={`text-xs mt-0.5 truncate ${isActive ? "text-white/60" : "text-slate-400"}`}>{conv.dossierId}</div>}<div className={`text-xs mt-1 truncate ${isActive ? "text-white/80" : "text-slate-500"}`}>{preview}</div></div></button>; })}</div></div><div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-8"><div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div><div className="text-sm font-semibold text-slate-500">Hội thoại</div><div className="text-lg font-black text-slate-900">{conversationDetail?.citizenName || "Chưa chọn hội thoại"}</div></div><button type="button" disabled={!activeConversationId} onClick={markResolved} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Đã giải quyết</button></div><div style={{ maxHeight: 420, overflow: "auto" }}>{Array.isArray(conversationDetail?.messages) ? conversationDetail.messages.map(renderMessageBubble) : <div className="text-sm text-slate-500">Chọn một hội thoại để xem nội dung</div>}</div><div className="mt-4 flex gap-2"><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Nhập tin nhắn..." className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none" /><button type="button" onClick={() => sendSupportMessage(chatText)} className="rounded-xl bg-[#003366] px-4 py-3 font-bold text-white"><Send className="h-4 w-4" /></button></div></div></div></div>}{activeTab === "ai" && <div><h1 className="text-2xl font-black text-slate-900">Quản trị AI</h1><p className="mt-1 text-sm text-slate-600">Cập nhật bộ quy tắc và theo dõi lịch sử hội thoại AI.</p><div className="mt-4 grid gap-4 lg:grid-cols-12"><div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5"><textarea value={ruleText} onChange={(e) => setRuleText(e.target.value)} rows={12} className="w-full rounded-xl border border-slate-200 p-4 outline-none" /><button type="button" onClick={saveAiRules} className="mt-3 rounded-xl bg-[#003366] px-4 py-2.5 font-bold text-white">Lưu bộ quy tắc</button></div><div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7"><div className="text-sm font-bold text-slate-900">Lịch sử AI</div><div className="mt-3 space-y-3">{sortedAiHistory.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">{item.at}</div><div className="font-semibold">{item.question}</div><div className="text-sm text-slate-700">{item.answer}</div></div>)}</div></div></div></div>}</main></div></div>;
}

function Row({ label, value }) { return <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-slate-500">{label}</div><div className="col-span-2 font-semibold text-slate-900 break-words">{value || "-"}</div></div>; }
