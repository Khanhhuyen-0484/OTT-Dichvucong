import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  ArrowLeft,
  Search,
  ShieldCheck,
  Sparkles,
  BadgeCheck
} from "lucide-react";
import {
  getApiErrorMessage,
  getServiceById,
  mockPaymentComplete,
  presignAttachmentUpload,
  submitServiceApplication,
  verifyPaymentStatus
} from "../lib/api";
import { uploadToS3 } from "../lib/uploadToS3.js";

import momo1 from "../assets/payment-qrs/momo_a1.jpg";
import momo2 from "../assets/payment-qrs/momo_a2.jpg";
import momo3 from "../assets/payment-qrs/momo_a3.jpg";
import zalopay1 from "../assets/payment-qrs/zalopay_b1.jpg";
import zalopay2 from "../assets/payment-qrs/zalopayb2.jpg";
import zalopay3 from "../assets/payment-qrs/zalopay_b3.jpg";

const defaultTimeline = ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"];
const defaultFaq = [
  { q: "Hồ sơ thiếu giấy tờ thì sao?", a: "Hệ thống sẽ báo danh sách giấy tờ còn thiếu để bạn bổ sung." },
  { q: "Có thể thanh toán online không?", a: "Có. Bạn có thể thanh toán qua VNPay hoặc MoMo theo cấu hình hệ thống." },
  { q: "Mất bao lâu để xử lý?", a: "Thời gian xử lý phụ thuộc từng thủ tục và sẽ hiển thị trong phần thông tin dịch vụ." }
];
const demoServices = {
  "demo-ho-tich": { name: "Đăng ký khai sinh", description: "Nộp hồ sơ khai sinh trực tuyến, theo dõi trạng thái và nhận thông báo xử lý.", categoryName: "Hộ tịch", processingTime: "3 ngày làm việc", fee: 0, documents: [{ key: "idCard", label: "CCCD/CMND người nộp", required: true }, { key: "birthCert", label: "Giấy chứng sinh", required: true }], timeline: defaultTimeline, faq: defaultFaq },
  "demo-dat-dai": { name: "Đăng ký biến động đất đai", description: "Thực hiện tiếp nhận hồ sơ, đính kèm giấy tờ và theo dõi tiến độ xử lý.", categoryName: "Đất đai", processingTime: "5 ngày làm việc", fee: 20000, documents: [{ key: "landPaper", label: "Giấy chứng nhận quyền sử dụng đất", required: true }, { key: "requestForm", label: "Đơn đăng ký biến động", required: true }], timeline: defaultTimeline, faq: defaultFaq },
  "demo-xay-dung": { name: "Xin cấp phép xây dựng", description: "Tra cứu điều kiện, giấy tờ cần nộp và thanh toán phí dịch vụ trực tuyến.", categoryName: "Xây dựng", processingTime: "7 ngày làm việc", fee: 50000, documents: [{ key: "landPaper", label: "Giấy tờ đất", required: true }, { key: "design", label: "Bản vẽ thiết kế", required: true }], timeline: defaultTimeline, faq: defaultFaq },
  "demo-gplx": { name: "Đổi giấy phép lái xe", description: "Điền form, tải file hồ sơ và nhận mã tra cứu sau khi nộp.", categoryName: "Giao thông", processingTime: "4 ngày làm việc", fee: 150000, documents: [{ key: "oldLicense", label: "Giấy phép lái xe cũ", required: true }, { key: "health", label: "Giấy khám sức khỏe", required: true }], timeline: defaultTimeline, faq: defaultFaq },
  "demo-ho-chieu": { name: "Cấp hộ chiếu phổ thông", description: "Hỗ trợ nộp hồ sơ online và thanh toán lệ phí theo quy trình điện tử.", categoryName: "Hộ chiếu", processingTime: "8 ngày làm việc", fee: 200000, documents: [{ key: "photo", label: "Ảnh chân dung", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: defaultTimeline, faq: defaultFaq },
  "demo-doanh-nghiep": { name: "Đăng ký thành lập doanh nghiệp", description: "Quản lý biểu mẫu, giấy tờ và trạng thái xử lý hồ sơ doanh nghiệp.", categoryName: "Doanh nghiệp", processingTime: "3-5 ngày làm việc", fee: 100000, documents: [{ key: "charter", label: "Điều lệ công ty", required: true }, { key: "memberList", label: "Danh sách thành viên/cổ đông", required: true }], timeline: defaultTimeline, faq: defaultFaq }
};

export default function ServiceWizard() {
  const { serviceId } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [submitResult, setSubmitResult] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("MoMo");
  const pollRef = useRef(null);
  const [formData, setFormData] = useState({ fullName: "", citizenId: "", email: "", phone: "", address: "", note: "" });
  const [formErrors, setFormErrors] = useState({});
  const [fileItems, setFileItems] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadService() {
      try {
        const { data } = await getServiceById(serviceId);
        setService(data);
      } catch (e) {
        const demo = demoServices[serviceId];
        if (demo) setService({ serviceId, id: serviceId, ...demo });
        else setError(getApiErrorMessage(e) || "Không tìm thấy dịch vụ");
      } finally {
        setLoading(false);
      }
    }
    loadService();
  }, [serviceId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const docs = useMemo(() => service?.documents || [], [service]);
  const feeText = useMemo(() => new Intl.NumberFormat("vi-VN").format(service?.fee || 0) + " VNĐ", [service]);
  const timeline = useMemo(() => service?.timeline?.length ? service.timeline : defaultTimeline, [service]);
  const faq = useMemo(() => service?.faq?.length ? service.faq : defaultFaq, [service]);
  const qrImage = useMemo(() => {
    const idx = String(serviceId || "1").match(/\d+/)?.[0] || "1";
    const n = ((Number(idx) - 1) % 3) + 1;
    return paymentMethod === "MoMo" ? [momo1, momo2, momo3][n - 1] : [zalopay1, zalopay2, zalopay3][n - 1];
  }, [serviceId, paymentMethod]);

  function validateField(name, value) {
    if (name === "fullName" && !value.trim()) return "Họ tên là bắt buộc";
    if (name === "citizenId" && !/^\d{9,12}$/.test(value)) return "CCCD/CMND phải từ 9 đến 12 số";
    if (name === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Email không đúng định dạng";
    if (name === "phone" && !/^\d{10,11}$/.test(value)) return "Số điện thoại không hợp lệ";
    if (name === "address" && !value.trim()) return "Địa chỉ là bắt buộc";
    return "";
  }
  function onChange(e) { const { name, value } = e.target; setFormData((p) => ({ ...p, [name]: value })); setFormErrors((p) => ({ ...p, [name]: validateField(name, value) })); }
  function validateForm() { const next = {}; ["fullName", "citizenId", "address", "phone"].forEach((k) => { const msg = validateField(k, formData[k] || ""); if (msg) next[k] = msg; }); if (formData.email) { const msg = validateField("email", formData.email); if (msg) next.email = msg; } const missing = docs.filter((d) => d.required && !fileItems[d.key]); if (missing.length) next.files = "Thiếu giấy tờ bắt buộc"; setFormErrors(next); return Object.keys(next).length === 0; }
  function onPickFile(key, file) { if (!file) return; setFileItems((p) => ({ ...p, [key]: { file, name: file.name, type: file.type, previewUrl: URL.createObjectURL(file) } })); }

  async function onSubmit() {
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const uploaded = [];
      for (const [key, item] of Object.entries(fileItems)) {
        const safeContentType = item.type || "application/octet-stream";
        const safeKey = `chat-media/${serviceId || "service"}/${key}-${Date.now()}-${item.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const presignRes = await presignAttachmentUpload({ key: safeKey, contentType: safeContentType, fileName: item.name, applicationId: "new", docKey: key });
        await uploadToS3(item.file); // fallback-friendly upload
        uploaded.push({ key, name: item.name, previewUrl: presignRes.data?.publicUrl || item.previewUrl, type: item.type });
      }
      const payload = { serviceId: service?.serviceId || service?.id || serviceId, formData: { fullName: formData.fullName, citizenId: formData.citizenId, email: formData.email, phone: formData.phone, address: formData.address, requestContent: formData.note }, paymentMethod, attachments: uploaded };
      const { data } = await submitServiceApplication(payload);
      setSubmitResult(data);
      setPaymentExpireAt(new Date(Date.now() + 60 * 60 * 1000).toISOString());
      setPaymentStatus("PENDING");
      setStep(2);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => { try { const { data: st } = await verifyPaymentStatus(data.applicationCode); setPaymentStatus(st.paymentStatus || "PENDING"); if (st.paymentStatus === "PAID") { clearInterval(pollRef.current); setStep(4); } } catch {} }, 3000);
    } catch (e) { alert(getApiErrorMessage(e)); } finally { setSubmitting(false); }
  }

  async function onMockPaid() { if (!submitResult?.applicationCode) return; await mockPaymentComplete(submitResult.applicationCode); setPaymentStatus("PAID"); if (pollRef.current) clearInterval(pollRef.current); setStep(4); }

  if (loading) return <PageShell>Đang tải dữ liệu dịch vụ...</PageShell>;
  if (error) return <PageShell>Không tìm thấy dịch vụ</PageShell>;
  if (!service) return <PageShell>Không tìm thấy dịch vụ</PageShell>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.breadcrumb}><Link to="/" style={styles.breadcrumbLink}><ArrowLeft size={14} /> Trang chủ</Link><span>/</span><Link to="/services" style={styles.breadcrumbLink}>Dịch vụ</Link><span>/</span><span>{service.name}</span></div>
        <div style={styles.hero}><div style={styles.heroLeft}><span style={styles.badge}><Sparkles size={14} /> Dịch vụ công trực tuyến</span><h1 style={styles.title}>{service.name}</h1><p style={styles.subtitle}>{service.description || "Chi tiết quy trình, hồ sơ và thanh toán được hiển thị đầy đủ bên dưới."}</p><div style={styles.metaRow}><Meta icon={Clock3} label={service.processingTime || "Đang cập nhật"} /><Meta icon={BadgeCheck} label={feeText} /><Meta icon={ShieldCheck} label={service.categoryName || service.category || "Hành chính công"} /></div></div><div style={styles.heroRight}><div style={styles.progressCard}><div style={{ fontWeight: 800, marginBottom: 8 }}>Tiến trình dịch vụ</div>{timeline.map((item, idx) => <div key={item} style={styles.timelineItem}><div style={styles.timelineDot}>{idx + 1}</div><div>{item}</div></div>)}</div></div></div>
        <div style={styles.grid}><div style={styles.mainCol}><SectionTitle icon={FileText} title="Giấy tờ cần nộp" /><div style={styles.card}>{docs.length ? docs.map((doc) => <div key={doc.key} style={styles.docRow}><div><div style={{ fontWeight: 700 }}>{doc.label}</div><div style={{ color: "#64748b", fontSize: 13 }}>{doc.required ? "Bắt buộc" : "Tùy chọn"}</div></div>{doc.required ? <span style={styles.req}>Bắt buộc</span> : <span style={styles.opt}>Tùy chọn</span>}</div>) : <div style={{ color: "#64748b" }}>Chưa có danh sách giấy tờ.</div>}</div><SectionTitle icon={Info} title="Câu hỏi thường gặp" /><div style={styles.card}>{faq.map((item) => <details key={item.q} style={styles.faqItem}><summary style={styles.faqQ}>{item.q}</summary><div style={styles.faqA}>{item.a}</div></details>)}</div></div><div style={styles.sideCol}>{step === 1 && <div style={styles.card}><SectionTitle icon={Search} title="Nộp hồ sơ online" /><div style={styles.formGrid}><Input label="Họ tên" name="fullName" value={formData.fullName} onChange={onChange} error={formErrors.fullName} /><Input label="CCCD" name="citizenId" value={formData.citizenId} onChange={onChange} error={formErrors.citizenId} /><Input label="Email" name="email" value={formData.email} onChange={onChange} error={formErrors.email} /><Input label="Số điện thoại" name="phone" value={formData.phone} onChange={onChange} error={formErrors.phone} /><Input label="Địa chỉ" name="address" value={formData.address} onChange={onChange} error={formErrors.address} fullWidth /><Textarea label="Ghi chú" name="note" value={formData.note} onChange={onChange} /></div><div style={styles.uploadList}>{docs.map((doc) => <label key={doc.key} style={styles.uploadBox}><div style={{ fontWeight: 700 }}>{doc.label} {doc.required && <span style={{ color: "#dc2626" }}>*</span>}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Chọn file để upload và xem preview ngay</div><input type="file" onChange={(e) => onPickFile(doc.key, e.target.files?.[0])} style={{ marginTop: 10 }} />{fileItems[doc.key] && <div style={{ marginTop: 10 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{fileItems[doc.key].name}</div>{fileItems[doc.key].type?.startsWith("image/") && <img src={fileItems[doc.key].previewUrl} alt="preview" style={styles.preview} />}</div>}</label>)}</div>{formErrors.files && <div style={styles.error}>{formErrors.files}</div>}<div style={styles.actions}><button type="button" style={styles.primaryBtn} onClick={onSubmit} disabled={submitting}>{submitting ? "Đang xử lý..." : "Nộp hồ sơ"}</button></div></div>}{step === 2 && <div style={styles.card}><SectionTitle icon={Sparkles} title="Thanh toán phí dịch vụ" /><div style={styles.paymentBox}><div style={{ color: "#64748b", fontSize: 13 }}>Mã hồ sơ</div><div style={{ fontWeight: 800, fontSize: 18 }}>{submitResult?.applicationCode}</div><div style={{ marginTop: 10 }}>Trạng thái: <strong>{paymentStatus}</strong></div><div style={{ marginTop: 10 }}>Hạn thanh toán: <strong>{paymentExpireAt ? new Date(paymentExpireAt).toLocaleString("vi-VN") : "-"}</strong></div></div><div style={{ marginTop: 14 }}><label style={styles.label}>Phương thức thanh toán</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={styles.select}><option>MoMo</option><option>VNPay</option></select></div><img src={qrImage} alt="payment qr" style={styles.qr} /><div style={styles.actions}><button type="button" style={styles.secondaryBtn} onClick={() => setStep(1)}>Quay lại</button><button type="button" style={styles.primaryBtn} onClick={() => setStep(3)}>Xác nhận thanh toán</button></div><button type="button" onClick={onMockPaid} style={styles.mockBtn}>Đánh dấu thanh toán thành công (demo)</button></div>}{step === 3 && <div style={styles.card}><SectionTitle icon={CheckCircle2} title="Chờ xử lý hồ sơ" /><div style={styles.successBox}><div style={{ fontWeight: 800 }}>Thanh toán thành công</div><div>Mã hồ sơ: {submitResult?.applicationCode}</div><div style={{ marginTop: 8, color: "#64748b" }}>Hồ sơ đã được lưu và sẵn sàng chuyển sang trạng thái xử lý.</div></div><div style={{ marginTop: 14 }}><Link to="/services" style={styles.linkBtn}>Quay về danh sách dịch vụ</Link></div></div>}{step === 4 && <div style={styles.card}><SectionTitle icon={BadgeCheck} title="Kết quả" /><div style={styles.successBox}><div style={{ fontWeight: 800 }}>Hoàn tất</div><div>Mã hồ sơ: {submitResult?.applicationCode}</div><div style={{ marginTop: 8, color: "#64748b" }}>Bạn có thể dùng mã này để tra cứu hồ sơ sau này.</div></div><div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}><Link to="/services" style={styles.linkBtn}>Danh sách dịch vụ</Link><Link to="/" style={styles.linkBtnSecondary}>Trang chủ</Link></div></div>}</div></div>
      </div>
    </div>
  );
}

function PageShell({ children }) { return <div style={styles.page}><div style={{ maxWidth: 960, margin: "0 auto", background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>{children}</div></div>; }
function SectionTitle({ icon: Icon, title }) { return <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><Icon size={18} color="#1d4ed8" /><h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{title}</h2></div>; }
function Meta({ icon: Icon, label }) { return <div style={styles.meta}><Icon size={14} /><span>{label}</span></div>; }
function Input({ label, name, value, onChange, error, fullWidth = false }) { return <label style={fullWidth ? { ...styles.field, gridColumn: "1 / -1" } : styles.field}><span style={styles.label}>{label}</span><input name={name} value={value} onChange={onChange} style={{ ...styles.input, borderColor: error ? "#ef4444" : "#dbe3ee" }} />{error ? <span style={styles.error}>{error}</span> : null}</label>; }
function Textarea({ label, name, value, onChange }) { return <label style={{ ...styles.field, gridColumn: "1 / -1" }}><span style={styles.label}>{label}</span><textarea name={name} value={value} onChange={onChange} rows={4} style={styles.textarea} /></label>; }
const styles = { page:{minHeight:"100vh",background:"linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)",padding:24}, container:{maxWidth:1240,margin:"0 auto"}, breadcrumb:{display:"flex",gap:8,alignItems:"center",color:"#64748b",fontSize:13,marginBottom:16,flexWrap:"wrap"}, breadcrumbLink:{display:"inline-flex",gap:6,alignItems:"center",color:"#1d4ed8",textDecoration:"none",fontWeight:700}, hero:{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:16,marginBottom:20}, heroLeft:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:24,padding:24,boxShadow:"0 10px 30px rgba(15,23,42,.05)"}, heroRight:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:24,padding:24}, badge:{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:999,background:"#eff6ff",color:"#1d4ed8",fontSize:12,fontWeight:800}, title:{margin:"14px 0 8px",fontSize:34,fontWeight:900,color:"#0f172a"}, subtitle:{margin:0,color:"#475569",lineHeight:1.7,maxWidth:760}, metaRow:{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}, meta:{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:999,background:"#f8fafc",border:"1px solid #e2e8f0",color:"#334155",fontSize:13,fontWeight:700}, progressCard:{background:"#f8fafc",borderRadius:20,padding:18,border:"1px solid #e2e8f0"}, timelineItem:{display:"flex",alignItems:"center",gap:10,marginTop:10,color:"#334155",fontWeight:600}, timelineDot:{width:26,height:26,borderRadius:999,background:"#1d4ed8",color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}, grid:{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:16}, mainCol:{display:"flex",flexDirection:"column",gap:16}, sideCol:{display:"flex",flexDirection:"column",gap:16}, card:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:24,padding:20,boxShadow:"0 8px 24px rgba(15,23,42,.04)"}, docRow:{display:"flex",justifyContent:"space-between",gap:12,padding:"14px 0",borderBottom:"1px solid #eef2f7"}, req:{background:"#dcfce7",color:"#166534",padding:"4px 10px",borderRadius:999,fontSize:12,fontWeight:800,alignSelf:"center"}, opt:{background:"#eff6ff",color:"#1d4ed8",padding:"4px 10px",borderRadius:999,fontSize:12,fontWeight:800,alignSelf:"center"}, faqItem:{padding:"10px 0",borderBottom:"1px solid #eef2f7"}, faqQ:{cursor:"pointer",fontWeight:800,color:"#0f172a"}, faqA:{marginTop:8,color:"#475569",lineHeight:1.6}, formGrid:{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:12}, field:{display:"flex",flexDirection:"column",gap:6}, label:{fontSize:13,fontWeight:800,color:"#334155"}, input:{height:46,borderRadius:14,border:"1px solid #dbe3ee",padding:"0 14px",outline:"none",background:"#fff"}, textarea:{borderRadius:14,border:"1px solid #dbe3ee",padding:14,outline:"none",background:"#fff",fontFamily:"inherit"}, uploadList:{display:"grid",gap:12,marginTop:14}, uploadBox:{display:"block",border:"1px dashed #cbd5e1",borderRadius:18,padding:14,background:"#f8fafc"}, preview:{width:"100%",maxWidth:220,marginTop:10,borderRadius:12,border:"1px solid #e2e8f0"}, error:{color:"#dc2626",fontSize:13,fontWeight:700,marginTop:6}, actions:{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}, primaryBtn:{background:"#1d4ed8",color:"#fff",border:"none",borderRadius:14,padding:"12px 18px",fontWeight:800,cursor:"pointer"}, secondaryBtn:{background:"#e2e8f0",color:"#0f172a",border:"none",borderRadius:14,padding:"12px 18px",fontWeight:800,cursor:"pointer"}, mockBtn:{marginTop:12,background:"#0f172a",color:"#fff",border:"none",borderRadius:14,padding:"12px 18px",fontWeight:800,cursor:"pointer"}, paymentBox:{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:18,padding:14}, qr:{width:"100%",maxWidth:320,display:"block",margin:"16px auto 0",borderRadius:20,border:"1px solid #e2e8f0"}, successBox:{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#166534",borderRadius:18,padding:16,lineHeight:1.7}, linkBtn:{display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#1d4ed8",color:"#fff",textDecoration:"none",borderRadius:14,padding:"12px 18px",fontWeight:800}, linkBtnSecondary:{display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#e2e8f0",color:"#0f172a",textDecoration:"none",borderRadius:14,padding:"12px 18px",fontWeight:800} };
