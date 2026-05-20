import React, { useMemo, useState } from "react";
import { Camera, Search, X } from "lucide-react";

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function MemberRow({ member, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(member.id)}
      className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
          selected ? "border-[#0d5bd7] bg-[#0d5bd7]" : "border-slate-300 bg-white"
        }`}
      >
        <span className={`h-3 w-3 rounded-full ${selected ? "bg-white" : "bg-transparent"}`} />
      </span>
      <img
        src={member.avatarUrl}
        alt={member.fullName}
        className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[18px] font-bold text-slate-900">{member.fullName}</div>
        <div className="truncate text-sm text-slate-500">{member.phone || member.email || "Bạn bè trong hệ thống"}</div>
      </div>
    </button>
  );
}

export default function GroupCreator({
  showGroupModal,
  setShowGroupModal,
  groupName,
  setGroupName,
  groupAvatar,
  setGroupAvatar,
  groupMemberIds,
  setGroupMemberIds,
  contacts,
  createGroup
}) {
  const [memberQuery, setMemberQuery] = useState("");

  const filteredContacts = useMemo(() => {
    const q = String(memberQuery || "").trim().toLowerCase();
    const sorted = [...(contacts || [])].sort((a, b) =>
      String(a.fullName || "").localeCompare(String(b.fullName || ""), "vi")
    );
    if (!q) return sorted;
    return sorted.filter((item) => {
      const phone = normalizePhone(item.phone);
      return [item.fullName, item.email, item.phone]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(q)) || phone.includes(normalizePhone(q));
    });
  }, [contacts, memberQuery]);

  const recentContacts = useMemo(() => filteredContacts.slice(0, 5), [filteredContacts]);

  const groupedContacts = useMemo(() => {
    return filteredContacts.reduce((acc, item) => {
      const letter = String(item.fullName || "#").charAt(0).toUpperCase() || "#";
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(item);
      return acc;
    }, {});
  }, [filteredContacts]);

  const toggleMember = (memberId) => {
    setGroupMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  if (!showGroupModal) return null;

  return (
    <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(90vh,960px)] w-full max-w-[980px] flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5">
          <div className="text-3xl font-black tracking-tight text-slate-900">Tạo nhóm</div>
          <button
            type="button"
            onClick={() => setShowGroupModal(false)}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-8 w-8" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => {
                const next = window.prompt("Nhập link ảnh đại diện nhóm", groupAvatar || "");
                if (next !== null) setGroupAvatar(next);
              }}
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50"
            >
              {groupAvatar ? (
                <img src={groupAvatar} alt="avatar nhóm" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-10 w-10 text-slate-500" />
              )}
            </button>
            <div className="flex-1 border-b-2 border-[#0d5bd7] pb-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nhập tên nhóm..."
                className="w-full text-[20px] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-7 flex items-center gap-3 rounded-[24px] border border-slate-200 px-5 py-4">
            <Search className="h-6 w-6 text-slate-400" />
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Nhập tên, số điện thoại hoặc email bạn bè"
              className="w-full bg-transparent text-[18px] outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { key: "all", label: "Tất cả" },
              { key: "friends", label: "Bạn bè" },
              { key: "recent", label: "Trò chuyện gần đây" }
            ].map((chip, index) => (
              <span
                key={chip.key}
                className={`rounded-full px-5 py-2 text-base font-semibold ${
                  index === 0 ? "bg-[#0d5bd7] text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-4">
            <div className="mb-4 text-2xl font-black tracking-tight text-slate-900">Trò chuyện gần đây</div>
            <div className="space-y-1">
              {recentContacts.length ? (
                recentContacts.map((member) => (
                  <MemberRow
                    key={`recent-${member.id}`}
                    member={member}
                    selected={groupMemberIds.includes(member.id)}
                    onToggle={toggleMember}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có bạn bè phù hợp để thêm vào nhóm.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            {Object.keys(groupedContacts).map((letter) => (
              <div key={letter} className="mb-5">
                <div className="mb-3 text-2xl font-black tracking-tight text-slate-900">{letter}</div>
                <div className="space-y-1">
                  {groupedContacts[letter].map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      selected={groupMemberIds.includes(member.id)}
                      onToggle={toggleMember}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-200 px-8 py-5">
          <button
            type="button"
            onClick={() => setShowGroupModal(false)}
            className="rounded-2xl bg-slate-100 px-8 py-4 text-[18px] font-bold text-slate-700 hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={createGroup}
            className="rounded-2xl bg-[#9dc5ff] px-8 py-4 text-[18px] font-bold text-white hover:bg-[#7fb4ff] disabled:cursor-not-allowed disabled:bg-[#cfe1ff]"
            disabled={!groupName.trim() || groupMemberIds.length === 0}
          >
            Tạo nhóm
          </button>
        </div>
      </div>
    </div>
  );
}
