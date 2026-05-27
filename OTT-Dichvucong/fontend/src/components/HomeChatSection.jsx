import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, X, MessageCircle } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";
import Bubble from "./Bubble.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage, postAiChat } from "../lib/api.js";

export default function HomeChatSection() {
  const { user, ready } = useAuth();
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [typing, setTyping] = useState(false);

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

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages.length, unifiedOpen, scrollToBottom]);

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

          <div className="p-4 bg-[#003366] text-white">
            <div className="flex items-center gap-3">
              <UserAvatar user={{ fullName: "AI" }} size={40} />
              <div>
                <h3 className="font-bold text-sm">Hỗ trợ trực tuyến</h3>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AI hỗ trợ</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            {aiErr && (
              <div className="text-[10px] text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                {aiErr}
              </div>
            )}

            {aiMessages.map((m, i) => (
              <Bubble
                key={i}
                from={m.role}
                text={m.content}
                isMine={m.role === "user"}
                label={m.role === "user" ? myName : "AI"}
              />
            ))}

            {typing && (
              <div className="text-[10px] text-slate-400 animate-pulse">AI đang trả lời...</div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendAi} className="p-3 border-t bg-slate-50">
            <div className="flex gap-2">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Hỏi trợ lý AI..."
                disabled={aiLoading}
                className="flex-1 text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#003366]"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiInput.trim()}
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