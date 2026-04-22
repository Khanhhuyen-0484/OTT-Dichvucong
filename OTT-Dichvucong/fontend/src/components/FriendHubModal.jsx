import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  BadgePlus,
  Ban,
  ChevronDown,
  ContactRound,
  Eye,
  Filter,
  MoreHorizontal,
  Search,
  Trash2,
  UserPlus,
  UserRoundPlus,
  Users,
  X
} from "lucide-react";

const MENU_ITEMS = [
  { id: "friends", label: "Danh sách bạn bè", icon: ContactRound },
  { id: "groups", label: "Danh sách nhóm và cộng đồng", icon: Users },
  { id: "requests", label: "Lời mời kết bạn", icon: UserRoundPlus },
  { id: "groupInvites", label: "Lời mời vào nhóm và cộng đồng", icon: BadgePlus }
];

function Avatar({ item, size = "h-14 w-14" }) {
  return (
    <img
      src={item.avatarUrl}
      alt={item.fullName || item.name}
      className={`${size} rounded-full object-cover ring-1 ring-slate-200`}
    />
  );
}

function EmptyPanel({ title, description }) {
  return (
    <div className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="text-2xl font-black tracking-tight text-slate-900">{title}</div>
      <div className="mt-3 text-sm text-slate-500">{description}</div>
    </div>
  );
}

function RequestCard({ item, type, loading, onAccept, onDecline, onRevoke }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-black tracking-tight text-slate-900">{item.fullName}</div>
          <div className="mt-1 truncate text-sm text-slate-500">{item.phone || item.email || "Người dùng hệ thống"}</div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700">
        {type === "incoming"
          ? `Xin chào, ${item.fullName} muốn kết bạn và trao đổi cùng bạn.`
          : `Bạn đã gửi lời mời kết bạn tới ${item.fullName}.`}
      </div>
      {type === "incoming" ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => onDecline(item.id)}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-lg font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            Từ chối
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onAccept(item.id)}
            className="rounded-2xl bg-[#dceaff] px-4 py-3 text-lg font-bold text-[#0d5bd7] hover:bg-[#cfe1ff] disabled:opacity-60"
          >
            Đồng ý
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => onRevoke(item.id)}
          className="mt-4 w-full rounded-2xl bg-slate-100 px-4 py-3 text-center text-base font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          Thu hồi lời mời
        </button>
      )}
    </div>
  );
}

function SuggestionCard({ item, loading, onAdd, onDismiss }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-black tracking-tight text-slate-900">{item.fullName}</div>
          <div className="mt-1 truncate text-sm text-slate-500">
            {item.phone || item.email || "Tài khoản đang hoạt động trên hệ thống"}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700">
        Gợi ý kết bạn dành cho bạn để bắt đầu trò chuyện nhanh hơn.
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => onDismiss(item.id)}
          className="rounded-2xl bg-slate-100 px-4 py-3 text-lg font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          Bỏ qua
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onAdd(item.id)}
          className="rounded-2xl bg-[#dceaff] px-4 py-3 text-lg font-bold text-[#0d5bd7] hover:bg-[#cfe1ff] disabled:opacity-60"
        >
          Kết bạn
        </button>
      </div>
    </div>
  );
}

function FriendMenu({ onView, onRemove, onBlock, loading }) {
  return (
    <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.15)]">
      <button
        type="button"
        onClick={onView}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Eye className="h-4 w-4" />
        Xem hồ sơ
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={onRemove}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
        Xóa bạn
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={onBlock}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
      >
        <Ban className="h-4 w-4" />
        Chặn
      </button>
    </div>
  );
}

