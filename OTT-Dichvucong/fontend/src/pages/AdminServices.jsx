import React, { useEffect, useMemo, useState } from "react";
import { createService, deleteService, getApiErrorMessage, getServices, seedServices, updateService } from "../lib/api";
import { Plus, PencilLine, Trash2, Save, RotateCcw, Search, Layers3, FileText, ListChecks, CircleHelp, ArrowLeft, ArrowRight, Sparkles, CheckCircle2, LoaderCircle } from "lucide-react";

const emptyForm = {
  serviceId: "",
  name: "",
  description: "",
  categoryId: "",
  categoryName: "",
  processingTime: "",
  fee: 0,
  documents: [{ key: "", label: "", required: true }],
  timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"],
  faq: [{ q: "", a: "" }],
};

function normalizeDocuments(value) {
  if (!Array.isArray(value) || value.length === 0) return [{ key: "", label: "", required: true }];
  return value.map((item, index) => ({
    key: String(item.key || `doc-${index + 1}`),
    label: String(item.label || ""),
    required: item.required !== false,
  }));
}

function normalizeTimeline(value) {
  if (!Array.isArray(value) || value.length === 0) return emptyForm.timeline;
  return value.map((item) => String(item || "")).filter(Boolean);
}

function normalizeFaq(value) {
  if (!Array.isArray(value) || value.length === 0) return [{ q: "", a: "" }];
  return value.map((item) => ({ q: String(item?.q || ""), a: String(item?.a || "") }));
}

