import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronRight,
  MessageCircle,
  Send,
  UserRound,
  X
} from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, getStaffChat, postAiChat, postStaffChat } from "../lib/api.js";

const AI_STORAGE_KEY = "gov-ai-chat-history-v2";
const AI_SESSION_KEY = "gov-ai-chat-session-v2";
const UI_STORAGE_KEY = "gov-chat-panel-open-v2";
function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function createAiGreeting() {
  return {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "Xin chào, mình là trợ lý AI của Cổng Dịch vụ công. Bạn cứ hỏi tên thủ tục, giấy tờ cần chuẩn bị hoặc tình huống đang vướng, mình sẽ hướng dẫn theo từng bước.",
    createdAt: new Date().toISOString(),
    suggestions: [
      "Đăng ký khai sinh cần gì?",
      "Tạm trú nộp ở đâu?",
      "Đổi GPLX online thế nào?",
      "CCCD cần chuẩn bị giấy tờ gì?"
    ]
  };
}

function readSavedAiMessages() {
  if (typeof window === "undefined") {
    return [createAiGreeting()];
  }

  try {
    const raw = window.localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return [createAiGreeting()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createAiGreeting()];
    }
    return parsed.filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    );
  } catch {
    return [createAiGreeting()];
  }
}

function getOrCreateAiSessionId() {
  if (typeof window === "undefined") {
    return `guest-${Date.now()}`;
  }
  const existing = window.localStorage.getItem(AI_SESSION_KEY);
  if (existing) return existing;
  const created = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(AI_SESSION_KEY, created);
  return created;
}

function ChatBubble({ type, title, text, time, mine }) {
  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? (
        <div
          className={`flex size-8 items-center justify-center rounded-full ${
            type === "ai" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
          }`}
        >
          {type === "ai" ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
        </div>
      ) : null}

      <div className={`flex max-w-[85%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-sm ${
            mine
              ? "rounded-br-md bg-[#003366] text-white"
              : type === "ai"
                ? "rounded-bl-md bg-white text-slate-800 ring-1 ring-emerald-100"
                : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200"
          }`}
        >
          <div
            className={`mb-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
              mine ? "text-white/70" : "text-slate-400"
            }`}
          >
            {title}
          </div>
          <div className="whitespace-pre-wrap">{text}</div>
        </div>
        <div className={`mt-1 px-1 text-[11px] ${mine ? "text-right text-slate-400" : "text-slate-400"}`}>
          {time}
        </div>
      </div>
    </div>
  );
}

