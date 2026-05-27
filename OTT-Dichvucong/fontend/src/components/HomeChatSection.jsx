import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import { getApiErrorMessage, postAiAssistantChat } from "../lib/api.js";

const AI_STORAGE_KEY = "gov-ai-chat-history-v3";
const UI_STORAGE_KEY = "gov-chat-panel-open-v3";
const AI_ASSISTANT_ID = "AI_ASSISTANT";
const AI_SUGGESTIONS = [
  "Tôi cần chuẩn bị giấy tờ gì để đăng ký tạm trú?",
  "Hồ sơ của tôi đang ở đâu?",
  "Thanh toán lệ phí như thế nào?",
  "Tôi muốn gặp cán bộ hỗ trợ",
];
const STAFF_CONFIRM_SUGGESTIONS = ["Chuyển tới chat cán bộ", "Ở lại chat AI"];

function normalizeIntentText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function isStaffIntent(text) {
  const value = normalizeIntentText(text);
  return /(gap|chat|noi chuyen|lien he).*(can bo|ho tro|nhan vien|tu van)|can bo ho tro/.test(value);
}

function isTransferToStaff(text) {
  const value = normalizeIntentText(text);
  return /^chuyen toi chat can bo$|(?:chuyen|dua|sang|mo).*(?:chat )?(can bo|ho tro)|\btoi (?:trang|phan|chat)\b.*(can bo|ho tro)/.test(value);
}

