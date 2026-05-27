import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import { createService, getAdminServiceCategories, getApiErrorMessage } from "../lib/api";

export default function AdminCreateService() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    categoryName: "",
    description: "",
    fee: 0,
    processingTime: "",
    agency: "",
    level: "Mức 3",
    active: true,
  });

  useEffect(() => {
    getAdminServiceCategories()
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const category = categories.find((item) => item.categoryId === form.categoryId || item.id === form.categoryId);
      const payload = {
        ...form,
        categoryName: form.categoryName || category?.name || category?.categoryName || "Khác",
        fee: Number(form.fee || 0),
        documents: [],
        faq: [],
        timeline: ["PENDING", "PROCESSING", "NEED_MORE", "SUPPLEMENTED", "COMPLETED", "REJECTED"],
      };
      await createService(payload);
      setMessage("Đã tạo dịch vụ thành công");
      setTimeout(() => navigate("/admin/services"), 500);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <BackToDashboardButton variant="soft" className="mb-5" />
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">Tạo dịch vụ công</h1>
          <p className="mt-2 text-sm text-slate-600">Nhập thông tin cơ bản để thêm dịch vụ mới vào cổng.</p>

          {message ? <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-100">{message}</div> : null}

          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Tên dịch vụ" value={form.name} onChange={(value) => update("name", value)} required />
            <label className="block text-sm font-bold text-slate-700">
              Danh mục
              <select value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-[#003366]" required>
                <option value="">Chọn danh mục</option>
                {categories.map((item) => {
                  const id = item.categoryId || item.id;
                  return <option key={id} value={id}>{item.name || item.categoryName}</option>;
                })}
              </select>
            </label>
            <Field label="Cơ quan xử lý" value={form.agency} onChange={(value) => update("agency", value)} required />
            <Field label="Thời gian xử lý" value={form.processingTime} onChange={(value) => update("processingTime", value)} placeholder="Ví dụ: 3 ngày làm việc" required />
            <Field label="Lệ phí" type="number" value={form.fee} onChange={(value) => update("fee", value)} />
            <Field label="Mức độ" value={form.level} onChange={(value) => update("level", value)} />
            <label className="block text-sm font-bold text-slate-700 sm:col-span-2">
              Mô tả
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-[#003366]" />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(e) => update("active", e.target.checked)} />
              Đang hoạt động
            </label>
            <div className="sm:col-span-2">
              <button disabled={saving} className="rounded-xl bg-[#003366] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "Đang lưu..." : "Tạo dịch vụ"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", required = false }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-[#003366]" />
    </label>
  );
}