function ProfileModal({ item, onClose, onOpenChat }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 p-4">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between">
          <div className="text-2xl font-black tracking-tight text-slate-900">Hồ sơ bạn bè</div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <Avatar item={item} size="h-20 w-20" />
          <div className="min-w-0">
            <div className="truncate text-2xl font-black tracking-tight text-slate-900">{item.fullName}</div>
            <div className="mt-1 text-sm text-slate-500">{item.phone || "Chưa cập nhật số điện thoại"}</div>
            <div className="text-sm text-slate-500">{item.email || "Chưa cập nhật email"}</div>
          </div>
        </div>
        <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <div>Vai trò: Công dân / người dùng hệ thống</div>
          <div>Kênh liên hệ ưu tiên: {item.phone ? "Số điện thoại" : item.email ? "Email" : "Chưa có"}</div>
        </div>
        <button
          type="button"
          onClick={() => onOpenChat(item.id)}
          className="mt-6 w-full rounded-2xl bg-[#0d5bd7] px-4 py-3 text-base font-bold text-white hover:bg-[#0a4db8]"
        >
          Nhắn tin
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, description, confirmLabel, tone = "danger", loading, onClose, onConfirm }) {
  if (!open) return null;
  const toneClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-[#0d5bd7] hover:bg-[#0a4db8]";
  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="text-2xl font-black tracking-tight text-slate-900">{title}</div>
        <div className="mt-3 text-sm text-slate-500">{description}</div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-5 py-3 font-bold text-slate-700">
            Hủy
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-2xl px-5 py-3 font-bold text-white disabled:opacity-60 ${toneClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockedFriendsModal({ open, users, loading, onClose, onUnblock }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 p-4">
      <div className="flex h-[min(80vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-3xl font-black tracking-tight text-slate-900">Danh sách đã chặn</div>
            <div className="mt-1 text-sm text-slate-500">Quản lý những người dùng bạn không muốn nhận liên hệ.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {users.length ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4">
                  <Avatar item={user} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold text-slate-900">{user.fullName}</div>
                    <div className="truncate text-sm text-slate-500">{user.phone || user.email || "Người dùng hệ thống"}</div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onUnblock(user.id)}
                    className="rounded-2xl bg-[#eef4ff] px-4 py-2.5 text-sm font-bold text-[#0d5bd7] hover:bg-[#e0ecff] disabled:opacity-60"
                  >
                    Bỏ chặn
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel title="Chưa chặn ai" description="Khi bạn chặn một người dùng, họ sẽ xuất hiện ở đây để bạn có thể bỏ chặn sau." />
          )}
        </div>
      </div>
    </div>
  );
}

