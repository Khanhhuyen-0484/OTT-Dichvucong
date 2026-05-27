import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createService, getAdminServiceCategories, getApiErrorMessage, seedAdminServiceCategories, seedServices, updateService } from "../lib/api";
import { ArrowLeft, BadgeCheck, CircleHelp, Eye, FileText, Layers3, Save, ShieldCheck, Sparkles, Trash2, Workflow } from "lucide-react";

const WORKFLOW_STEPS = ["PENDING", "PROCESSING", "NEED_MORE", "COMPLETED", "REJECTED"];
const WORKFLOW_LABELS = { PENDING: "Chờ tiếp nhận", PROCESSING: "Đang xử lý", NEED_MORE: "Yêu cầu bổ sung", COMPLETED: "Hoàn thành", REJECTED: "Từ chối" };
const emptyForm = { name: "", categoryId: "", categoryName: "", description: "", agency: "", processingTime: "", fee: 0, level: "Mức 3", active: false, documents: [{ label: "", required: true }], workflow: WORKFLOW_STEPS.map((status) => ({ status, description: "" })), faq: [{ q: "", a: "" }] };

function normalizeDocuments(value) { if (!Array.isArray(value) || value.length === 0) return [{ label: "", required: true }]; return value.map((item) => ({ label: String(item?.label || item?.name || item?.title || ""), required: item?.required !== false })); }
function normalizeFaq(value) { if (!Array.isArray(value) || value.length === 0) return [{ q: "", a: "" }]; return value.map((item) => ({ q: String(item?.q || item?.question || ""), a: String(item?.a || item?.answer || "") })); }
function normalizeWorkflow(value) { const input = Array.isArray(value) ? value : []; return WORKFLOW_STEPS.map((status, index) => { const found = input.find((item) => String(item?.status || "").toUpperCase() === status) || input[index] || {}; return { status, description: String(found?.description || found?.label || found?.note || "") }; }); }
function Section({ title, icon: Icon, subtitle, children, right }) { return <section style={styles.sectionCard}><div style={styles.sectionHeader}><div><div style={styles.sectionKicker}><Icon size={14} /> {title}</div>{subtitle ? <div style={styles.sectionSubtitle}>{subtitle}</div> : null}</div>{right || null}</div>{children}</section>; }
function Field({ label, value, onChange, type = "text", placeholder, rows, fullWidth = false, disabled = false, children }) { const wrapperStyle = fullWidth ? { ...styles.field, gridColumn: "1 / -1" } : styles.field; return <label style={wrapperStyle}><span style={styles.label}>{label}</span>{children || (type === "textarea" ? <textarea rows={rows || 4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={styles.textarea} disabled={disabled} /> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={styles.input} disabled={disabled} />)}</label>; }
function Toggle({ checked, onChange, label }) { return <label style={styles.toggleRow}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>; }
function MetaItem({ label, value }) { return <div style={styles.metaItem}><div style={styles.metaLabel}>{label}</div><div style={styles.metaValue}>{value}</div></div>; }
function Preview({ form }) { return <div style={styles.previewWrap}><div style={styles.previewHeader}><div><div style={styles.previewKicker}><Eye size={14} /> Preview người dân</div><div style={styles.previewTitle}>{form.name || "Tên dịch vụ sẽ hiển thị ở đây"}</div><div style={styles.previewSub}>{form.agency || "Cơ quan xử lý"} • {form.categoryName || "Danh mục"}</div></div><div style={styles.previewBadge}>{form.level || "Mức 3"}</div></div><div style={styles.previewHero}><div style={styles.previewHeroTag}><ShieldCheck size={14} /> Dịch vụ công trực tuyến</div><div style={styles.previewHeroDesc}>{form.description || "Mô tả dịch vụ sẽ hiển thị rõ ràng cho người dân trước khi nộp hồ sơ."}</div><div style={styles.previewMetaGrid}><MetaItem label="Thời gian xử lý" value={form.processingTime || "Đang cập nhật"} /><MetaItem label="Lệ phí" value={`${new Intl.NumberFormat("vi-VN").format(Number(form.fee || 0))} VNĐ`} /><MetaItem label="Trạng thái xuất bản" value={form.active ? "Đã xuất bản" : "Lưu nháp"} /></div></div><div style={styles.previewBlock}><div style={styles.previewBlockTitle}><FileText size={14} /> Hồ sơ yêu cầu</div><div style={styles.previewList}>{(form.documents || []).filter((d) => String(d.label || "").trim()).map((doc, index) => <div key={`doc-preview-${index}`} style={styles.previewListItem}><div><strong>{doc.label}</strong></div><span style={doc.required ? styles.requiredChip : styles.optionalChip}>{doc.required ? "Bắt buộc" : "Không bắt buộc"}</span></div>)}{(form.documents || []).filter((d) => String(d.label || "").trim()).length === 0 ? <div style={styles.previewEmpty}>Chưa có giấy tờ yêu cầu.</div> : null}</div></div><div style={styles.previewBlock}><div style={styles.previewBlockTitle}><Workflow size={14} /> Quy trình xử lý</div><div style={styles.stepList}>{(form.workflow || []).map((item) => <div key={`step-${item.status}`} style={styles.stepItem}><div style={styles.stepDot} /><div><div style={styles.stepTitle}>{WORKFLOW_LABELS[item.status]}</div><div style={styles.stepDesc}>{item.description || "Mô tả bước xử lý"}</div></div></div>)}</div></div><div style={styles.previewBlock}><div style={styles.previewBlockTitle}><CircleHelp size={14} /> FAQ</div><div style={styles.faqPreview}>{(form.faq || []).filter((f) => String(f.q || f.a || "").trim()).map((item, index) => <div key={`faq-preview-${index}`} style={styles.faqPreviewItem}><div style={styles.faqQ}>{item.q}</div><div style={styles.faqA}>{item.a}</div></div>)}{(form.faq || []).filter((f) => String(f.q || f.a || "").trim()).length === 0 ? <div style={styles.previewEmpty}>Chưa có FAQ.</div> : null}</div></div></div>; }

export default function AdminCreateService() {
  const navigate = useNavigate();
  const location = useLocation();
  const editingService = location.state?.service || null;
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => (editingService ? { name: editingService.name || "", categoryId: editingService.categoryId || "", categoryName: editingService.categoryName || editingService.category || "", description: editingService.description || "", agency: editingService.agency || editingService.department || "", processingTime: editingService.processingTime || "", fee: editingService.fee || 0, level: editingService.level || "Mức 3", active: editingService.active !== false, documents: normalizeDocuments(editingService.documents || []), workflow: normalizeWorkflow(editingService.workflow || editingService.timeline || []), faq: normalizeFaq(editingService.faq || []) } : emptyForm));

  useEffect(() => { (async () => { try { const res = await getAdminServiceCategories(); setCategories(res.data?.categories || []); } catch (e) { setError(getApiErrorMessage(e)); } })(); }, []);

  const updateDocument = (index, key, value) => setForm((prev) => ({ ...prev, documents: prev.documents.map((doc, i) => (i === index ? { ...doc, [key]: value } : doc)) }));
  const updateWorkflow = (index, key, value) => setForm((prev) => ({ ...prev, workflow: prev.workflow.map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));
  const updateFaq = (index, key, value) => setForm((prev) => ({ ...prev, faq: prev.faq.map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));

  const save = async (publish = true) => {
    setSaving(true); setError("");
    try {
      const category = categories.find((c) => String(c.id) === String(form.categoryId));
      const payload = { name: form.name.trim(), categoryId: form.categoryId.trim(), categoryName: category?.name || "", agency: form.agency.trim(), processingTime: form.processingTime.trim(), fee: Number(form.fee || 0), level: form.level.trim(), description: form.description.trim(), active: publish, documents: (form.documents || []).filter((doc) => String(doc.label || "").trim()).map((doc) => ({ label: String(doc.label || "").trim(), required: doc.required !== false })), timeline: (form.workflow || []).map((item) => ({ status: item.status, description: String(item.description || "").trim() })), workflow: (form.workflow || []).map((item) => ({ status: item.status, description: String(item.description || "").trim() })), faq: (form.faq || []).filter((item) => String(item.q || item.a || "").trim()).map((item) => ({ q: String(item.q || "").trim(), a: String(item.a || "").trim() })) };
      if (!payload.name) throw new Error("Tên dịch vụ là bắt buộc");
      if (!payload.categoryId) throw new Error("Danh mục là bắt buộc");
      if (!payload.agency) throw new Error("Cơ quan xử lý là bắt buộc");
      if (!payload.processingTime) throw new Error("Thời gian xử lý không được để trống");
      if (Number.isNaN(payload.fee) || payload.fee < 0) throw new Error("Lệ phí phải lớn hơn hoặc bằng 0");

      const result = editingService ? await updateService(editingService.serviceId || editingService.id, payload) : await createService(payload);
      const generatedCode = result.data?.serviceId || result.data?.service?.serviceId || result.data?.service?.id;
      navigate("/admin/services", { replace: true, state: { message: generatedCode ? `Tạo dịch vụ thành công: ${generatedCode}` : "Tạo dịch vụ thành công" } });
    } catch (e) { setError(getApiErrorMessage(e)); } finally { setSaving(false); }
  };

  return <div style={styles.page}><div style={styles.container}><div style={styles.topBar}><div><div style={styles.badge}><Sparkles size={12} /> Admin dịch vụ công</div><h1 style={styles.title}>{editingService ? "Chỉnh sửa dịch vụ công" : "Tạo mới dịch vụ công"}</h1><p style={styles.desc}>Trang tạo mới riêng biệt, full width, tối ưu cho thao tác nhập dịch vụ từ đầu.</p></div><div style={styles.topActions}><button type="button" onClick={() => navigate("/admin/services")} style={styles.secondaryBtn}><ArrowLeft size={16} /> Quay lại</button><button type="button" onClick={async () => { setSaving(true); try { await seedAdminServiceCategories(); const res = await getAdminServiceCategories(); setCategories(res.data?.categories || []); setMessage("Đã seed danh mục mặc định"); } catch (e) { setError(getApiErrorMessage(e)); } finally { setSaving(false); } }} style={styles.secondaryBtn}>Seed dữ liệu</button></div></div>{message ? <div style={styles.success}>{message}</div> : null}{error ? <div style={styles.error}>{error}</div> : null}<div style={styles.fullGrid}><section style={styles.sectionCard}><div style={styles.sectionHeader}><div><div style={styles.sectionKicker}><Layers3 size={14} /> Thông tin chung</div><div style={styles.sectionSubtitle}>Khai báo thông tin nền tảng của dịch vụ để hiển thị trên cổng người dân.</div></div></div><div style={styles.formGrid}><Field label="Tên dịch vụ" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="vd: Đăng ký kết hôn" /><Field label="Danh mục" value={form.categoryId} onChange={(v) => setForm((p) => ({ ...p, categoryId: v }))} fullWidth><select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} style={styles.input}><option value="">-- Chọn danh mục --</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></Field><Field label="Cơ quan xử lý" value={form.agency} onChange={(v) => setForm((p) => ({ ...p, agency: v }))} placeholder="vd: UBND cấp xã" /><Field label="Thời gian xử lý" value={form.processingTime} onChange={(v) => setForm((p) => ({ ...p, processingTime: v }))} placeholder="vd: 03 ngày làm việc" /><Field label="Lệ phí" type="number" value={form.fee} onChange={(v) => setForm((p) => ({ ...p, fee: v }))} placeholder="0" /><Field label="Mức độ dịch vụ" value={form.level} onChange={(v) => setForm((p) => ({ ...p, level: v }))} placeholder="Mức 3 / Mức 4" /><Field label="Mô tả" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} type="textarea" rows={5} fullWidth placeholder="Mô tả ngắn gọn, dễ đọc cho người dân" /></div></section><section style={styles.sectionCard}><div style={styles.sectionHeader}><div><div style={styles.sectionKicker}><FileText size={14} /> Hồ sơ yêu cầu</div><div style={styles.sectionSubtitle}>Khai báo từng loại giấy tờ, không nhập mã tay.</div></div><button type="button" onClick={() => setForm((p) => ({ ...p, documents: [...p.documents, { label: "", required: true }] }))} style={styles.addBtn}>+ Thêm giấy tờ</button></div><div style={styles.dynamicList}>{form.documents.map((doc, index) => <div key={`doc-${index}`} style={styles.itemCard}><Field label="Tên giấy tờ" value={doc.label} onChange={(v) => updateDocument(index, "label", v)} placeholder="vd: CCCD/CMND" /><label style={styles.toggleRow}><input type="checkbox" checked={doc.required !== false} onChange={(e) => updateDocument(index, "required", e.target.checked)} /><span>{doc.required !== false ? "Bắt buộc" : "Không bắt buộc"}</span></label><button type="button" onClick={() => setForm((p) => ({ ...p, documents: p.documents.filter((_, i) => i !== index) }))} style={styles.removeBtn}><Trash2 size={16} /> Xóa</button></div>)}</div></section><section style={styles.sectionCard}><div style={styles.sectionHeader}><div><div style={styles.sectionKicker}><Workflow size={14} /> Quy trình xử lý</div><div style={styles.sectionSubtitle}>Workflow mặc định của hồ sơ dịch vụ công. Không nhập mã bước tay.</div></div></div><div style={styles.workflowList}>{form.workflow.map((item, index) => <div key={item.status} style={styles.workflowCard}><div style={styles.workflowHeaderRow}><div style={styles.workflowStatus}>{WORKFLOW_LABELS[item.status]}</div></div><Field label="Mô tả từng bước" value={item.description} onChange={(v) => updateWorkflow(index, "description", v)} placeholder={`Mô tả cho bước ${WORKFLOW_LABELS[item.status]}`} /></div>)}</div></section><section style={styles.sectionCard}><div style={styles.sectionHeader}><div><div style={styles.sectionKicker}><CircleHelp size={14} /> FAQ</div><div style={styles.sectionSubtitle}>Thêm câu hỏi và câu trả lời, mã FAQ sẽ do backend sinh.</div></div><button type="button" onClick={() => setForm((p) => ({ ...p, faq: [...p.faq, { q: "", a: "" }] }))} style={styles.addBtn}>+ Thêm câu hỏi</button></div><div style={styles.dynamicList}>{form.faq.map((item, index) => <div key={`${index}-${item.q || "faq"}`} style={styles.faqCard}><Field label={`Câu hỏi ${index + 1}`} value={item.q} onChange={(v) => updateFaq(index, "q", v)} placeholder="Người dân thường hỏi gì?" /><Field label="Trả lời" value={item.a} onChange={(v) => updateFaq(index, "a", v)} type="textarea" rows={4} placeholder="Trả lời ngắn gọn, rõ ràng" fullWidth /><div style={styles.faqActions}><button type="button" onClick={() => setForm((p) => ({ ...p, faq: p.faq.filter((_, i) => i !== index) }))} style={styles.removeBtn}><Trash2 size={16} /> Xóa</button></div></div>)}</div></section><section style={styles.sectionCard}><div style={styles.sectionHeader}><div><div style={styles.sectionKicker}><Eye size={14} /> Preview</div><div style={styles.sectionSubtitle}>Xem giao diện dịch vụ như người dân sẽ thấy trên cổng dịch vụ công.</div></div></div><Preview form={form} /></section><div style={styles.actionBar}><button type="button" onClick={() => navigate("/admin/services")} style={styles.secondaryBtn}><ArrowLeft size={16} /> Quay lại</button><button type="button" onClick={() => save(false)} disabled={saving} style={styles.draftBtn}><Save size={16} /> Lưu nháp</button><button type="button" onClick={() => save(true)} disabled={saving} style={styles.publishBtn}><BadgeCheck size={16} /> Xuất bản</button></div></div></div></div>;
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)", padding: 24 },
  container: { maxWidth: 1720, margin: "0 auto" },
  topBar: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, marginBottom: 16, boxShadow: "0 10px 30px rgba(15,23,42,.05)" },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  title: { margin: "12px 0 8px", fontSize: 34, fontWeight: 900, color: "#0f172a" },
  desc: { margin: 0, color: "#475569", maxWidth: 900, lineHeight: 1.7 },
  topActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  success: { display: "inline-flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 12, borderRadius: 14, fontWeight: 700, marginBottom: 16 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12, borderRadius: 14, fontWeight: 700, marginBottom: 16 },
  fullGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 16 },
  sectionCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20, boxShadow: "0 10px 30px rgba(15,23,42,.04)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  sectionKicker: { display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 900, color: "#0f172a" },
  sectionSubtitle: { marginTop: 6, color: "#64748b", fontSize: 13, lineHeight: 1.6 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 800, color: "#334155" },
  input: { height: 46, borderRadius: 14, border: "1px solid #dbe3ee", padding: "0 14px", outline: "none", background: "#fff" },
  textarea: { borderRadius: 14, border: "1px solid #dbe3ee", padding: 14, outline: "none", background: "#fff", fontFamily: "inherit" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  toggleRow: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: "12px 14px", minHeight: 46, alignSelf: "end", fontWeight: 800, color: "#334155" },
  dynamicList: { display: "grid", gap: 12 },
  addBtn: { border: "none", background: "#dbeafe", color: "#1d4ed8", fontWeight: 800, borderRadius: 12, padding: "10px 12px", cursor: "pointer" },
  itemCard: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "end", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  workflowList: { display: "grid", gap: 12 },
  workflowCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  workflowHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  workflowStatus: { fontWeight: 900, color: "#0f172a" },
  faqCard: { display: "grid", gap: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  faqActions: { display: "flex", justifyContent: "flex-end" },
  removeBtn: { border: "none", background: "#fee2e2", color: "#b91c1c", fontWeight: 800, borderRadius: 12, padding: "12px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  actionBar: { display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#e2e8f0", color: "#0f172a", cursor: "pointer", fontWeight: 800 },
  draftBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#fff7ed", color: "#c2410c", cursor: "pointer", fontWeight: 800 },
  publishBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 800 },
  previewWrap: { display: "grid", gap: 14 },
  previewHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  previewKicker: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 900, color: "#1d4ed8" },
  previewTitle: { marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" },
  previewSub: { marginTop: 4, fontSize: 13, color: "#64748b" },
  previewBadge: { padding: "8px 12px", borderRadius: 999, background: "#eef2ff", color: "#4338ca", fontWeight: 900, fontSize: 12 },
  previewHero: { background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)", color: "#fff", borderRadius: 20, padding: 18 },
  previewHeroTag: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 900, opacity: .95 },
  previewHeroDesc: { marginTop: 12, lineHeight: 1.7, opacity: .95 },
  previewMetaGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 16 },
  metaItem: { background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: 12 },
  metaLabel: { fontSize: 12, opacity: .8 },
  metaValue: { fontSize: 14, fontWeight: 900, marginTop: 4 },
  previewBlock: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 16 },
  previewBlockTitle: { display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 900, color: "#0f172a" },
  previewList: { display: "grid", gap: 10, marginTop: 12 },
  previewListItem: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 12 },
  previewTiny: { fontSize: 12, color: "#64748b", marginTop: 4 },
  requiredChip: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12, fontWeight: 800 },
  optionalChip: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: "#e2e8f0", color: "#334155", fontSize: 12, fontWeight: 800 },
  previewEmpty: { color: "#64748b", fontSize: 13, padding: 12, textAlign: "center" },
  stepList: { display: "grid", gap: 10, marginTop: 12 },
  stepItem: { display: "flex", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 12 },
  stepDot: { width: 10, height: 10, borderRadius: 999, marginTop: 6, background: "#1d4ed8", boxShadow: "0 0 0 4px #dbeafe" },
  stepTitle: { fontWeight: 900, color: "#0f172a" },
  stepDesc: { marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 1.6 },
  faqPreview: { display: "grid", gap: 10, marginTop: 12 },
  faqPreviewItem: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 12 },
  faqQ: { fontWeight: 900, color: "#0f172a" },
  faqA: { marginTop: 6, color: "#475569", lineHeight: 1.65 },
};
