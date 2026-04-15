import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  ClipboardList,
  House,
  MessageCircleMore,
  RefreshCw,
  RotateCw,
  Search
} from "lucide-react";
import {
  getAdminAiHistory,
  getAdminAiRules,
  getAdminDashboard,
  getAdminDossierDetail,
  getAdminDossiers,
  getAdminSupportConversation,
  getAdminSupportConversations,
  postAdminDossierDecision,
  postAdminOpenDossierChat,
  postAdminSupportMessage,
  postAdminSupportResolve,
  putAdminAiRules
} from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Trang chủ (Dashboard)", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "support", label: "Trung tâm hỗ trợ (Chat 1v1)", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản lý Chat AI (Dữ liệu nguồn)", icon: Bot, path: "/admin/ai" }
];

const QUICK_REPLIES = [
  "Chào bạn, tôi là cán bộ xử lý hồ sơ. Tôi đang kiểm tra thông tin bạn cung cấp.",
  "Bạn vui lòng gửi bổ sung ảnh giấy tờ rõ nét hơn để tiếp tục xử lý.",
  "Cảm ơn bạn đã phản hồi, hồ sơ đang được cập nhật trạng thái.",
  "Thông tin đã đầy đủ. Chúng tôi sẽ sớm gửi kết quả qua hệ thống."
];

function viStatus(status) {
  const map = {
    new: "Mới",
    overdue: "Quá hạn",
    processing: "Đang xử lý",
    completed: "Hoàn thành",
    need_more: "Yêu cầu bổ sung",
    rejected: "Từ chối"
  };
  return map[status] || status;
}

function Widget({ title, value, colorClass }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</div>
    </div>
  );
}