function InviteMembersModal({ open, room, friends, loading, onClose, onSubmit }) {
  const [selectedIds, setSelectedIds] = useState([]);

  React.useEffect(() => {
    if (open) setSelectedIds([]);
  }, [open, room?.id]);

  if (!open || !room) return null;
  const memberIds = new Set((room.members || []).map((member) => member.id));
  const pendingIds = new Set((room.pendingInvites || []).map((invite) => invite.userId));
  const candidates = (friends || []).filter((friend) => !memberIds.has(friend.id) && !pendingIds.has(friend.id));

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 p-4">
      <div className="flex h-[min(82vh,780px)] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-3xl font-black tracking-tight text-slate-900">Mời vào nhóm</div>
            <div className="mt-1 text-sm text-slate-500">{room.name || "Nhóm chat"}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {candidates.length ? (
            <div className="space-y-2">
              {candidates.map((friend) => {
                const selected = selectedIds.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() =>
                      setSelectedIds((prev) =>
                        selected ? prev.filter((id) => id !== friend.id) : [...prev, friend.id]
                      )
                    }
                    className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition ${
                      selected ? "bg-[#eef4ff]" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        selected ? "border-[#0d5bd7] bg-[#0d5bd7]" : "border-slate-300 bg-white"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-white" : "bg-transparent"}`} />
                    </span>
                    <Avatar item={friend} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-bold text-slate-900">{friend.fullName}</div>
                      <div className="truncate text-sm text-slate-500">{friend.phone || friend.email}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyPanel
              title="Không còn ai để mời"
              description="Tất cả bạn bè phù hợp đã ở trong nhóm hoặc đang chờ phản hồi lời mời."
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-6 py-3 font-bold text-slate-700">
            Hủy
          </button>
          <button
            type="button"
            disabled={loading || !selectedIds.length}
            onClick={() => onSubmit(room.id, selectedIds)}
            className="rounded-2xl bg-[#0d5bd7] px-6 py-3 font-bold text-white disabled:opacity-60"
          >
            Gửi lời mời
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupInviteCard({ room, currentUserId, loading, onAccept, onDecline }) {
  const invite = (room.pendingInvites || []).find((item) => item.userId === currentUserId);
  const inviter = room.members?.find((member) => member.id === invite?.invitedBy);
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dcebff] text-lg font-black text-[#0d5bd7]">
          {(room.name || "N").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-black tracking-tight text-slate-900">{room.name || "Nhóm chat"}</div>
          <div className="mt-1 text-sm text-slate-500">
            {inviter ? `Mời bởi ${inviter.fullName}` : "Lời mời vào nhóm"} • {room.members?.length || 0} thành viên
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700">
        Bạn vừa được mời tham gia nhóm/cộng đồng này. Hãy đồng ý để bắt đầu trò chuyện cùng mọi người.
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => onDecline(room.id)}
          className="rounded-2xl bg-slate-100 px-4 py-3 text-lg font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          Từ chối
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onAccept(room.id)}
          className="rounded-2xl bg-[#dceaff] px-4 py-3 text-lg font-bold text-[#0d5bd7] hover:bg-[#cfe1ff] disabled:opacity-60"
        >
          Đồng ý
        </button>
      </div>
    </div>
  );
}

export default function FriendHubModal({
  open,
  onClose,
  onOpenAddFriend,
  currentUserId,
  friends,
  blockedFriends,
  groups,
  incomingRequests,
  outgoingRequests,
  suggestions,
  incomingGroupInvites,
  loading,
  onOpenChat,
  onOpenGroup,
  onAccept,
  onDecline,
  onRevokeRequest,
  onSendFriendRequest,
  onRemoveFriend,
  onBlockFriend,
  onInviteMembers,
  onRespondGroupInvite,
  onUnblockFriend
}) {
  const [activeMenu, setActiveMenu] = useState("friends");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("az");
  const [letterFilter, setLetterFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [profileItem, setProfileItem] = useState(null);
  const [inviteRoom, setInviteRoom] = useState(null);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState([]);

  const normalizedSearch = String(search || "").trim().toLowerCase();

  const filteredFriends = useMemo(() => {
    const base = (friends || []).filter((item) => {
      if (!normalizedSearch) return true;
      return [item.fullName, item.email, item.phone]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(normalizedSearch));
    });
    const sorted = [...base].sort((a, b) => {
      const left = String(a.fullName || "").localeCompare(String(b.fullName || ""), "vi");
      return sortMode === "za" ? -left : left;
    });
    if (letterFilter === "all") return sorted;
    return sorted.filter((item) => String(item.fullName || "").charAt(0).toUpperCase() === letterFilter);
  }, [friends, normalizedSearch, sortMode, letterFilter]);

  const groupedFriends = useMemo(() => {
    return filteredFriends.reduce((acc, item) => {
      const letter = String(item.fullName || "#").charAt(0).toUpperCase() || "#";
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(item);
      return acc;
    }, {});
  }, [filteredFriends]);

  const availableLetters = useMemo(() => {
    const letters = new Set((friends || []).map((item) => String(item.fullName || "#").charAt(0).toUpperCase() || "#"));
    return ["all", ...Array.from(letters).sort((a, b) => a.localeCompare(b, "vi"))];
  }, [friends]);

  const filteredGroups = useMemo(() => {
    return (groups || []).filter((item) => {
      if (!normalizedSearch) return true;
      return String(item.name || "").toLowerCase().includes(normalizedSearch);
    });
  }, [groups, normalizedSearch]);

  const visibleSuggestions = useMemo(() => {
    return (suggestions || []).filter((item) => !dismissedSuggestionIds.includes(item.id));
  }, [suggestions, dismissedSuggestionIds]);

  React.useEffect(() => {
    if (open) {
      setDismissedSuggestionIds([]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-[1500px] overflow-hidden rounded-[34px] bg-[#f4f7fb] shadow-[0_32px_90px_rgba(15,23,42,0.3)]">
        <div className="flex w-full flex-col lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-white p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm"
                    className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAddFriend}
                className="rounded-2xl p-3 text-[#0d5bd7] transition hover:bg-[#eef4ff]"
                title="Thêm bạn"
              >
                <UserPlus className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl p-3 text-slate-500 transition hover:bg-slate-100"
                title="Đóng"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            <div className="mt-7 space-y-3">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.id;
                const badge =
                  item.id === "requests"
                    ? incomingRequests.length
                    : item.id === "groupInvites"
                      ? incomingGroupInvites.length
                      : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveMenu(item.id)}
                    className={`flex w-full items-center gap-4 rounded-[24px] px-6 py-5 text-left transition ${
                      isActive ? "bg-[#dcebff] text-[#0d315e]" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-7 w-7" />
                    <span className="flex-1 text-[20px] font-semibold">{item.label}</span>
                    {badge ? (
                      <span className="rounded-full bg-[#0d5bd7] px-2.5 py-1 text-xs font-bold text-white">
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto">
            {activeMenu === "friends" ? (
              <div>
                <div className="border-b border-slate-200 bg-white px-8 py-7">
                  <div className="text-4xl font-black tracking-tight text-slate-900">Danh sách bạn bè</div>
                </div>
                <div className="px-8 py-6">
                  <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
                    <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="text-2xl font-black tracking-tight text-slate-900">Bạn bè ({friends.length})</div>
                      <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <Search className="h-5 w-5 text-slate-400" />
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm bạn"
                            className="w-full min-w-[220px] bg-transparent text-base outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSortMode((prev) => (prev === "az" ? "za" : "az"))}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700"
                        >
                          <ArrowUpDown className="h-5 w-5" />
                          {sortMode === "az" ? "Tên (A-Z)" : "Tên (Z-A)"}
                        </button>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700">
                          <Filter className="h-5 w-5" />
                          <select
                            value={letterFilter}
                            onChange={(e) => setLetterFilter(e.target.value)}
                            className="bg-transparent outline-none"
                          >
                            {availableLetters.map((letter) => (
                              <option key={letter} value={letter}>
                                {letter === "all" ? "Tất cả" : letter}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBlockedModal(true)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700"
                        >
                          Đã chặn ({blockedFriends.length})
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[60vh] space-y-8 overflow-y-auto pr-2">
                      {Object.keys(groupedFriends).length ? (
                        Object.entries(groupedFriends).map(([letter, items]) => (
                          <div key={letter}>
                            <div className="mb-4 text-3xl font-black tracking-tight text-slate-900">{letter}</div>
                            <div className="space-y-3">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <Avatar item={item} />
                                    <div className="min-w-0">
                                      <div className="truncate text-[22px] font-black tracking-tight text-slate-900">
                                        {item.fullName}
                                      </div>
                                      <div className="truncate text-sm text-slate-500">
                                        {item.phone || item.email || "Bạn bè trong hệ thống"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => onOpenChat(item.id)}
                                      className="rounded-xl bg-[#0d5bd7] px-3 py-2 text-xs font-bold text-white hover:bg-[#0a4db8]"
                                    >
                                      Nhắn tin
                                    </button>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setOpenMenuId((prev) => (prev === item.id ? null : item.id))}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                      {openMenuId === item.id ? (
                                        <FriendMenu
                                          loading={loading}
                                          onView={() => {
                                            setProfileItem(item);
                                            setOpenMenuId(null);
                                          }}
                                          onRemove={() => {
                                            setOpenMenuId(null);
                                            setConfirmState({
                                              title: "Xóa bạn",
                                              description: `Bạn có chắc muốn xóa ${item.fullName} khỏi danh sách bạn bè không?`,
                                              confirmLabel: "Xóa bạn",
                                              tone: "danger",
                                              onConfirm: async () => {
                                                await onRemoveFriend(item.id);
                                                setConfirmState(null);
                                              }
                                            });
                                          }}
                                          onBlock={() => {
                                            setOpenMenuId(null);
                                            setConfirmState({
                                              title: "Chặn người dùng",
                                              description: `Sau khi chặn, ${item.fullName} sẽ bị gỡ khỏi danh bạ và không thể kết bạn lại cho tới khi bạn bỏ chặn.`,
                                              confirmLabel: "Chặn",
                                              tone: "danger",
                                              onConfirm: async () => {
                                                await onBlockFriend(item.id);
                                                setConfirmState(null);
                                              }
                                            });
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyPanel
                          title="Chưa có bạn phù hợp"
                          description="Hãy thử đổi từ khóa tìm kiếm hoặc kết bạn thêm để danh sách phong phú hơn."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeMenu === "groups" ? (
              <div>
                <div className="border-b border-slate-200 bg-white px-8 py-7">
                  <div className="text-4xl font-black tracking-tight text-slate-900">Danh sách nhóm và cộng đồng</div>
                </div>
                <div className="px-8 py-6">
                  <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
                    <div className="mb-6 text-2xl font-black tracking-tight text-slate-900">Nhóm chat ({groups.length})</div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {filteredGroups.length ? (
                        filteredGroups.map((group) => (
                          <div
                            key={group.id}
                            className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => onOpenGroup(group.id)}
                              className="flex w-full items-center gap-4 text-left"
                            >
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dcebff] text-lg font-black text-[#0d5bd7]">
                                {(group.name || "N").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xl font-black tracking-tight text-slate-900">{group.name || "Nhóm chat"}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {group.members?.length || 0} thành viên
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInviteRoom(group)}
                              className="mt-4 rounded-2xl bg-[#eef4ff] px-4 py-2.5 text-sm font-bold text-[#0d5bd7] hover:bg-[#e0ecff]"
                            >
                              Mời bạn
                            </button>
                          </div>
                        ))
                      ) : (
                        <EmptyPanel
                          title="Chưa có nhóm phù hợp"
                          description="Khi bạn tham gia nhóm chat, danh sách sẽ hiện ở đây để quản lý giống các ứng dụng nhắn tin thật."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeMenu === "requests" ? (
              <div>
                <div className="border-b border-slate-200 bg-white px-8 py-7">
                  <div className="text-4xl font-black tracking-tight text-slate-900">Lời mời kết bạn</div>
                </div>
                <div className="space-y-7 px-8 py-6">
                  <section>
                    <div className="mb-4 text-2xl font-black tracking-tight text-slate-900">
                      Lời mời đã nhận ({incomingRequests.length})
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {incomingRequests.length ? incomingRequests.map((item) => (
                        <RequestCard key={`incoming-${item.id}`} item={item} type="incoming" loading={loading} onAccept={onAccept} onDecline={onDecline} onRevoke={onRevokeRequest} />
                      )) : (
                        <EmptyPanel title="Chưa có lời mời mới" description="Khi có người gửi lời mời kết bạn, bạn sẽ thấy ở đây để đồng ý hoặc từ chối." />
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 text-2xl font-black tracking-tight text-slate-900">
                      Lời mời đã gửi ({outgoingRequests.length})
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {outgoingRequests.length ? outgoingRequests.map((item) => (
                        <RequestCard key={`outgoing-${item.id}`} item={item} type="outgoing" loading={loading} onAccept={onAccept} onDecline={onDecline} onRevoke={onRevokeRequest} />
                      )) : (
                        <EmptyPanel title="Bạn chưa gửi lời mời nào" description="Hãy dùng nút thêm bạn để tìm bạn bè và mở rộng danh bạ của bạn." />
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
                      <span>Gợi ý kết bạn ({visibleSuggestions.length})</span>
                      <ChevronDown className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {visibleSuggestions.length ? visibleSuggestions.map((item) => (
                        <SuggestionCard
                          key={`suggestion-${item.id}`}
                          item={item}
                          loading={loading}
                          onAdd={onSendFriendRequest}
                          onDismiss={(userId) =>
                            setDismissedSuggestionIds((prev) => prev.filter((id) => id !== userId).concat(userId))
                          }
                        />
                      )) : (
                        <EmptyPanel
                          title="Không còn gợi ý phù hợp"
                          description="Khi hệ thống có thêm gợi ý kết bạn mới, danh sách sẽ hiển thị ở đây."
                        />
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : null}

            {activeMenu === "groupInvites" ? (
              <div>
                <div className="border-b border-slate-200 bg-white px-8 py-7">
                  <div className="text-4xl font-black tracking-tight text-slate-900">Lời mời vào nhóm và cộng đồng</div>
                </div>
                <div className="space-y-7 px-8 py-6">
                  <section>
                    <div className="mb-4 text-2xl font-black tracking-tight text-slate-900">
                      Lời mời đang chờ ({incomingGroupInvites.length})
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2">
                      {incomingGroupInvites.length ? incomingGroupInvites.map((room) => (
                        <GroupInviteCard
                          key={room.id}
                          room={room}
                          currentUserId={currentUserId}
                          loading={loading}
                          onAccept={(roomId) => onRespondGroupInvite(roomId, "accept")}
                          onDecline={(roomId) => onRespondGroupInvite(roomId, "decline")}
                        />
                      )) : (
                        <EmptyPanel
                          title="Chưa có lời mời nhóm"
                          description="Khi bạn được mời vào nhóm hoặc cộng đồng, lời mời sẽ hiển thị ở đây để bạn phản hồi."
                        />
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <ProfileModal item={profileItem} onClose={() => setProfileItem(null)} onOpenChat={onOpenChat} />
      <BlockedFriendsModal
        open={showBlockedModal}
        users={blockedFriends}
        loading={loading}
        onClose={() => setShowBlockedModal(false)}
        onUnblock={async (userId) => {
          await onUnblockFriend(userId);
        }}
      />
      <InviteMembersModal
        open={Boolean(inviteRoom)}
        room={inviteRoom}
        friends={friends}
        loading={loading}
        onClose={() => setInviteRoom(null)}
        onSubmit={async (roomId, memberIds) => {
          await onInviteMembers(roomId, memberIds);
          setInviteRoom(null);
        }}
      />
      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        loading={loading}
        onClose={() => setConfirmState(null)}
        onConfirm={async () => {
          if (confirmState?.onConfirm) await confirmState.onConfirm();
        }}
      />
    </div>
  );
}
