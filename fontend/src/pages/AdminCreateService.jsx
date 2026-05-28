import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import {
  createService,
  getAdminServiceCategories,
  getApiErrorMessage,
  getServices,
  updateService,
} from "../lib/api";

const EMPTY_DOCUMENT = { key: "", label: "", required: true };

function makeDocumentKey(label, index) {
  const normalized = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part, partIndex) =>
      partIndex === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
  return normalized || `document${index + 1}`;
}

export default function AdminCreateService() {
  const navigate = useNavigate();
  const { serviceId } = useParams();
  const isEdit = Boolean(serviceId);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState([{ ...EMPTY_DOCUMENT }]);
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

  const title = isEdit ? "Sửa dịch vụ công" : "Tạo dịch vụ công";
  const submitLabel = isEdit ? "Lưu thay đổi" : "Tạo dịch vụ";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const categoryRes = await getAdminServiceCategories();
        const nextCategories = categoryRes.data.categories || [];
        setCategories(nextCategories);

        if (isEdit) {
          const { data } = await getServices();
          const service = (data.services || []).find((item) => String(item.serviceId || item.id) === String(serviceId));
          if (!service) {
            setMessage("Không tìm thấy dịch vụ cần sửa");
            return;
          }
          const categoryId =
            service.categoryId ||
            nextCategories.find((item) => (item.name || item.categoryName) === (service.categoryName || service.category))?.categoryId ||
            nextCategories.find((item) => (item.name || item.categoryName) === (service.categoryName || service.category))?.id ||
            "";

          setForm({
            name: service.name || "",
            categoryId,
            categoryName: service.categoryName || service.category || "",
            description: service.description || "",
            fee: service.fee || 0,
            processingTime: service.processingTime || "",
            agency: service.agency || "",
            level: service.level || "Mức 3",
            active: service.active !== false,
          });
          const currentDocs = Array.isArray(service.documents) ? service.documents : [];
          setDocuments(currentDocs.length ? currentDocs.map((doc) => ({
            key: doc.key || doc.docKey || doc.id || "",
            label: doc.label || doc.name || doc.documentName || "",
            required: doc.required !== false,
          })) : [{ ...EMPTY_DOCUMENT }]);
        }
      } catch (error) {
        setMessage(getApiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isEdit, serviceId]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.categoryId === form.categoryId || item.id === form.categoryId),
    [categories, form.categoryId]
  );

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDocument(index, key, value) {
    setDocuments((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function addDocument() {
    setDocuments((prev) => [...prev, { ...EMPTY_DOCUMENT }]);
  }

  function removeDocument(index) {
    setDocuments((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [{ ...EMPTY_DOCUMENT }];
    });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const normalizedDocuments = documents
        .map((doc, index) => ({
          key: doc.key.trim() || makeDocumentKey(doc.label, index),
          label: doc.label.trim(),
          required: doc.required !== false,
        }))
        .filter((doc) => doc.label);

      const payload = {
        ...form,
        categoryName: form.categoryName || selectedCategory?.name || selectedCategory?.categoryName || "Khác",
        fee: Number(form.fee || 0),
        documents: normalizedDocuments,
        faq: [],
        timeline: ["PENDING", "PROCESSING", "NEED_MORE", "SUPPLEMENTED", "COMPLETED", "REJECTED"],
      };

      if (isEdit) {
        await updateService(serviceId, payload);
        setMessage("Đã cập nhật dịch vụ thành công");
      } else {
        await createService(payload);
        setMessage("Đã tạo dịch vụ thành công");
      }
      setTimeout(() => navigate("/admin/services"), 500);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <BackToDashboardButton variant="soft" className="mb-5" />
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Nhập thông tin dịch vụ và danh sách giấy tờ người dân cần chuẩn bị khi nộp hồ sơ.
          </p>

          {message ? <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-100">{message}</div> : null}
          {loading ? <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Đang tải dịch vụ...</div> : null}

          {!loading ? (
            <form onSubmit={submit} className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Yêu cầu giấy tờ</h2>
                    <p className="mt-1 text-sm text-slate-600">Các giấy tờ này sẽ hiển thị cho người dân khi nộp hồ sơ và cho admin khi kiểm tra tài liệu.</p>
                  </div>
                  <button type="button" onClick={addDocument} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#003366] ring-1 ring-slate-200 hover:bg-slate-50">
                    <Plus className="h-4 w-4" />
                    Thêm giấy tờ
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {documents.map((doc, index) => (
                    <div key={`${index}-${doc.key}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                      <Field label="Tên giấy tờ" value={doc.label} onChange={(value) => updateDocument(index, "label", value)} placeholder="Ví dụ: CCCD/CMND người nộp" />
                      <Field label="Mã giấy tờ" value={doc.key} onChange={(value) => updateDocument(index, "key", value)} placeholder="Tự tạo nếu bỏ trống" />
                      <label className="flex h-[46px] items-center gap-2 text-sm font-bold text-slate-700">
                        <input type="checkbox" checked={doc.required !== false} onChange={(e) => updateDocument(index, "required", e.target.checked)} />
                        Bắt buộc
                      </label>
                      <button type="button" onClick={() => removeDocument(index)} className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100">
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap gap-3">
                <button disabled={saving} className="rounded-xl bg-[#003366] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? "Đang lưu..." : submitLabel}
                </button>
                <button type="button" onClick={() => navigate("/admin/services")} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">
                  Hủy
                </button>
              </div>
            </form>
          ) : null}
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