function SuggestionChips({ items, onPick, disabled }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled}
          onClick={() => onPick(item)}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#003366] ring-1 ring-[#003366]/15 transition hover:bg-slate-50 hover:ring-[#003366]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export default function HomeChatSection() {
  const { user, ready } = useAuth();
  const [unifiedOpen, setUnifiedOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(UI_STORAGE_KEY) === "1";
  });
  const [tabState, setTabState] = useState("ai");
  const [typing, setTyping] = useState(false);
  const [aiMode, setAiMode] = useState("fallback");
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffErr, setStaffErr] = useState(null);
  const [aiMessages, setAiMessages] = useState(readSavedAiMessages);
  const [aiSessionId, setAiSessionId] = useState(getOrCreateAiSessionId);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState(null);

  const supportAgent = { fullName: "Trung tâm hỗ trợ công dân", status: "Trực tuyến" };
  const chatEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadStaff = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getStaffChat();
      setStaffMessages(data.messages || []);
      setStaffErr(null);
    } catch (error) {
      setStaffErr(getApiErrorMessage(error));
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(UI_STORAGE_KEY, unifiedOpen ? "1" : "0");
  }, [unifiedOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiMessages));
  }, [aiMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages.length, staffMessages.length, tabState, unifiedOpen, typing, scrollToBottom]);

  useEffect(() => {
    if (!ready || !user) return;
    loadStaff();
    const intervalId = setInterval(loadStaff, 5000);
    return () => clearInterval(intervalId);
  }, [ready, user, loadStaff]);

  const sendAi = async (text) => {
    const trimmed = String(text ?? aiInput).trim();
    if (!trimmed || aiLoading) return;

    const nextUser = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };
    const history = [...aiMessages, nextUser];
    setAiMessages(history);
    setAiInput("");
    setAiLoading(true);
    setTyping(true);
    setAiErr(null);

    try {
      const { data } = await postAiChat({
        sessionId: aiSessionId,
        messages: history.map((message) => ({
          role: message.role,
          content: message.content
        }))
      });
      setAiMode(data?.mode || "fallback");
      if (data?.sessionId) {
        setAiSessionId(data.sessionId);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(AI_SESSION_KEY, data.sessionId);
        }
      }
      setAiMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data?.reply || "Không có phản hồi từ máy chủ.",
          createdAt: new Date().toISOString(),
          suggestions: Array.isArray(data?.suggestions) ? data.suggestions : []
        }
      ]);
    } catch (error) {
      setAiErr(getApiErrorMessage(error));
    } finally {
      setTyping(false);
      setAiLoading(false);
    }
  };

  const sendStaff = async () => {
    const trimmed = staffInput.trim();
    if (!trimmed || staffLoading || !user) return;

    setStaffLoading(true);
    setStaffErr(null);
    try {
      const { data } = await postStaffChat(trimmed);
      setStaffMessages(data.messages || []);
      setStaffInput("");
    } catch (error) {
      setStaffErr(getApiErrorMessage(error));
    } finally {
      setStaffLoading(false);
    }
  };

  const currentError = tabState === "ai" ? aiErr : staffErr;
  const currentLoading = tabState === "ai" ? aiLoading : staffLoading;
  const resetAiConversation = () => {
    const nextSession = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAiSessionId(nextSession);
    setAiMessages([createAiGreeting()]);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AI_SESSION_KEY, nextSession);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setUnifiedOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#003366] to-[#0b4b86] text-white shadow-2xl transition hover:scale-[1.02] hover:shadow-[0_22px_50px_rgba(0,51,102,0.35)]"
      >
        {unifiedOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {unifiedOpen ? (
        <div className="fixed bottom-24 right-4 z-50 flex max-h-[78vh] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f4f7fb] shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
          <div className="relative overflow-hidden bg-gradient-to-r from-[#003366] via-[#0a4a86] to-[#0e5f97] px-4 pb-4 pt-4 text-white">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={supportAgent} size={42} className="ring-2 ring-white/20" />
                <div>
                  <div className="text-sm font-black">Trung tâm hỗ trợ dịch vụ công</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/80">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {tabState === "ai" ? "AI 24/7" : "Cán bộ tiếp nhận"}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                      {tabState === "ai" && aiMode === "openai" ? "AI nâng cao" : "Sẵn sàng hỗ trợ"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnifiedOpen(false)}
                className="rounded-full bg-white/10 p-2 text-white/90 transition hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-white px-3 py-2">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTabState("ai")}
                className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                  tabState === "ai" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500"
                }`}
              >
                Trợ lý AI
              </button>
              <button
                type="button"
                onClick={() => setTabState("staff")}
                className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                  tabState === "staff" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500"
                }`}
              >
                Chat cán bộ
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(14,95,151,0.08),_transparent_38%),linear-gradient(180deg,#f8fbff_0%,#f3f6fb_100%)] px-3 py-4">
            {currentError ? (
              <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {currentError}
              </div>
            ) : null}

            {tabState === "ai" ? (
              <>
                <div className="space-y-3">
                  {aiMessages.map((message) => {
                    const showSuggestions = message.role === "assistant" && !typing;
                    return (
                      <div key={message.id || `${message.role}-${message.createdAt}`}>
                        <ChatBubble
                          type={message.role === "assistant" ? "ai" : "user"}
                          title={message.role === "assistant" ? "Trợ lý AI" : "Bạn"}
                          text={message.content}
                          time={formatTime(message.createdAt)}
                          mine={message.role === "user"}
                        />
                        {showSuggestions ? (
                          <div className="ml-10">
                            <SuggestionChips
                              items={message.suggestions}
                              onPick={sendAi}
                              disabled={aiLoading}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : staffMessages.length ? (
              <div className="space-y-3">
                {staffMessages.map((message) => (
                  <ChatBubble
                    key={message.id || `${message.from}-${message.createdAt || message.at}`}
                    type={message.from === "admin" ? "staff" : "user"}
                    title={message.from === "admin" ? "Cán bộ hỗ trợ" : "Bạn"}
                    text={message.text}
                    time={formatTime(message.createdAt || message.at)}
                    mine={message.from !== "admin"}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="text-sm font-bold text-slate-700">Chưa có hội thoại với cán bộ</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">
                  Hãy để lại nội dung cần hỗ trợ. Cán bộ sẽ tiếp nhận và phản hồi trong khung giờ làm việc.
                </div>
              </div>
            )}

            {typing && tabState === "ai" ? (
              <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-slate-400">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
                </span>
                AI đang soạn phản hồi
              </div>
            ) : null}

            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-white px-3 py-3">
            {tabState === "ai" ? (
              <>
                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Hỏi thủ tục, hồ sơ, giấy tờ hoặc quy trình nộp online</span>
                  <button
                    type="button"
                    onClick={resetAiConversation}
                    className="font-semibold text-[#003366]"
                  >
                    Làm mới
                  </button>
                </div>
                <div className="flex items-end gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
                  <textarea
                    rows={1}
                    value={aiInput}
                    onChange={(event) => setAiInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendAi();
                      }
                    }}
                    disabled={currentLoading}
                    placeholder="Nhập câu hỏi cho trợ lý AI..."
                    className="max-h-28 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={currentLoading || !aiInput.trim()}
                    onClick={() => sendAi()}
                    className="flex size-11 items-center justify-center rounded-full bg-[#003366] text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                    Ưu tiên trường hợp cần xử lý hồ sơ thật
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span>Phản hồi trong giờ hành chính</span>
                </div>
                <div className="flex items-end gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2">
                  <textarea
                    rows={1}
                    value={staffInput}
                    onChange={(event) => setStaffInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendStaff();
                      }
                    }}
                    disabled={currentLoading || !user}
                    placeholder={user ? "Nhập nội dung cần cán bộ hỗ trợ..." : "Đăng nhập để chat với cán bộ"}
                    className="max-h-28 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={currentLoading || !staffInput.trim() || !user}
                    onClick={sendStaff}
                    className="flex size-11 items-center justify-center rounded-full bg-[#003366] text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
