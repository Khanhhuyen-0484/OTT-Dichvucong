import React from "react";

function GroupCreator({
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
  return (
    showGroupModal && (
      <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-4 space-y-3">
          <div className="text-sm font-bold">Tạo nhóm chat</div>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Tên nhóm"
            className="w-full rounded-lg border p-2 text-sm"
          />
          <input
            value={groupAvatar}
            onChange={(e) => setGroupAvatar(e.target.value)}
            placeholder="Link ảnh đại diện (tuỳ chọn)"
            className="w-full rounded-lg border p-2 text-sm"
          />
          <div className="text-xs font-semibold">Chọn thành viên</div>
          <div className="max-h-44 overflow-y-auto border rounded-lg p-2 space-y-1">
            {contacts.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={groupMemberIds.includes(c.id)}
                  onChange={(e) =>
                    setGroupMemberIds((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                    )
                  }
                />
                <span>{c.fullName}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowGroupModal(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={createGroup}
              className="px-3 py-1.5 rounded-lg bg-[#003366] text-white text-sm"
              disabled={!groupName.trim()}
            >
              Tạo nhóm
            </button>
          </div>
        </div>
      </div>
    )
  );
}

export default GroupCreator;