import React, { useEffect, useState } from "react";
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
      return "bg-red-50 text-red-700 ring-red-200";
    case "Đã tiếp nhận":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "Đang xử lý":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "Yêu cầu bổ sung":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "Đã phê duyệt":
      return "bg-green-50 text-green-700 ring-green-200";
    case "Đã từ chối":
      return "bg-slate-100 text-slate-700 ring-slate-300";
    case "Hủy (Hết hạn thanh toán)":
      return "bg-gray-100 text-gray-700 ring-gray-300";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

export default function MyApplications() {
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  return (
    <div className="min-h-screen">
      <GovHeader />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Hồ sơ đã gửi</h1>
            <p className="mt-2 text-slate-600">
              Theo dõi lịch sử nộp hồ sơ và trạng thái xử lý.
            </p>
          </div>

          <Link
            to="/services"
            className="inline-flex rounded-xl bg-[var(--gov-navy)] px-4 py-3 text-sm font-bold text-white hover:bg-[#19306f]"
          >
            Nộp hồ sơ mới
          </Link>
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
              Chưa có hồ sơ nào
            </div>
            <p className="mt-2 text-slate-600">
              Bạn chưa nộp hồ sơ dịch vụ công nào.
            </p>
          </div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className="mt-6 grid gap-4">
            {items.map((item) => (
              <div
                key={item.applicationCode}
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-black text-slate-900">
                      {item.serviceName}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      <div>
                        <strong>Mã hồ sơ:</strong> {item.applicationCode}
                      </div>
                      <div>
                        <strong>Ngày nộp:</strong> {formatDate(item.createdAt)}
                      </div>
                      <div>
                        <strong>Lệ phí:</strong>{" "}
                        {new Intl.NumberFormat("vi-VN").format(item.fee || 0)} VNĐ
                      </div>
                      <div>
                        <strong>Thanh toán:</strong> {item.paymentMethod || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start lg:items-end gap-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${statusClass(
                        item.status
                      )}`}
                    >
                      {item.paymentStatus === "pending" ? "🔴 " : ""}{item.status || "Chưa rõ"}
                    </span>

                    <Link
                      to={`/my-applications/${item.applicationCode}`}
                      className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--gov-navy)] ring-1 ring-slate-200 hover:ring-slate-300"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}