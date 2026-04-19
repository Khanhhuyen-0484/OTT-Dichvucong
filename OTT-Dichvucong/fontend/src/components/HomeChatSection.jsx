import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, X, MessageCircle } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, postAiChat, getStaffChat, postStaffChat } from "../lib/api.js";

// ── FIX 1: Bubble — xác định đúng "mine" dựa vào from + userId người dùng hiện tại ──
function Bubble({ from, text, label, isMine }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isMine
            ? "bg-[#003366] text-white rounded-br-md"
            : from === "assistant"
            ? "bg-emerald-50 text-slate-800 ring-1 ring-emerald-100 rounded-bl-md"
            : "bg-slate-100 text-slate-900 ring-1 ring-slate-200 rounded-bl-md"
        }`}
      >
        {label && (
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">
            {label}
          </div>
        )}
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}

export default function HomeChatSection() {
  const { user, ready } = useAuth();
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [tabState, setTabState] = useState("ai");
  const [typing, setTyping] = useState(false);

  // ── FIX 2: staffAgent lấy từ conversation thật, không hardcode ──
  // Tên admin/cán bộ sẽ được lấy từ tin nhắn đầu tiên có from === "admin"
  const [staffAgentName, setStaffAgentName] = useState("Cán bộ hỗ trợ");
  const [staffAgentAvatar, setStaffAgentAvatar] = useState(null);

  // State cho Staff
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffErr, setStaffErr] = useState(null);

  // State cho AI
  const [aiMessages, setAiMessages] = useState([
    {
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý ảo. Bạn cần hỗ trợ thủ tục gì? Chọn tab Cán bộ nếu cần chat trực tiếp."
    }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState(null);

  const chatEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadStaff = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getStaffChat();
      const messages = data.messages || [];
      setStaffMessages(messages);
      setStaffErr(null);

      // ── FIX 2: Lấy tên + avatar admin từ tin nhắn admin đầu tiên trong conversation ──
      const firstAdminMsg = messages.find(
        (m) => m.from === "admin" || m.from === "staff"
      );
      if (firstAdminMsg?.sender?.fullName) {
        setStaffAgentName(firstAdminMsg.sender.fullName);
      }
      if (firstAdminMsg?.sender?.avatarUrl) {
        setStaffAgentAvatar(firstAdminMsg.sender.avatarUrl);
      }
    } catch (e) {
      setStaffErr(getApiErrorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [tabState, aiMessages.length, staffMessages.length, unifiedOpen, scrollToBottom]);

  useEffect(() => {
    if (!ready || !user) return;
    loadStaff();
    const id = setInterval(loadStaff, 4000);
    return () => clearInterval(id);
  }, [ready, user, loadStaff]);

  const sendAi = async (e) => {
    if (e) e.preventDefault();
    const t = aiInput.trim();
    if (!t || aiLoading) return;

    const nextUser = { role: "user", content: t };
    const history = [...aiMessages, nextUser];
    setAiMessages(history);
    setAiInput("");
    setAiLoading(true);
    setTyping(true);
    setAiErr(null);

    try {
      const { data } = await postAiChat({
        messages: history.map((m) => ({ role: m.role, content: m.content }))
      });
      const reply = data?.reply || "Không có phản hồi từ máy chủ.";
      setAiMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setAiErr(getApiErrorMessage(err));
    } finally {
      setTyping(false);
      setAiLoading(false);
    }
  };

  const sendStaff = async (e) => {
    if (e) e.preventDefault();
    const t = staffInput.trim();
    if (!t || staffLoading || !user) return;

    setStaffLoading(true);
    setStaffErr(null);
    try {
      const { data } = await postStaffChat(t);
      setStaffMessages(data.messages || []);
      setStaffInput("");
    } catch (err) {
      setStaffErr(getApiErrorMessage(err));
    } finally {
      setStaffLoading(false);
    }
  };

  const isAi = tabState === "ai";
  const currentInput = isAi ? aiInput : staffInput;
  const setCurrentInput = isAi ? setAiInput : setStaffInput;
  const currentSend = isAi ? sendAi : sendStaff;
  const currentLoading = isAi ? aiLoading : staffLoading;
  const currentErr = isAi ? aiErr : staffErr;
  const currentPlaceholder = isAi ? "Hỏi trợ lý AI..." : "Nhắn tin cho cán bộ...";

  // Tên người dùng hiện tại (người dân đang đăng nhập)
  const myName = user?.fullName || "Bạn";

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setUnifiedOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-[#003366] shadow-xl hover:shadow-2xl active:scale-95 transition-all duration-200 text-white flex items-center justify-center"
      >
        {unifiedOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {unifiedOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 max-h-[70vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5">

          {/* ── FIX 2: Header hiển thị tên Cán bộ/Admin, không phải người dân ── */}
          <div className="p-4 bg-[#003366] text-white">
            <div className="flex items-center gap-3">
              {staffAgentAvatar ? (
                <img
                  src={staffAgentAvatar}
                  alt={staffAgentName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30"
                />
              ) : (
                <UserAvatar user={{ fullName: staffAgentName }} size={40} />
              )}
              <div>
                <h3 className="font-bold text-sm">{staffAgentName}</h3>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Cán bộ đang trực</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex p-2 bg-slate-100 gap-1">
            <button
              onClick={() => setTabState("ai")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isAi ? "bg-white shadow text-[#003366]" : "text-slate-500"
              }`}
            >
              🤖 Trợ lý AI
            </button>
            <button
              onClick={() => setTabState("staff")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !isAi ? "bg-white shadow text-[#003366]" : "text-slate-500"
              }`}
            >
              👤 Cán bộ
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            {currentErr && (
              <div className="text-[10px] text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                {currentErr}
              </div>
            )}

            {isAi ? (
              aiMessages.map((m, i) => (
                <Bubble
                  key={i}
                  from={m.role}
                  text={m.content}
                  isMine={m.role === "user"}
                  // ── FIX 1: nhãn dùng tên người dùng thật thay vì "Bạn" cứng ──
                  label={m.role === "user" ? myName : "AI"}
                />
              ))
            ) : staffMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Hãy để lại tin nhắn, cán bộ sẽ phản hồi bạn sớm nhất.
              </div>
            ) : (
              staffMessages.map((m, i) => {
                // ── FIX 1: xác định đúng "mine" — tin của người dân đang đăng nhập ──
                const isMine = m.from === "user" || m.from === "citizen";

                // Nhãn: nếu là tin của mình thì dùng tên thật, ngược lại dùng tên admin
                const adminName =
                  m.sender?.fullName && m.from !== "user" && m.from !== "citizen"
                    ? m.sender.fullName
                    : staffAgentName;
                const label = isMine ? myName : adminName;

                return (
                  <Bubble
                    key={i}
                    from={m.from}
                    text={m.text}
                    isMine={isMine}
                    label={label}
                  />
                );
              })
            )}

            {typing && isAi && (
              <div className="text-[10px] text-slate-400 animate-pulse">AI đang trả lời...</div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={currentSend} className="p-3 border-t bg-slate-50">
            <div className="flex gap-2">
              <input
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder={currentPlaceholder}
                disabled={currentLoading}
                className="flex-1 text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#003366]"
              />
              <button
                type="submit"
                disabled={currentLoading || !currentInput.trim()}
                className="bg-[#003366] text-white p-2.5 rounded-xl disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}