function isStayWithAi(text) {
  const value = normalizeIntentText(text);
  return /^(o lai|khong|thoi|tiep tuc).*(ai|tro ly)?|^o lai chat ai$/.test(value);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createAiGreeting() {
  return {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "Xin chào, tôi là Trợ lý AI dịch vụ công. Bạn có thể hỏi về thủ tục, hồ sơ cần chuẩn bị, thanh toán, trạng thái hồ sơ hoặc cách sử dụng hệ thống.",
    createdAt: new Date().toISOString(),
    suggestions: [
      "Cần giấy tờ gì?",
      "Các bước thực hiện?",
      "Nộp ở đâu?",
      "Có lưu ý gì?",
    ],
  };
}

function readSavedAiMessages() {
  if (typeof window === "undefined") return [createAiGreeting()];

  try {
    const raw = window.localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return [createAiGreeting()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [createAiGreeting()];
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

function ChatBubble({ title, text, time, mine }) {
  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? (
        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div className={`flex w-full max-w-[94%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-[20px] px-3.5 py-3 shadow-sm ${
            mine
              ? "rounded-br-md bg-[#003366] text-sm leading-relaxed text-white"
              : "rounded-bl-md bg-white text-[15px] leading-[1.65] text-slate-800 ring-1 ring-emerald-100"
          }`}
        >
          <div className={`mb-1.5 text-[10px] font-bold uppercase ${mine ? "text-white/70" : "text-slate-400"}`}>
            {title}
          </div>
          <div className="whitespace-pre-wrap break-words">{text}</div>
        </div>
        <div className="mt-1 px-1 text-[11px] text-slate-400">{time}</div>
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(UI_STORAGE_KEY) === "1";
  });
  const [aiMessages, setAiMessages] = useState(readSavedAiMessages);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState(null);
  const chatEndRef = useRef(null);

  const supportAgent = { fullName: "Trợ lý AI", status: "AI 24/7" };

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(UI_STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiMessages));
  }, [aiMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages.length, open, aiLoading, scrollToBottom]);

  const sendAi = async (text) => {
    const trimmed = String(text ?? aiInput).trim();
    if (!trimmed || aiLoading) return;

    if (isTransferToStaff(trimmed)) {
      setOpen(false);
      navigate("/chat?tab=staff");
      return;
    }

    const nextUser = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const history = [...aiMessages, nextUser];
    setAiMessages(history);
    setAiInput("");
    if (isStayWithAi(trimmed)) {
      setAiMessages([
        ...history,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Được, tôi sẽ tiếp tục hỗ trợ bạn tại đây. Bạn cần hỏi thêm về thủ tục, hồ sơ, thanh toán hay trạng thái hồ sơ?",
          createdAt: new Date().toISOString(),
          suggestions: AI_SUGGESTIONS.slice(0, 3),
        },
      ]);
      setAiErr(null);
      return;
    }

    if (isStaffIntent(trimmed)) {
      setAiMessages([
        ...history,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Bạn muốn tôi đưa bạn tới trang chat với cán bộ hỗ trợ, hoặc bạn cũng có thể vào phần Hỗ trợ trực tuyến để nhắn trực tiếp với cán bộ.",
          createdAt: new Date().toISOString(),
          suggestions: STAFF_CONFIRM_SUGGESTIONS,
        },
      ]);
      setAiErr(null);
      return;
    }

    setAiLoading(true);
    setAiErr(null);

    try {
      const { data } = await postAiAssistantChat({
        message: trimmed,
        chatType: "AI",
        receiverId: AI_ASSISTANT_ID,
        messages: history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      const reply = data?.reply || data?.message?.text || "Trợ lý AI hiện đang bận, vui lòng thử lại sau.";
      const suggestions =
        data?.action === "OPEN_STAFF_CHAT" || data?.message?.meta?.action === "OPEN_STAFF_CHAT"
          ? STAFF_CONFIRM_SUGGESTIONS
          : Array.isArray(data?.suggestions)
            ? data.suggestions
            : [];
      setAiMessages((prev) => [
        ...prev,
        {
          id: data?.message?.id || `assistant-${Date.now()}`,
          role: "assistant",
          content:
            data?.action === "OPEN_STAFF_CHAT" || data?.message?.meta?.action === "OPEN_STAFF_CHAT"
              ? "Bạn muốn tôi đưa bạn tới trang chat với cán bộ hỗ trợ, hoặc bạn cũng có thể vào phần Hỗ trợ trực tuyến để nhắn trực tiếp với cán bộ."
              : reply,
          createdAt: data?.message?.createdAt || new Date().toISOString(),
          suggestions,
        },
      ]);
    } catch (error) {
      setAiErr(getApiErrorMessage(error) || "Trợ lý AI hiện đang bận, vui lòng thử lại sau.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#003366] to-[#0b4b86] text-white shadow-2xl transition hover:scale-[1.02] hover:shadow-[0_22px_50px_rgba(0,51,102,0.35)]"
        aria-label={open ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open ? (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(640px,85vh)] max-h-[85vh] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f4f7fb] shadow-[0_28px_70px_rgba(15,23,42,0.28)]">
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#003366] via-[#0a4a86] to-[#0e5f97] px-4 pb-4 pt-3.5 text-white">
            <div className="relative flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={supportAgent} size={42} className="shrink-0 ring-2 ring-white/20" />
                <div className="min-w-0">
                  <div className="text-sm font-black leading-snug">Trợ lý AI dịch vụ công</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      AI 24/7
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">Sẵn sàng hỗ trợ</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white/10 p-2 text-white/90 transition hover:bg-white/20"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
            <div className="rounded-xl bg-slate-100 p-1">
              <div className="rounded-lg bg-white px-2 py-1.5 text-center text-sm font-bold text-[#003366] shadow-sm">
                Trợ lý AI
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(14,95,151,0.08),_transparent_38%),linear-gradient(180deg,#f8fbff_0%,#f3f6fb_100%)] px-3 py-3">
            {aiErr ? (
              <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {aiErr}
              </div>
            ) : null}

            <div className="space-y-3">
              {aiMessages.map((message) => {
                const showSuggestions = message.role === "assistant" && !aiLoading;
                return (
                  <div key={message.id || `${message.role}-${message.createdAt}`}>
                    <ChatBubble
                      title={message.role === "assistant" ? "Trợ lý AI" : "Bạn"}
                      text={message.content}
                      time={formatTime(message.createdAt)}
                      mine={message.role === "user"}
                    />
                    {showSuggestions ? (
                      <div className="ml-10">
                        <SuggestionChips items={message.suggestions} onPick={sendAi} disabled={aiLoading} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {aiLoading ? (
              <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-slate-400">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
                </span>
                AI đang trả lời...
              </div>
            ) : null}

            <div ref={chatEndRef} />
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-2.5 py-2">
            <div
              className="ai-suggestion-scroll mb-1.5 overflow-x-auto overflow-y-hidden pb-1.5 scroll-smooth"
              role="region"
              aria-label="Câu hỏi gợi ý"
            >
              <div className="flex w-max gap-2 pr-1">
                {AI_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => sendAi(item)}
                    disabled={aiLoading}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-[#003366] hover:ring-[#003366]/25 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1">
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
                disabled={aiLoading}
                placeholder="Nhập câu hỏi..."
                className="max-h-20 min-h-[32px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-snug text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                disabled={aiLoading || !aiInput.trim()}
                onClick={() => sendAi()}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#003366] text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
