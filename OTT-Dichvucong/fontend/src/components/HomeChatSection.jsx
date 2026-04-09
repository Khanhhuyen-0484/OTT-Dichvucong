import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Headset, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, postAiChat, getStaffChat, postStaffChat } from "../lib/api.js";

function Bubble({ from, text, label }) {
  const mine = from === "user" || from === "citizen";
  return (
    <div
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          mine
            ? "bg-[var(--gov-navy)] text-white rounded-br-md"
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
  const [tab, setTab] = useState("ai"); // ai | staff

  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffErr, setStaffErr] = useState(null);

  const [aiMessages, setAiMessages] = useState(() => [
    {
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý AI. Bạn có thể hỏi về thủ tục hành chính, giấy tờ cần chuẩn bị hoặc hướng dẫn tra cứu trên cổng."
    }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState(null);

  const staffEndRef = useRef(null);
  const aiEndRef = useRef(null);

  const scrollStaff = useCallback(() => {
    staffEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  const scrollAi = useCallback(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadStaff = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getStaffChat();
      setStaffMessages(data.messages || []);
      setStaffErr(null);
    } catch (e) {
      setStaffErr(getApiErrorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    scrollStaff();
  }, [staffMessages, scrollStaff]);

  useEffect(() => {
    scrollAi();
  }, [aiMessages, scrollAi]);

  useEffect(() => {
    if (!ready || tab !== "staff" || !user) return;
    loadStaff();
    const id = setInterval(loadStaff, 4000);
    return () => clearInterval(id);
  }, [ready, tab, user, loadStaff]);

  const sendStaff = async (e) => {
    e.preventDefault();
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

  const sendAi = async (e) => {
    e.preventDefault();
    const t = aiInput.trim();
    if (!t || aiLoading) return;
    const nextUser = { role: "user", content: t };
    const history = [...aiMessages, nextUser];
    setAiMessages(history);
    setAiInput("");
    setAiLoading(true);
    setAiErr(null);
    try {
      const { data } = await postAiChat({
        messages: history.map((m) => ({ role: m.role, content: m.content }))
      });
      const reply = data?.reply || "Không có phản hồi.";
      setAiMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setAiErr(getApiErrorMessage(err));
      setAiMessages((prev) => prev.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section
      id="chat"
      className="scroll-mt-24 border-y border-slate-200 bg-gradient-to-b from-slate-50 to-white"
      aria-labelledby="chat-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2
              id="chat-heading"
              className="text-xl font-black text-slate-900 tracking-tight"
            >
              Hỗ trợ trực tuyến
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-prose">
              Chat một-một với cán bộ (cần đăng nhập) hoặc hỏi trợ lý AI về thủ
              tục hành chính.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setTab("staff")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
                tab === "staff"
                  ? "bg-[var(--gov-navy)] text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Headset className="h-4 w-4 shrink-0" aria-hidden />
              Chat cán bộ
            </button>
            <button
              type="button"
              onClick={() => setTab("ai")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition ${
                tab === "ai"
                  ? "bg-[var(--gov-navy)] text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" aria-hidden />
              Trợ lý AI
            </button>
          </div>

          <div className="p-4 sm:p-5">
            {tab === "staff" ? (
              <div>
                {!ready ? (
                  <p className="text-sm text-slate-600">Đang tải…</p>
                ) : !user ? (
                  <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm text-slate-700">
                    Vui lòng{" "}
                    <Link
                      to="/auth"
                      className="font-bold text-[var(--gov-navy)] underline"
                    >
                      đăng nhập
                    </Link>{" "}
                    để trao đổi với cán bộ.
                  </div>
                ) : (
                  <>
                    {staffErr && (
                      <p className="mb-3 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-lg px-3 py-2">
                        {staffErr}
                      </p>
                    )}
                    <div
                      className="h-[min(52vh,420px)] overflow-y-auto space-y-3 pr-1 mb-3"
                      role="log"
                      aria-live="polite"
                    >
                      {staffMessages.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">
                          Chưa có tin nhắn. Gửi nội dung cần hỗ trợ (mã hồ sơ, tên
                          thủ tục…).
                        </p>
                      ) : (
                        staffMessages.map((m, i) => (
                          <Bubble
                            key={`${m.at}-${i}`}
                            from={m.from === "citizen" ? "citizen" : "staff"}
                            text={m.text}
                            label={
                              m.from === "citizen"
                                ? "Bạn"
                                : "Cán bộ"
                            }
                          />
                        ))
                      )}
                      <div ref={staffEndRef} />
                    </div>
                    <form onSubmit={sendStaff} className="flex gap-2">
                      <label className="sr-only" htmlFor="staff-chat-input">
                        Nội dung gửi cán bộ
                      </label>
                      <input
                        id="staff-chat-input"
                        value={staffInput}
                        onChange={(e) => setStaffInput(e.target.value)}
                        placeholder="Nhập tin nhắn…"
                        className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)]"
                        disabled={staffLoading}
                        maxLength={2000}
                      />
                      <button
                        type="submit"
                        disabled={staffLoading || !staffInput.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--gov-navy)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#19306f] disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" aria-hidden />
                        Gửi
                      </button>
                    </form>
                    <p className="mt-2 text-xs text-slate-500">
                      Demo: hệ thống tự gửi phản hồi mẫu sau vài giây. Triển khai
                      thực tế cần hàng đợi cán bộ / WebSocket.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div>
                {aiErr && (
                  <p className="mb-3 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-lg px-3 py-2">
                    {aiErr}
                  </p>
                )}
                <div
                  className="h-[min(52vh,420px)] overflow-y-auto space-y-3 pr-1 mb-3"
                  role="log"
                >
                  {aiMessages.map((m, i) => (
                    <Bubble
                      key={i}
                      from={m.role === "user" ? "user" : "assistant"}
                      text={m.content}
                      label={m.role === "user" ? "Bạn" : "Trợ lý AI"}
                    />
                  ))}
                  {aiLoading && (
                    <div className="text-xs text-slate-500 pl-1">Đang trả lời…</div>
                  )}
                  <div ref={aiEndRef} />
                </div>
                <form onSubmit={sendAi} className="flex gap-2">
                  <label className="sr-only" htmlFor="ai-chat-input">
                    Câu hỏi cho trợ lý AI
                  </label>
                  <input
                    id="ai-chat-input"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Hỏi về thủ tục, giấy tờ, thời gian làm việc…"
                    className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)]"
                    disabled={aiLoading}
                    maxLength={4000}
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !aiInput.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Gửi
                  </button>
                </form>
                <p className="mt-2 text-xs text-slate-500">
                  Trợ lý AI có thể sai sót; vui lòng đối chiếu quy định tại cơ
                  quan có thẩm quyền. Có thể bật OpenAI bằng biến{" "}
                  <code className="text-slate-700">OPENAI_API_KEY</code> trên
                  server.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
