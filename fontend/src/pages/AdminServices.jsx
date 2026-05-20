import React, { useEffect, useMemo, useState } from "react";
import {
  createService,
  deleteService,
  getApiErrorMessage,
  getServices,
  updateService
} from "../lib/api";
import { Plus, PencilLine, Trash2, Save, RotateCcw, Search } from "lucide-react";

const emptyForm = {
  serviceId: "",
  name: "",
  description: "",
  categoryId: "",
  categoryName: "",
  processingTime: "",
  fee: 0,
  documentsText: "",
  faqText: "",
  timelineText: ""
};

function jsonToText(value) {
  return Array.isArray(value) ? JSON.stringify(value, null, 2) : "";
}

function textToJson(text, fallback = []) {
  if (!String(text || "").trim()) return fallback;
  return JSON.parse(text);
}

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getServices({ q: query });
      setServices(data.services || []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [query]);

  const filtered = useMemo(() => services, [services]);

  const onEdit = (service) => {
    setEditingId(service.serviceId || service.id);
    setForm({
      serviceId: service.serviceId || service.id || "",
      name: service.name || "",
      description: service.description || "",
      categoryId: service.categoryId || "",
      categoryName: service.categoryName || "",
      processingTime: service.processingTime || "",
      fee: service.fee || 0,
      documentsText: jsonToText(service.documents || []),
      faqText: jsonToText(service.faq || []),
      timelineText: jsonToText(service.timeline || [])
    });
  };

  const resetForm = () => {
    setEditingId("");
    setForm(emptyForm);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        serviceId: form.serviceId.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId.trim(),
        categoryName: form.categoryName.trim(),
        processingTime: form.processingTime.trim(),
        fee: Number(form.fee || 0),
        documents: textToJson(form.documentsText, []),
        faq: textToJson(form.faqText, []),
        timeline: textToJson(form.timelineText, [])
      };

      if (!payload.serviceId || !payload.name) {
        throw new Error("serviceId và tên dịch vụ là bắt buộc");
      }

      if (editingId) {
        await updateService(editingId, payload);
        setMessage("Đã cập nhật dịch vụ");
      } else {
        await createService(payload);
        setMessage("Đã tạo dịch vụ mới");
      }

      resetForm();
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (serviceId) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa dịch vụ này?")) return;
    setSaving(true);
    try {
      await deleteService(serviceId);
      setMessage("Đã xóa dịch vụ");
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <div>
            <div style={styles.badge}>Admin CRUD</div>
            <h1 style={styles.title}>Quản lý dịch vụ công</h1>
            <p style={styles.desc}>Tạo mới, chỉnh sửa và xóa dịch vụ công trực tiếp trên dữ liệu thật.</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={load} style={styles.secondaryBtn}><RotateCcw size={16} /> Làm mới</button>
            <button type="button" onClick={resetForm} style={styles.primaryBtn}><Plus size={16} /> Tạo mới</button>
          </div>
        </div>

        <div style={styles.toolbar}>
          <div style={styles.searchBox}>
            <Search size={18} color="#64748b" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên, mô tả, nhóm dịch vụ..." style={styles.searchInput} />
          </div>
          {message ? <div style={styles.success}>{message}</div> : null}
          {error ? <div style={styles.error}>{error}</div> : null}
        </div>

        <div style={styles.grid}>
          <div style={styles.listCard}>
            <h2 style={styles.sectionTitle}>Danh sách dịch vụ</h2>
            {loading ? <div>Đang tải...</div> : filtered.length === 0 ? <div>Không có dữ liệu</div> : (
              <div style={styles.list}>
                {filtered.map((service) => {
                  const id = service.serviceId || service.id;
                  return (
                    <div key={id} style={styles.row}>
                      <div>
                        <div style={styles.rowTitle}>{service.name}</div>
                        <div style={styles.rowMeta}>{id} • {service.categoryName || service.category || "Khác"}</div>
                      </div>
                      <div style={styles.rowActions}>
                        <button type="button" onClick={() => onEdit(service)} style={styles.iconBtn}><PencilLine size={16} /> Sửa</button>
                        <button type="button" onClick={() => remove(id)} style={styles.dangerBtn}><Trash2 size={16} /> Xóa</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={styles.formCard}>
            <h2 style={styles.sectionTitle}>{editingId ? "Chỉnh sửa dịch vụ" : "Tạo dịch vụ mới"}</h2>
            <div style={styles.formGrid}>
              <Field label="serviceId" value={form.serviceId} onChange={(v) => setForm((p) => ({ ...p, serviceId: v }))} />
              <Field label="Tên dịch vụ" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
              <Field label="Nhóm ID" value={form.categoryId} onChange={(v) => setForm((p) => ({ ...p, categoryId: v }))} />
              <Field label="Nhóm tên" value={form.categoryName} onChange={(v) => setForm((p) => ({ ...p, categoryName: v }))} />
              <Field label="Thời gian xử lý" value={form.processingTime} onChange={(v) => setForm((p) => ({ ...p, processingTime: v }))} />
              <Field label="Lệ phí" type="number" value={form.fee} onChange={(v) => setForm((p) => ({ ...p, fee: v }))} />
              <TextArea label="Mô tả" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} fullWidth />
              <TextArea label="Documents JSON" value={form.documentsText} onChange={(v) => setForm((p) => ({ ...p, documentsText: v }))} fullWidth />
              <TextArea label="Timeline JSON" value={form.timelineText} onChange={(v) => setForm((p) => ({ ...p, timelineText: v }))} fullWidth />
              <TextArea label="FAQ JSON" value={form.faqText} onChange={(v) => setForm((p) => ({ ...p, faqText: v }))} fullWidth />
            </div>
            <div style={styles.formActions}>
              <button type="button" onClick={save} disabled={saving} style={styles.primaryBtn}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu dịch vụ"}</button>
              <button type="button" onClick={resetForm} style={styles.secondaryBtn}>Hủy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
    </label>
  );
}

function TextArea({ label, value, onChange, fullWidth = false }) {
  return (
    <label style={fullWidth ? { ...styles.field, gridColumn: "1 / -1" } : styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} style={styles.textarea} />
    </label>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)", padding: 24 },
  container: { maxWidth: 1400, margin: "0 auto" },
  headerCard: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, marginBottom: 16, boxShadow: "0 10px 30px rgba(15,23,42,.05)" },
  badge: { display: "inline-flex", padding: "6px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  title: { margin: "12px 0 8px", fontSize: 32, fontWeight: 900, color: "#0f172a" },
  desc: { margin: 0, color: "#475569" },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  toolbar: { display: "grid", gap: 12, marginBottom: 16 },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "0 14px" },
  searchInput: { width: "100%", height: 52, border: "none", outline: "none", background: "transparent", fontSize: 14 },
  success: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 12, borderRadius: 14, fontWeight: 700 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12, borderRadius: 14, fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 },
  listCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20 },
  formCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20 },
  sectionTitle: { marginTop: 0, marginBottom: 16, fontSize: 20, fontWeight: 900, color: "#0f172a" },
  list: { display: "grid", gap: 12 },
  row: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#f8fafc" },
  rowTitle: { fontWeight: 800, color: "#0f172a" },
  rowMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  iconBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, padding: "10px 12px", background: "#dbeafe", color: "#1d4ed8", cursor: "pointer", fontWeight: 800 },
  dangerBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, padding: "10px 12px", background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontWeight: 800 },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 800 },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#e2e8f0", color: "#0f172a", cursor: "pointer", fontWeight: 800 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 800, color: "#334155" },
  input: { height: 46, borderRadius: 14, border: "1px solid #dbe3ee", padding: "0 14px", outline: "none" },
  textarea: { borderRadius: 14, border: "1px solid #dbe3ee", padding: 14, outline: "none", fontFamily: "inherit" },
  formActions: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }
};