function buildDocumentKey(label, index) {
  const base = String(label || "document").trim().toLowerCase().replace(/[^a-z0-9\u00C0-\u1EF9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || `document-${index + 1}`;
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
  const [step, setStep] = useState(0);

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

  useEffect(() => { load(); }, [query]);

  const stats = useMemo(() => {
    const total = services.length;
    const categories = new Set(services.map((s) => s.categoryName || s.category || "Khác")).size;
    const requiredDocs = form.documents.filter((d) => d.required !== false).length;
    return [
      { label: "Tổng dịch vụ", value: total },
      { label: "Nhóm danh mục", value: categories },
      { label: "Giấy tờ bắt buộc", value: requiredDocs },
    ];
  }, [services, form.documents]);

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
      documents: normalizeDocuments(service.documents || []),
      timeline: normalizeTimeline(service.timeline || []),
      faq: normalizeFaq(service.faq || []),
    });
    setStep(0);
  };

  const resetForm = () => {
    setEditingId("");
    setForm(emptyForm);
    setStep(0);
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
        documents: (form.documents || []).filter((doc) => String(doc.label || doc.key || "").trim()).map((doc, index) => ({
          key: String(doc.key || buildDocumentKey(doc.label, index)),
          label: String(doc.label || "").trim(),
          required: doc.required !== false,
        })),
        timeline: (form.timeline || []).map((item) => String(item || "").trim()).filter(Boolean),
        faq: (form.faq || []).filter((item) => String(item.q || item.a || "").trim()).map((item) => ({ q: String(item.q || "").trim(), a: String(item.a || "").trim() })),
      };

      if (!payload.serviceId || !payload.name) throw new Error("serviceId và tên dịch vụ là bắt buộc");

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

  const steps = [
    { id: 0, label: "Thông tin chung", icon: Layers3 },
    { id: 1, label: "Hồ sơ", icon: FileText },
    { id: 2, label: "Quy trình", icon: ListChecks },
    { id: 3, label: "FAQ", icon: CircleHelp },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <div>
            <div style={styles.badge}>Admin dịch vụ</div>
            <h1 style={styles.title}>Quản lý dịch vụ công</h1>
            <p style={styles.desc}>Wizard từng bước giúp admin nhập nhanh, rõ ràng và ít sai sót hơn.</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={load} style={styles.secondaryBtn}><RotateCcw size={16} /> Làm mới</button>
            <button type="button" onClick={async () => { setSaving(true); try { const res = await seedServices(); setMessage(res.data?.message || "Đã seed dịch vụ"); await load(); } catch (e) { setError(getApiErrorMessage(e)); } finally { setSaving(false); } }} style={styles.secondaryBtn}>Seed dữ liệu</button>
            <button type="button" onClick={resetForm} style={styles.primaryBtn}><Plus size={16} /> Tạo mới</button>
          </div>
        </div>

        <div style={styles.toolbar}>
          <div style={styles.searchBox}>
            <Search size={18} color="#64748b" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên, mô tả, nhóm dịch vụ..." style={styles.searchInput} />
          </div>
          <div style={styles.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} style={styles.statCard}>
                <div style={styles.statValue}>{stat.value}</div>
                <div style={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
          {message ? <div style={styles.success}><CheckCircle2 size={16} /> {message}</div> : null}
          {error ? <div style={styles.error}>{error}</div> : null}
        </div>

        <div style={styles.grid}>
          <div style={styles.listCard}>
            <h2 style={styles.sectionTitle}>Danh sách dịch vụ</h2>
            {loading ? <div>Đang tải...</div> : services.length === 0 ? <div>Không có dữ liệu</div> : (
              <div style={styles.list}>
                {services.map((service) => {
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
            <div style={styles.formHeader}>
              <div>
                <h2 style={styles.sectionTitle}>{editingId ? "Chỉnh sửa dịch vụ" : "Tạo dịch vụ mới"}</h2>
                <p style={styles.formDesc}>Bấm Tiếp theo để chuyển sang bước kế tiếp.</p>
              </div>
              <div style={styles.stepBar}>
                {steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button key={s.id} type="button" onClick={() => setStep(s.id)} style={step === s.id ? styles.stepChipActive : styles.stepChip}>
                      <Icon size={14} /> {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {step === 0 ? (
              <Panel>
                <div style={styles.formGrid}>
                  <Field label="serviceId" value={form.serviceId} onChange={(v) => setForm((p) => ({ ...p, serviceId: v }))} />
                  <Field label="Tên dịch vụ" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
                  <Field label="Nhóm ID" value={form.categoryId} onChange={(v) => setForm((p) => ({ ...p, categoryId: v }))} />
                  <Field label="Nhóm tên" value={form.categoryName} onChange={(v) => setForm((p) => ({ ...p, categoryName: v }))} />
                  <Field label="Thời gian xử lý" value={form.processingTime} onChange={(v) => setForm((p) => ({ ...p, processingTime: v }))} />
                  <Field label="Lệ phí" type="number" value={form.fee} onChange={(v) => setForm((p) => ({ ...p, fee: v }))} />
                  <TextArea label="Mô tả" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} fullWidth />
                </div>
              </Panel>
            ) : null}

            {step === 1 ? (
              <Panel>
                <SectionHint title="Yêu cầu hồ sơ" desc="Thêm từng giấy tờ cần nộp, đánh dấu bắt buộc/tùy chọn." />
                <DocumentEditor documents={form.documents} setDocuments={(documents) => setForm((p) => ({ ...p, documents }))} />
              </Panel>
            ) : null}

            {step === 2 ? (
              <Panel>
                <SectionHint title="Quy trình xử lý" desc="Thêm các bước xử lý theo thứ tự hiển thị ở trang dịch vụ." />
                <TimelineEditor timeline={form.timeline} setTimeline={(timeline) => setForm((p) => ({ ...p, timeline }))} />
              </Panel>
            ) : null}

            {step === 3 ? (
              <Panel>
                <SectionHint title="Câu hỏi thường gặp" desc="Nhập câu hỏi và câu trả lời theo từng cặp." />
                <FaqEditor faq={form.faq} setFaq={(faq) => setForm((p) => ({ ...p, faq }))} />
              </Panel>
            ) : null}

            <div style={styles.wizardActions}>
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={styles.secondaryBtn}>
                <ArrowLeft size={16} /> Trước
              </button>
              {step < 3 ? (
                <button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))} style={styles.primaryBtn}>
                  Tiếp theo <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={save} disabled={saving} style={styles.primaryBtn}>
                  {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} {saving ? "Đang lưu..." : "Lưu dịch vụ"}
                </button>
              )}
              <button type="button" onClick={resetForm} style={styles.secondaryBtn}>Hủy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ children }) { return <div style={styles.sectionPanel}>{children}</div>; }

function SectionHint({ title, desc }) {
  return (
    <div style={styles.sectionHint}>
      <div style={styles.sectionHintTitle}>{title}</div>
      <div style={styles.sectionHintDesc}>{desc}</div>
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

function DocumentEditor({ documents, setDocuments }) {
  const updateDoc = (index, key, value) => setDocuments(documents.map((doc, i) => (i === index ? { ...doc, [key]: value } : doc)));
  const addDoc = () => setDocuments([...(documents || []), { key: "", label: "", required: true }]);
  const removeDoc = (index) => setDocuments((documents || []).filter((_, i) => i !== index));

  return (
    <div style={styles.dynamicList}>
      <div style={styles.dynamicListActions}><button type="button" onClick={addDoc} style={styles.addBtn}>+ Thêm giấy tờ</button></div>
      {(documents || []).map((doc, index) => (
        <div key={`${index}-${doc.key || "doc"}`} style={styles.itemCard}>
          <Field label="Mã giấy tờ" value={doc.key} onChange={(v) => updateDoc(index, "key", v)} />
          <Field label="Tên giấy tờ" value={doc.label} onChange={(v) => updateDoc(index, "label", v)} />
          <label style={styles.checkField}>
            <span style={styles.label}>Bắt buộc</span>
            <input type="checkbox" checked={doc.required !== false} onChange={(e) => updateDoc(index, "required", e.target.checked)} />
          </label>
          <button type="button" onClick={() => removeDoc(index)} style={styles.removeBtn}>Xóa</button>
        </div>
      ))}
    </div>
  );
}

function TimelineEditor({ timeline, setTimeline }) {
  const update = (index, value) => setTimeline(timeline.map((item, i) => (i === index ? value : item)));
  const add = () => setTimeline([...(timeline || []), ""]);
  const remove = (index) => setTimeline((timeline || []).filter((_, i) => i !== index));
  return (
    <div style={styles.dynamicList}>
      <div style={styles.dynamicListActions}><button type="button" onClick={add} style={styles.addBtn}>+ Thêm bước</button></div>
      {(timeline || []).map((item, index) => (
        <div key={`${index}-${item}`} style={styles.timelineRow}>
          <Field label={`Bước ${index + 1}`} value={item} onChange={(v) => update(index, v)} />
          <button type="button" onClick={() => remove(index)} style={styles.removeBtn}>Xóa</button>
        </div>
      ))}
    </div>
  );
}

function FaqEditor({ faq, setFaq }) {
  const update = (index, key, value) => setFaq(faq.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const add = () => setFaq([...(faq || []), { q: "", a: "" }]);
  const remove = (index) => setFaq((faq || []).filter((_, i) => i !== index));
  return (
    <div style={styles.dynamicList}>
      <div style={styles.dynamicListActions}><button type="button" onClick={add} style={styles.addBtn}>+ Thêm câu hỏi</button></div>
      {(faq || []).map((item, index) => (
        <div key={`${index}-${item.q || "faq"}`} style={styles.faqRow}>
          <Field label={`Câu hỏi ${index + 1}`} value={item.q} onChange={(v) => update(index, "q", v)} />
          <label style={styles.field}>
            <span style={styles.label}>Trả lời</span>
            <textarea value={item.a} onChange={(e) => update(index, "a", e.target.value)} rows={4} style={styles.textarea} />
          </label>
          <button type="button" onClick={() => remove(index)} style={styles.removeBtn}>Xóa</button>
        </div>
      ))}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)", padding: 24 },
  container: { maxWidth: 1420, margin: "0 auto" },
  headerCard: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, marginBottom: 16, boxShadow: "0 10px 30px rgba(15,23,42,.05)" },
  badge: { display: "inline-flex", padding: "6px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  title: { margin: "12px 0 8px", fontSize: 32, fontWeight: 900, color: "#0f172a" },
  desc: { margin: 0, color: "#475569" },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  toolbar: { display: "grid", gap: 12, marginBottom: 16 },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "0 14px" },
  searchInput: { width: "100%", height: 52, border: "none", outline: "none", background: "transparent", fontSize: 14 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 },
  statCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16 },
  statValue: { fontSize: 24, fontWeight: 900, color: "#0f172a" },
  statLabel: { fontSize: 13, color: "#64748b", marginTop: 4 },
  success: { display: "inline-flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 12, borderRadius: 14, fontWeight: 700 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12, borderRadius: 14, fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 16, alignItems: "start" },
  listCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20 },
  formCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20 },
  sectionTitle: { marginTop: 0, marginBottom: 8, fontSize: 20, fontWeight: 900, color: "#0f172a" },
  formDesc: { margin: 0, color: "#64748b", fontSize: 13 },
  list: { display: "grid", gap: 12 },
  row: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#f8fafc" },
  rowTitle: { fontWeight: 800, color: "#0f172a" },
  rowMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  iconBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, padding: "10px 12px", background: "#dbeafe", color: "#1d4ed8", cursor: "pointer", fontWeight: 800 },
  dangerBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, padding: "10px 12px", background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontWeight: 800 },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 800 },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#e2e8f0", color: "#0f172a", cursor: "pointer", fontWeight: 800 },
  stepBar: { display: "flex", gap: 8, flexWrap: "wrap" },
  stepChip: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  stepChipActive: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #bfdbfe", background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  formHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" },
  sectionPanel: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 20, padding: 16 },
  sectionHint: { marginBottom: 14 },
  sectionHintTitle: { fontWeight: 900, color: "#0f172a", marginBottom: 4 },
  sectionHintDesc: { color: "#64748b", fontSize: 13, lineHeight: 1.6 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 800, color: "#334155" },
  input: { height: 46, borderRadius: 14, border: "1px solid #dbe3ee", padding: "0 14px", outline: "none", background: "#fff" },
  textarea: { borderRadius: 14, border: "1px solid #dbe3ee", padding: 14, outline: "none", background: "#fff", fontFamily: "inherit" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  formActions: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" },
  wizardActions: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" },
  dynamicList: { display: "grid", gap: 12 },
  dynamicListActions: { display: "flex", justifyContent: "flex-end" },
  addBtn: { border: "none", background: "#dbeafe", color: "#1d4ed8", fontWeight: 800, borderRadius: 12, padding: "10px 12px", cursor: "pointer" },
  itemCard: { display: "grid", gridTemplateColumns: "1fr 1.4fr auto auto", gap: 12, alignItems: "end", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  timelineRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  faqRow: { display: "grid", gap: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  checkField: { display: "flex", flexDirection: "column", gap: 6 },
  removeBtn: { border: "none", background: "#fee2e2", color: "#b91c1c", fontWeight: 800, borderRadius: 12, padding: "12px 12px", cursor: "pointer" },
};
