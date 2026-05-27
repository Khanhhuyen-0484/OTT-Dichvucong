import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import { getApiErrorMessage, getMyApplications } from "../lib/api";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN");
}

function statusClass(status) {
  switch (status) {
    case "Chưa thanh toán":
    case "UNPAID":
      return "bg-red-50 text-red-700 ring-red-200";
    case "Đã tiếp nhận":
    case "PENDING":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "Đang xử lý":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "Yêu cầu bổ sung":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "Đã phê duyệt":
    case "APPROVED":
      return "bg-green-50 text-green-700 ring-green-200";
    case "Đã từ chối":
    case "REJECTED":
      return "bg-slate-100 text-slate-700 ring-slate-300";
    case "Hủy (Hết hạn thanh toán)":
    case "CANCELLED":
      return "bg-gray-100 text-gray-700 ring-gray-300";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function statusLabel(status) {
  switch (status) {
    case "PENDING":
      return "Đã nộp";
    case "APPROVED":
      return "Đã phê duyệt";
    case "REJECTED":
      return "Đã từ chối";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status || "Chưa rõ";
  }
}

function applicantName(item) {
  return item?.formData?.fullName || item?.citizenName || "Chưa có tên";
}

export default function MyApplications() {
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await getMyApplications();
        setItems(data.applications || []);
        setNote(data.note || "");
      } catch (e) {
        setErr(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const itemCode = String(item.applicationCode || "").toLowerCase();
      const serviceName = String(item.serviceName || "").toLowerCase();
      return !query || itemCode.includes(query) || serviceName.includes(query);
    });
  }, [items, searchQuery]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.applicationCode === selectedCode) || filteredItems[0] || null,
    [filteredItems, selectedCode]
  );

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedCode("");
      return;
    }

    if (!selectedCode || !filteredItems.some((item) => item.applicationCode === selectedCode)) {
      setSelectedCode(filteredItems[0].applicationCode);
    }
  }, [filteredItems, selectedCode]);

  function onSearch(e) {
    e.preventDefault();
    setSearchQuery(searchInput);
  }

  function onClearSearch() {
    setSearchInput("");
    setSearchQuery("");
  }

  return (
    <div className="min-h-screen">
      <GovHeader />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Hồ sơ đã nộp</h1>
            <p className="mt-2 text-slate-600">
              Danh sách các hồ sơ dịch vụ công bạn đã gửi đi.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex rounded-xl bg-white px-4 py-3 text-sm font-bold text-(--gov-navy) ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Quay lại
            </Link>
            <Link
              to="/services"
              className="inline-flex rounded-xl bg-(--gov-navy) px-4 py-3 text-sm font-bold text-white hover:bg-[#19306f]"
            >
              Nộp hồ sơ mới
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            Đang tải lịch sử hồ sơ...
          </div>
        )}

        {!loading && err && (
          <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}

        {!loading && !err && note && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200 text-sm">
            {note}
          </div>
        )}

        {!loading && !err && items.length === 0 && (
          <div className="mt-6 rounded-2xl bg-white p-8 ring-1 ring-slate-200 text-center">
            <div className="text-lg font-bold text-slate-900">
              Chưa có hồ sơ đã nộp
            </div>
            <p className="mt-2 text-slate-600">
              Bạn chưa nộp hồ sơ dịch vụ công nào.
            </p>
          </div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <form onSubmit={onSearch} className="grid gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Tìm theo mã hồ sơ hoặc tên dịch vụ
                  </label>
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nhập mã hồ sơ hoặc tên dịch vụ"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#003366]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-(--gov-navy) px-4 py-2.5 text-sm font-bold text-white hover:bg-[#19306f]"
                  >
                    Tìm kiếm hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Xóa
                  </button>
                </div>
              </form>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-3 text-sm font-bold text-slate-700">
                  Danh sách hồ sơ ({filteredItems.length})
                </div>
                {filteredItems.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Không tìm thấy hồ sơ phù hợp.
                  </div>
                ) : (
                  <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                    {filteredItems.map((item) => {
                      const active = selectedItem?.applicationCode === item.applicationCode;

                      return (
                        <button
                          key={item.applicationCode}
                          type="button"
                          onClick={() => setSelectedCode(item.applicationCode)}
                          className={`w-full rounded-2xl p-4 text-left ring-1 transition ${
                            active
                              ? "bg-[#003366] text-white ring-[#003366]"
                              : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="text-sm font-black">{item.serviceName}</div>
                          <div className={`mt-1 text-xs ${active ? "text-white/80" : "text-slate-500"}`}>
                            {item.applicationCode}
                          </div>
                          <div className={`mt-2 text-xs ${active ? "text-white/85" : "text-slate-600"}`}>
                            {applicantName(item)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              {!selectedItem ? (
                <div className="grid min-h-[420px] place-items-center text-center">
                  <div>
                    <div className="text-lg font-black text-slate-900">Chưa chọn hồ sơ</div>
                    <p className="mt-2 text-sm text-slate-600">
                      Chọn một hồ sơ ở danh sách bên trái để xem thông tin.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Thông tin hồ sơ
                      </div>
                      <h2 className="mt-1 text-2xl font-black text-slate-900">
                        {selectedItem.serviceName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Mã hồ sơ: <strong>{selectedItem.applicationCode}</strong>
                      </p>
                    </div>
                    <span
                      className={`inline-flex self-start rounded-full px-3 py-1 text-sm font-bold ring-1 ${statusClass(
                        selectedItem.status
                      )}`}
                    >
                      {statusLabel(selectedItem.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
                    <InfoItem label="Người nộp" value={applicantName(selectedItem)} />
                    <InfoItem label="Ngày nộp" value={formatDate(selectedItem.createdAt)} />
                    <InfoItem label="Số điện thoại" value={selectedItem.formData?.phone || selectedItem.phone || "—"} />
                    <InfoItem label="Email" value={selectedItem.formData?.email || selectedItem.email || "—"} />
                    <InfoItem label="CCCD/CMND" value={selectedItem.formData?.citizenId || "—"} />
                    <InfoItem label="Địa chỉ" value={selectedItem.formData?.address || "—"} />
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-black text-slate-900">Tài liệu đính kèm</div>
                    {selectedItem.attachments?.length ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {selectedItem.attachments.map((file, idx) => (
                          <div key={`${file.key}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                            <div className="font-bold text-slate-900">{file.name || file.key || "Tài liệu"}</div>
                            <div className="mt-1 text-xs text-slate-500">{file.type || "Không rõ loại tệp"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        Chưa có tài liệu đính kèm.
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <Link
                      to={`/my-applications/${selectedItem.applicationCode}`}
                      className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-(--gov-navy) ring-1 ring-slate-200 hover:ring-slate-300"
                    >
                      Xem chi tiết đầy đủ
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-bold text-slate-900">{value || "—"}</div>
    </div>
  );
}