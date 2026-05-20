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
  ShieldCheck
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
  putAdminAiRules
} from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "support", label: "Chat 1v1", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản trị AI", icon: Bot, path: "/admin/ai" }
];

const QUICK_REPLIES = [
  "Chào bạn, tôi đã tiếp nhận yêu cầu và đang kiểm tra hồ sơ.",
  "Bạn vui lòng bổ sung ảnh giấy tờ rõ nét để xử lý nhanh hơn.",
  "Thông tin đã đầy đủ, chúng tôi sẽ phản hồi trạng thái trong thời gian sớm nhất.",
  "Cảm ơn bạn. Hồ sơ đang được chuyển cho chuyên viên phụ trách."
];

function Widget({ title, value, colorClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</div>
    </div>
  );
}

// Lấy 2 chữ cái viết tắt từ tên đầy đủ
function getInitials(name) {
  if (!name) return "ND";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar component: ưu tiên ảnh thật, fallback initials
function AvatarDisplay({ name, src, size = 40, isActiveCard = false }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        style={{ width: size, height: size, flexShrink: 0 }}
        className="rounded-full object-cover ring-2 ring-slate-200"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, flexShrink: 0 }}
      className={`rounded-full flex items-center justify-center text-sm font-bold select-none ${
        isActiveCard ? "bg-white/20 text-white" : "bg-[#003366] text-white"
      }`}
    >
      {getInitials(name)}
    </div>
  );
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

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort((a, b) =>
        (b.latestMessage?.createdAt || b.latestMessage?.at || "").localeCompare(
          a.latestMessage?.createdAt || a.latestMessage?.at || ""
        )
      ),
    [conversations]
  );

  async function loadDashboard() {
    const [statsRes, dossierRes, convRes] = await Promise.all([
      getAdminDashboard(),
      getAdminDossiers(""),
      getAdminSupportConversations()
    ]);
    setDashboard(statsRes.data);
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
    if (activeConversationId) {
      loadConversation(activeConversationId).catch(() => setMessage("Không tải được hội thoại"));
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (activeTab === "ai") {
      loadAiData().catch(() => setMessage("Không tải được dữ liệu AI"));
    }
  }, [activeTab]);

  async function sendSupportMessage(content) {
    if (!activeConversationId) return;
    const text = String(content || "").trim();
    if (!text) return;
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

  // ── FIX 1: Bubble — Admin ở PHẢI (flex-row-reverse), User ở TRÁI ──
  const renderMessageBubble = (msg) => {
    const isAdmin = msg.from === "admin";
    const senderName =
      msg.sender?.fullName ||
      (isAdmin ? user?.fullName || "Cán bộ" : conversationDetail?.citizenName || "Người dân");
    const senderAvatar = msg.sender?.avatarUrl || null;
    const timeStr = new Date(msg.createdAt || msg.at).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return (
      <div
        key={msg.id}
        style={{
          display: "flex",
          flexDirection: isAdmin ? "row-reverse" : "row",
          alignItems: "flex-end",
          gap: 10,
          marginBottom: 16
        }}
      >
        {/* Avatar */}
        <AvatarDisplay name={senderName} src={senderAvatar} size={36} />

        {/* Bubble + tên */}
        <div
          style={{
            maxWidth: "75%",
            display: "flex",
            flexDirection: "column",
            alignItems: isAdmin ? "flex-end" : "flex-start"
          }}
        >
          {/* Tên + giờ */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
              flexDirection: isAdmin ? "row-reverse" : "row"
            }}
          >
            <span className="text-xs font-semibold text-slate-700">{senderName}</span>
            <span className="text-[11px] text-slate-400">{timeStr}</span>
          </div>

          {/* Nội dung bubble */}
          <div
            className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
              isAdmin
                ? "bg-[#003366] text-white rounded-2xl rounded-br-none"
                : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-none"
            }`}
          >
            {msg.text}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:w-80 lg:shrink-0">
          <div className="mb-4 border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Console</div>
            <div className="mt-1 text-lg font-black text-[#003366]">Hệ thống điều hành</div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    active ? "bg-[#003366] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#003366]/10 px-3 py-1 text-xs font-bold text-[#003366]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Thông tin tài khoản
            </div>
            <div className="flex items-center gap-3">
              <AvatarDisplay name={user?.fullName} src={user?.avatarUrl || null} size={44} />
              <div>
                <div className="text-sm font-bold text-slate-900">{user?.fullName || "Chưa cập nhật tên"}</div>
                <div className="text-xs text-slate-600">{user?.email || "canbo@dichvucong.gov.vn"}</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              Chức vụ: Chuyên viên cấp cao
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7a1f1f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#621717]"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* Main */}
        <section className="min-w-0 flex-1 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          {message && (
            <div className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {message}
            </div>
          )}

          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Dashboard điều hành</h1>
              <p className="mt-1 text-sm text-slate-600">Tổng quan số liệu hồ sơ và hỗ trợ người dân theo thời gian thực.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Widget title="Hồ sơ mới" value={String(dashboard.totalNew)} colorClass="text-emerald-700" />
                <Widget title="Hồ sơ quá hạn" value={String(dashboard.totalOverdue)} colorClass="text-red-700" />
                <Widget title="Tin nhắn chờ xử lý" value={String(dashboard.waitingMessages)} colorClass="text-amber-700" />
              </div>
            </div>
          )}

          {/* Records */}
          {activeTab === "records" && (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Danh sách hồ sơ</h1>
              <p className="mt-1 text-sm text-slate-600">Theo dõi hồ sơ mới để chủ động hỗ trợ người dân trong quá trình xử lý.</p>
              <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Mã hồ sơ</th>
                      <th className="px-3 py-2 text-left font-semibold">Người dân</th>
                      <th className="px-3 py-2 text-left font-semibold">SĐT</th>
                      <th className="px-3 py-2 text-left font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-semibold text-[#003366]">{item.id}</td>
                        <td className="px-3 py-2">{item.citizenName}</td>
                        <td className="px-3 py-2">{item.phone}</td>
                        <td className="px-3 py-2">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Support / Chat 1v1 */}
          {activeTab === "support" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Trung tâm hỗ trợ trực tuyến</h1>
                  <p className="mt-1 text-sm text-slate-600">Kênh chat 1v1 giữa người dân và cán bộ xử lý.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py Asc 1 text-sm font-bold text-red-700">
                  <Bell className="h-4 w-4" />
                  {dashboard.waitingMessages} hội thoại mới
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-12">

                {/* ── FIX 2: Danh sách chờ — tên + avatar riêng từng người ── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-black text-slate-900">Người dân đang chờ</div>
                    <button
                      type="button"
                      onClick={() => loadDashboard()}
                      className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 560 }}>
                    {sortedConversations.map((conv) => {
                      const isActive = activeConversationId === conv.id;
                      const isWaiting = conv.status === "active" || conv.status === "waiting";
                      const lastMsg = conv.latestMessage;
                      const preview = lastMsg?.text
                        ? lastMsg.text.length > 40
                          ? lastMsg.text.slice(0, 40) + "..."
                          : lastMsg.text
                        : "—";
                      const timeStr =
                        lastMsg?.createdAt || lastMsg?.at
                          ? new Date(lastMsg.createdAt || lastMsg.at).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "";

                      // Lấy tên thật — thử nhiều field phổ biến
                      const citizenName =
                        conv.citizenName ||
                        conv.fullName ||
                        conv.name ||
                        conv.userName ||
                        null;

                      // Lấy avatar thật — thử nhiều field phổ biến
                      const avatarSrc =
                        conv.avatarUrl ||
                        conv.avatar ||
                        conv.citizenAvatar ||
                        conv.citizenAvatarUrl ||
                        null;

                      return (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => setActiveConversationId(conv.id)}
                          style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left" }}
                          className={`rounded-xl p-3 transition-all ring-1 hover:shadow-md ${
                            isActive
                              ? "bg-[#003366] text-white ring-[#003366]/50 shadow-md"
                              : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50 hover:ring-[#003366]/20"
                          }`}
                        >
                          {/* Avatar riêng của từng người dùng */}
                          <AvatarDisplay
                            name={citizenName}
                            src={avatarSrc}
                            size={40}
                            isActiveCard={isActive}
                          />

                          {/* Thông tin text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span className="font-bold text-sm leading-tight truncate">
                                {/* Hiển thị tên thật, fallback "Người dân" */}
                                {citizenName || "Người dân"}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                {isWaiting && (
                                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                    Mới
                                  </span>
                                )}
                                {timeStr && (
                                  <span className={`text-[11px] ${isActive ? "text-white/70" : "text-slate-400"}`}>
                                    {timeStr}
                                  </span>
                                )}
                              </div>
                            </div>
                            {conv.dossierId && (
                              <div className={`text-xs mt-0.5 truncate ${isActive ? "text-white/60" : "text-slate-400"}`}>
                                {conv.dossierId}
                              </div>
                            )}
                            <div className={`text-xs mt-1 truncate ${isActive ? "text-white/80" : "text-slate-500"}`}>
                              {preview}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Panel chat phải */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-8">
                  {conversationDetail ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-900">
                          Hội thoại với{" "}
                          <span className="text-[#003366]">
                            {conversationDetail?.citizenName || "Đang tải..."}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={markResolved}
                          disabled={busy}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
                        >
                          Đánh dấu đã xử lý
                        </button>
                      </div>

                      {/* Messages */}
                      <div
                        className="overflow-auto rounded-lg bg-white border border-slate-200 p-4"
                        style={{ minHeight: 180, maxHeight: 320 }}
                      >
                        {conversationDetail.messages?.map(renderMessageBubble) || []}
                      </div>

                      {/* Quick replies */}
                      <div className="mt-3">
                        <div className="mb-2 text-xs font-bold text-slate-600">Mẫu trả lời nhanh</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {QUICK_REPLIES.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => sendSupportMessage(q)}
                              disabled={busy}
                              className="rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-60"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Input */}
                      <div className="mt-3 flex gap-2">
                        <input
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendSupportMessage(chatText);
                            }
                          }}
                          placeholder="Nhập nội dung phản hồi..."
                          className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-[#003366]"
                        />
                        <button
                          type="button"
                          disabled={busy || !chatText.trim()}
                          onClick={() => sendSupportMessage(chatText)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#003366] px-4 py-2 text-sm font-bold text-white hover:bg-[#052b53] disabled:opacity-60"
                        >
                          <Send className="h-4 w-4" />
                          Gửi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600 text-center py-20">
                      Chọn một hội thoại để xem chi tiết và phản hồi người dân.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI */}
          {activeTab === "ai" && (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Quản trị tri thức AI</h1>
              <p className="mt-1 text-sm text-slate-600">Cập nhật quy tắc trả lời để đồng bộ với quy trình nghiệp vụ mới.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-base font-black text-slate-900">Lịch sử phản hồi AI</h2>
                  <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
                    {aiHistory.map((item) => (
                      <div key={item.id} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                        <div className="text-xs font-semibold text-slate-500">Câu hỏi</div>
                        <div className="text-sm font-semibold text-slate-800">{item.question}</div>
                        <div className="mt-2 text-xs font-semibold text-slate-500">Câu trả lời</div>
                        <div className="text-sm text-slate-700">{item.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-base font-black text-slate-900">Bộ quy tắc trả lời</h2>
                  <textarea
                    className="mt-3 h-64 w-full rounded-lg bg-white p-3 text-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-[#003366] resize-none"
                    value={ruleText}
                    onChange={(e) => setRuleText(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveAiRules}
                    className="mt-3 rounded-lg bg-[#003366] px-4 py-2 text-sm font-bold text-white hover:bg-[#052b53] disabled:opacity-60"
                  >
                    Lưu bộ quy tắc
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}