export default function AdminPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboard, setDashboard] = useState({
    totalNew: 0,
    totalOverdue: 0,
    waitingMessages: 0
  });
  const [dossiers, setDossiers] = useState([]);
  const [selectedDossierId, setSelectedDossierId] = useState(null);
  const [dossierDetail, setDossierDetail] = useState(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [previewIdx, setPreviewIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
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

  const waitingCount = dashboard.waitingMessages;

  async function loadDashboard() {
    const [statsRes, dossierRes, convRes] = await Promise.all([
      getAdminDashboard(),
      getAdminDossiers(searchTerm),
      getAdminSupportConversations()
    ]);
    setDashboard(statsRes.data);
    setDossiers(dossierRes.data.dossiers || []);
    setConversations(convRes.data.conversations || []);
  }

  async function loadDossierDetail(id) {
    const res = await getAdminDossierDetail(id);
    setDossierDetail(res.data.dossier);
    setPreviewIdx(0);
    setZoom(1);
    setRotation(0);
  }

  async function loadConversation(id) {
    const res = await getAdminSupportConversation(id);
    setConversationDetail(res.data.conversation);
  }

  async function loadAiData() {
    const [historyRes, rulesRes] = await Promise.all([getAdminAiHistory(), getAdminAiRules()]);
    setAiHistory(historyRes.data.history || []);
    setRuleText(rulesRes.data.rulesText || "");
  }

  useEffect(() => {
    const run = async () => {
      try {
        await loadDashboard();
      } catch {
        setMessage("Không tải được dữ liệu dashboard");
      }
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await getAdminDossiers(searchTerm);
        setDossiers(res.data.dossiers || []);
      } catch {
        setMessage("Không tải được danh sách hồ sơ");
      }
    };
    run();
  }, [searchTerm]);

  useEffect(() => {
    if (!selectedDossierId) return;
    loadDossierDetail(selectedDossierId).catch(() => setMessage("Không tải được chi tiết hồ sơ"));
  }, [selectedDossierId]);

  useEffect(() => {
    if (activeTab !== "ai") return;
    loadAiData().catch(() => setMessage("Không tải được dữ liệu AI"));
  }, [activeTab]);

  useEffect(() => {
    if (!activeConversationId) return;
    loadConversation(activeConversationId).catch(() => setMessage("Không tải được hội thoại"));
  }, [activeConversationId]);

  const activeAttachment = dossierDetail?.attachments?.[previewIdx] || null;

  const filteredConversations = useMemo(
    () => conversations.sort((a, b) => (b.latestMessage?.at || "").localeCompare(a.latestMessage?.at || "")),
    [conversations]
  );

  async function submitDecision(action) {
    if (!dossierDetail) return;
    if ((action === "request_more" || action === "reject") && decisionNote.trim().length < 5) {
      setMessage("Vui lòng nhập nội dung ít nhất 5 ký tự cho hành động này");
      return;
    }
    setBusy(true);
    try {
      await postAdminDossierDecision(dossierDetail.id, { action, note: decisionNote });
      await Promise.all([loadDossierDetail(dossierDetail.id), loadDashboard()]);
      setMessage("Cập nhật quyết định hồ sơ thành công");
      setDecisionNote("");
    } catch {
      setMessage("Cập nhật quyết định hồ sơ thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function openChatFromDossier() {
    if (!dossierDetail) return;
    setBusy(true);
    try {
      const res = await postAdminOpenDossierChat(dossierDetail.id);
      const conv = res.data.conversation;
      navigate("/admin/chat");
      setActiveConversationId(conv.id);
      await loadDashboard();
      setMessage("Đã mở chat với người dân");
    } catch {
      setMessage("Không mở được chat hồ sơ");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-4">
        <aside className="w-72 shrink-0 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="mb-4 border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Console</div>
            <div className="mt-1 text-lg font-black text-slate-900">Hệ thống điều hành</div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path || "/admin/dashboard")}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    active
                      ? "bg-(--gov-navy) text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          {message ? (
            <div className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {message}
            </div>
          ) : null}

          {activeTab === "dashboard" ? (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                Tổng quan nhanh hồ sơ và tin nhắn đang chờ xử lý.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Widget title="Hồ sơ mới" value={String(dashboard.totalNew)} colorClass="text-emerald-700" />
                <Widget
                  title="Hồ sơ quá hạn"
                  value={String(dashboard.totalOverdue)}
                  colorClass="text-red-700"
                />
                <Widget title="Tin nhắn đang chờ" value={String(waitingCount)} colorClass="text-amber-700" />
              </div>
            </div>
          ) : null}

          {activeTab === "records" ? (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Quản lý hồ sơ</h1>
              <p className="mt-1 text-sm text-slate-600">
                Tìm kiếm theo mã hồ sơ hoặc số điện thoại người dân.
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nhập mã hồ sơ hoặc số điện thoại..."
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <div className="mt-4 overflow-auto rounded-xl ring-1 ring-slate-200">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Mã hồ sơ</th>
                      <th className="px-3 py-2 text-left font-semibold">Người dân</th>
                      <th className="px-3 py-2 text-left font-semibold">Số điện thoại</th>
                      <th className="px-3 py-2 text-left font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers.map((item) => (
                      <tr key={item.id} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50">
                        <td
                          className="px-3 py-2 font-semibold"
                          onClick={() => setSelectedDossierId(item.id)}
                        >
                          {item.id}
                        </td>
                        <td className="px-3 py-2">{item.citizenName}</td>
                        <td className="px-3 py-2">{item.phone}</td>
                        <td className="px-3 py-2">{viStatus(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dossierDetail ? (
                <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-black text-slate-900">
                      Chi tiết hồ sơ {dossierDetail.id} ({viStatus(dossierDetail.status)})
                    </h2>
                    <button
                      type="button"
                      onClick={openChatFromDossier}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                    >
                      Chat với người dân
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <div className="text-sm font-black text-slate-900">Cột trái: Thông tin E-form</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold">Tên thủ tục:</span> {dossierDetail.procedureName}
                        </div>
                        <div>
                          <span className="font-semibold">Người nộp:</span> {dossierDetail.citizenName}
                        </div>
                        <div>
                          <span className="font-semibold">Thời gian nộp:</span>{" "}
                          {new Date(dossierDetail.submittedAt).toLocaleString("vi-VN")}
                        </div>
                        <div>
                          <span className="font-semibold">CCCD:</span> {dossierDetail.eform?.citizenId}
                        </div>
                        <div>
                          <span className="font-semibold">Email:</span> {dossierDetail.eform?.email}
                        </div>
                        <div>
                          <span className="font-semibold">Địa chỉ:</span> {dossierDetail.eform?.address}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-900">
                          Cột phải: Tệp đính kèm (zoom / xoay)
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold hover:bg-slate-200"
                            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                          >
                            Zoom +
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold hover:bg-slate-200"
                            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                          >
                            Zoom -
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold hover:bg-slate-200"
                            onClick={() => setRotation((r) => r + 90)}
                          >
                            <RotateCw className="inline-block h-3 w-3" /> Xoay
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {(dossierDetail.attachments || []).map((file, idx) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => setPreviewIdx(idx)}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                              idx === previewIdx ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {file.name}
                          </button>
                        ))}
                      </div>
                      {activeAttachment ? (
                        <div className="mt-3 overflow-hidden rounded-xl bg-slate-100 p-2 ring-1 ring-slate-200">
                          <img
                            src={activeAttachment.url}
                            alt={activeAttachment.name}
                            className="mx-auto max-h-80 object-contain transition"
                            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="text-sm font-black text-slate-900">Bước 3: Ra quyết định</div>
                    <textarea
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      placeholder="Nhập nội dung yêu cầu bổ sung / lý do từ chối..."
                      className="mt-3 h-24 w-full rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200 outline-none"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => submitDecision("approve")}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => submitDecision("request_more")}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-60"
                      >
                        Yêu cầu bổ sung
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => submitDecision("reject")}
                        className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "support" ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Trung tâm hỗ trợ (Chat 1v1)</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Tập trung toàn bộ tin nhắn của người dân theo một nơi quản lý.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                  <Bell className="h-4 w-4" />
                  {waitingCount} tin nhắn mới
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-black text-slate-900">Danh sách hội thoại</div>
                    <button
                      type="button"
                      onClick={() => loadDashboard()}
                      className="rounded-lg bg-white p-1.5 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => setActiveConversationId(conv.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left ring-1 ${
                          activeConversationId === conv.id
                            ? "bg-slate-900 text-white ring-slate-900"
                            : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-xs font-bold">{conv.citizenName}</div>
                        <div className="mt-1 text-xs">
                          Hồ sơ: {conv.dossierId} - {conv.status === "waiting" ? "Đang chờ" : "Đã giải quyết"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-8 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  {conversationDetail ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-black text-slate-900">
                          Hội thoại với {conversationDetail.citizenName} ({conversationDetail.dossierId})
                        </div>
                        <button
                          type="button"
                          onClick={markResolved}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                        >
                          Đánh dấu đã giải quyết
                        </button>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-auto rounded-lg bg-white p-3 ring-1 ring-slate-200">
                        {(conversationDetail.messages || []).map((msg) => (
                          <div key={msg.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                            <span className="font-bold">{msg.from === "admin" ? "Admin" : "Người dân"}:</span>{" "}
                            {msg.text}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <div className="mb-2 text-xs font-bold text-slate-600">Mẫu trả lời nhanh</div>
                        <div className="space-y-2">
                        {QUICK_REPLIES.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => sendSupportMessage(q)}
                            className="block w-full rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-100"
                          >
                            {q}
                          </button>
                        ))}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          placeholder="Nhập nội dung tư vấn..."
                          className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => sendSupportMessage(chatText)}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
                        >
                          Gửi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600">
                      Chọn một hội thoại ở cột trái để bắt đầu hỗ trợ trực tiếp.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "ai" ? (
            <div>
              <h1 className="text-2xl font-black text-slate-900">Quản lý Chat AI (Dữ liệu nguồn)</h1>
              <p className="mt-1 text-sm text-slate-600">
                Theo dõi lịch sử trả lời của AI và cập nhật bộ quy tắc khi có luật mới.
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <h2 className="text-base font-black text-slate-900">Lịch sử câu hỏi AI đã trả lời</h2>
                  <div className="mt-3 space-y-3">
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

                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <h2 className="text-base font-black text-slate-900">Bộ quy tắc trả lời AI</h2>
                  <textarea
                    className="mt-3 h-64 w-full rounded-lg bg-white p-3 text-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-(--gov-navy)"
                    value={ruleText}
                    onChange={(e) => setRuleText(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={saveAiRules}
                    className="mt-3 rounded-lg bg-(--gov-navy) px-4 py-2 text-sm font-bold text-white hover:bg-[#19306f]"
                  >
                    Lưu bộ quy tắc mới
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
