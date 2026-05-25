import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  CircleCheck,
  CircleDashed,
  CreditCard,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  getApiErrorMessage,
  getServiceById,
  mockPaymentComplete,
  presignAttachmentUpload,
  submitServiceApplication,
  createBankTransferPayment,
  getBankTransferPaymentStatus,
} from "../lib/api";
import { uploadToS3 } from "../lib/uploadToS3.js";

const defaultTimeline = ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"];
const defaultFaq = [
  { q: "Hồ sơ thiếu giấy tờ thì sao?", a: "Hệ thống sẽ báo rõ giấy tờ còn thiếu ngay khi bạn bấm nộp hồ sơ." },
  { q: "Có thể thanh toán online không?", a: "Có. Bạn có thể thanh toán qua MoMo hoặc ZaloPay theo quy trình hiển thị sau khi nộp." },
  { q: "Mất bao lâu để xử lý?", a: "Thời gian xử lý sẽ hiển thị ngay trên trang dịch vụ để bạn dễ theo dõi." },
];

const demoServices = {
  "demo-ho-tich": {
    name: "Đăng ký khai sinh",
    description: "Nộp hồ sơ khai sinh trực tuyến, theo dõi trạng thái và nhận thông báo xử lý.",
    categoryName: "Hộ tịch",
    processingTime: "3 ngày làm việc",
    fee: 0,
    documents: [
      { key: "idCard", label: "CCCD/CMND người nộp", required: true },
      { key: "birthCert", label: "Giấy chứng sinh", required: true },
    ],
    timeline: defaultTimeline,
    faq: defaultFaq,
  },
  "demo-dat-dai": {
    name: "Đăng ký biến động đất đai",
    description: "Thực hiện tiếp nhận hồ sơ, đính kèm giấy tờ và theo dõi tiến độ xử lý.",
    categoryName: "Đất đai",
    processingTime: "5 ngày làm việc",
    fee: 20000,
    documents: [
      { key: "landPaper", label: "Giấy chứng nhận quyền sử dụng đất", required: true },
      { key: "requestForm", label: "Đơn đăng ký biến động", required: true },
    ],
    timeline: defaultTimeline,
    faq: defaultFaq,
  },
  "demo-xay-dung": {
    name: "Xin cấp phép xây dựng",
    description: "Tra cứu điều kiện, giấy tờ cần nộp và thanh toán phí dịch vụ trực tuyến.",
    categoryName: "Xây dựng",
    processingTime: "7 ngày làm việc",
    fee: 50000,
    documents: [
      { key: "landPaper", label: "Giấy tờ đất", required: true },
      { key: "design", label: "Bản vẽ thiết kế", required: true },
    ],
    timeline: defaultTimeline,
    faq: defaultFaq,
  },
  "demo-gplx": {
    name: "Đổi giấy phép lái xe",
    description: "Điền form, tải file hồ sơ và nhận mã tra cứu sau khi nộp.",
    categoryName: "Giao thông",
    processingTime: "4 ngày làm việc",
    fee: 150000,
    documents: [
      { key: "oldLicense", label: "Giấy phép lái xe cũ", required: true },
      { key: "health", label: "Giấy khám sức khỏe", required: true },
    ],
    timeline: defaultTimeline,
    faq: defaultFaq,
  },
  "demo-ho-chieu": {
    name: "Cấp hộ chiếu phổ thông",
    description: "Hỗ trợ nộp hồ sơ online và thanh toán lệ phí theo quy trình điện tử.",
    categoryName: "Hộ chiếu",
    processingTime: "8 ngày làm việc",
    fee: 200000,
    documents: [
      { key: "photo", label: "Ảnh chân dung", required: true },
      { key: "idCard", label: "CCCD/CMND", required: true },
    ],
    timeline: defaultTimeline,
    faq: defaultFaq,
  },
  "demo-doanh-nghiep": {
    name: "Đăng ký thành lập doanh nghiệp",
    description: "Quản lý biểu mẫu, giấy tờ và trạng thái xử lý hồ sơ doanh nghiệp.",
    categoryName: "Doanh nghiệp",
    processingTime: "3-5 ngày làm việc",
    fee: 100000,
    documents: [
      { key: "charter", label: "Điều lệ công ty", required: true },
      { key: "memberList", label: "Danh sách thành viên/cổ đông", required: true },
    ],
    timeline: defaultTimeline,
    faq: defaultFaq,
  },
};

const steps = [
  { id: 1, title: "Chuẩn bị hồ sơ" },
  { id: 2, title: "Thanh toán" },
  { id: 3, title: "Hoàn tất" },
];

const currency = new Intl.NumberFormat("vi-VN");

export default function ServiceWizard() {
  const { serviceId } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [submitResult, setSubmitResult] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [formData, setFormData] = useState({ fullName: "", citizenId: "", email: "", phone: "", address: "", note: "" });
  const [formErrors, setFormErrors] = useState({});
  const [fileItems, setFileItems] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [bankPayment, setBankPayment] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pollRef = useRef(null);

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
  const requiredDocs = useMemo(() => docs.filter((d) => d.required), [docs]);
  const missingDocs = useMemo(() => requiredDocs.filter((d) => !fileItems[d.key]), [requiredDocs, fileItems]);
  const feeText = useMemo(() => `${currency.format(service?.fee || 0)} VNĐ`, [service]);
  const serviceTimeline = useMemo(() => (service?.timeline?.length ? service.timeline : defaultTimeline), [service]);
  const faq = useMemo(() => (service?.faq?.length ? service.faq : defaultFaq), [service]);
  const currentDossierId = paymentInfo?.dossierId || bankPayment?.dossierId || "";
  const isPaid = paymentStatus === "PAID";
  const paymentStatusLabel = isPaid ? "Thanh toán thành công" : paymentStatus;

  function getSubmitDossierId(result = {}) {
    return String(
      result?.dossierId ||
      result?.application?.dossierId ||
      result?.application?.id ||
      result?.applicationCode ||
      result?.dossierCode ||
      result?.application?.applicationCode ||
      result?.application?.applicationId ||
      ""
    ).trim();
  }

  function validateField(name, value) {
    if (name === "fullName" && !value.trim()) return "Họ tên là bắt buộc";
    if (name === "citizenId" && !/^\d{9,12}$/.test(value)) return "CCCD/CMND phải từ 9 đến 12 số";
    if (name === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Email không đúng định dạng";
    if (name === "phone" && !/^\d{10,11}$/.test(value)) return "Số điện thoại không hợp lệ";
    if (name === "address" && !value.trim()) return "Địa chỉ là bắt buộc";
    return "";
  }

  function onChange(e) {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setFormErrors((p) => ({ ...p, [name]: validateField(name, value) }));
  }

  function validateForm() {
    const next = {};
    ["fullName", "citizenId", "address", "phone"].forEach((k) => {
      const msg = validateField(k, formData[k] || "");
      if (msg) next[k] = msg;
    });
    if (formData.email) {
      const msg = validateField("email", formData.email);
      if (msg) next.email = msg;
    }
    if (missingDocs.length) next.files = `Bạn còn thiếu ${missingDocs.length} giấy tờ bắt buộc`;
    setFormErrors(next);
    return Object.keys(next).length === 0;
  }

  function onPickFile(key, file) {
    if (!file) return;
    setFileItems((p) => ({ ...p, [key]: { file, name: file.name, type: file.type, previewUrl: URL.createObjectURL(file) } }));
  }

  async function onSubmit() {
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const uploaded = [];
      for (const [key, item] of Object.entries(fileItems)) {
        const safeContentType = item.type || "application/octet-stream";
        const safeKey = `chat-media/${serviceId || "service"}/${key}-${Date.now()}-${item.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const presignRes = await presignAttachmentUpload({ key: safeKey, contentType: safeContentType, fileName: item.name, applicationId: "new", docKey: key });
        const uploadRes = await uploadToS3(item.file);
        const fileUrl = uploadRes?.publicUrl || presignRes.data?.publicUrl || item.previewUrl;
        uploaded.push({
          key,
          fileName: item.name,
          name: item.name,
          mimeType: item.type || safeContentType,
          fileType: item.type || safeContentType,
          size: item.file.size,
          fileUrl,
          url: fileUrl,
          path: fileUrl,
        });
      }

      const payload = {
        serviceId: service?.serviceId || service?.id || serviceId,
        formData: {
          fullName: formData.fullName,
          citizenId: formData.citizenId,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          requestContent: formData.note,
        },
        paymentMethod,
        attachments: uploaded,
      };

      const { data } = await submitServiceApplication(payload);
      const dossierId = getSubmitDossierId(data);
      if (!dossierId) throw new Error("Thiếu dossierId từ phản hồi nộp hồ sơ");

      setSubmitResult(data);
      setPaymentExpireAt(new Date(Date.now() + 60 * 60 * 1000).toISOString());
      setPaymentStatus("PENDING");
      setStep(2);

      // Tạo thanh toán chuyển khoản SePay
      const { data: bankTransfer } = await createBankTransferPayment({ dossierId, amount: data.application?.fee || data.fee || service?.fee || 0 });
      setBankPayment(bankTransfer || null);
      setPaymentInfo(bankTransfer || null);
      console.log("paymentInfo:", bankTransfer || null);
      setSubmitResult((prev) => ({ ...(prev || {}), dossierId, bankPayment: bankTransfer || {} }));
      setPaymentStatus(bankTransfer?.paymentStatus || bankTransfer?.status || "PENDING");

    } catch (e) {
      alert(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onMockPaid() {
    const dossierId = currentDossierId;
    if (!dossierId) return;
    await mockPaymentComplete(dossierId);
    setPaymentStatus("PAID");
    if (pollRef.current) clearInterval(pollRef.current);
    setStep(3);
  }

  async function checkPaymentStatus() {
    const dossierId = paymentInfo?.dossierId || bankPayment?.dossierId || currentDossierId;
    console.log("checking dossierId:", paymentInfo?.dossierId);
    if (!dossierId) return;
    setCheckingPayment(true);
    try {
      const { data } = await getBankTransferPaymentStatus(dossierId);
      setPaymentStatus(data.paymentStatus || "PENDING");
      if (data.paymentStatus === "PAID") setStep(3);
    } finally {
      setCheckingPayment(false);
    }
  }

  async function copyTransferContent() {
    const text = bankPayment?.transferContent;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  if (loading) return <PageShell>Đang tải dữ liệu dịch vụ...</PageShell>;
  if (error || !service) return <PageShell>Không tìm thấy dịch vụ</PageShell>;

  const completedCount = docs.filter((doc) => fileItems[doc.key]).length;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.breadcrumb}>
          <Link to="/" style={styles.breadcrumbLink}><ArrowLeft size={14} /> Trang chủ</Link>
          <span>/</span>
          <Link to="/services" style={styles.breadcrumbLink}>Dịch vụ</Link>
          <span>/</span>
          <span>{service.name}</span>
        </div>

        <div style={styles.hero}>
          <div style={styles.heroLeft}>
            <span style={styles.badge}><Sparkles size={14} /> Dịch vụ công trực tuyến</span>
            <h1 style={styles.title}>{service.name}</h1>
            <p style={styles.subtitle}>{service.description || "Chi tiết hồ sơ, giấy tờ cần nộp và thanh toán được hiển thị rõ ràng bên dưới."}</p>
            <div style={styles.metaRow}>
              <Meta icon={Clock3} label={service.processingTime || "Đang cập nhật"} />
              <Meta icon={BadgeCheck} label={feeText} />
              <Meta icon={ShieldCheck} label={service.categoryName || service.category || "Hành chính công"} />
            </div>
          </div>

          <div style={styles.heroRight}>
            <div style={styles.progressCard}>
              <div style={{ fontWeight: 900, marginBottom: 12, color: "#0f172a" }}>Luồng xử lý hồ sơ</div>
              {steps.map((s) => (
                <div key={s.id} style={styles.stepRow}>
                  <div style={step >= s.id ? styles.stepDotActive : styles.stepDotInactive}>{step > s.id ? <CircleCheck size={14} /> : s.id}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.stepTitle}>{s.title}</div>
                    <div style={styles.stepDesc}>{s.id === 1 ? "Chuẩn bị và tải giấy tờ cần nộp" : s.id === 2 ? "Thanh toán lệ phí nếu có" : "Chờ xử lý và nhận kết quả"}</div>
                  </div>
                </div>
              ))}
              <div style={styles.timelineCard}>
                <div style={styles.timelineCardTitle}>Trình tự dịch vụ</div>
                {serviceTimeline.map((item, index) => (
                  <div key={item} style={styles.timelineRow}>
                    <span style={styles.timelineIndex}>{index + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.mainCol}>
            <div style={styles.card}>
              <SectionTitle icon={FileText} title="Hồ sơ cần nộp" />
              <p style={styles.helperText}>Hãy chuẩn bị đủ các giấy tờ bắt buộc trước khi nộp. Những mục có nhãn <strong>Bắt buộc</strong> là điều kiện để gửi hồ sơ thành công.</p>
              <div style={styles.requirementSummary}>
                <SummaryChip label="Tổng giấy tờ" value={docs.length} />
                <SummaryChip label="Bắt buộc" value={requiredDocs.length} />
                <SummaryChip label="Đã đính kèm" value={completedCount} />
              </div>

              <div style={styles.docList}>
                {docs.length ? docs.map((doc) => {
                  const attached = Boolean(fileItems[doc.key]);
                  return (
                    <div key={doc.key} style={styles.docRow}>
                      <div style={styles.docMain}>
                        <div style={styles.docIconWrap}>{attached ? <CircleCheck size={16} color="#16a34a" /> : <CircleDashed size={16} color="#94a3b8" />}</div>
                        <div>
                          <div style={styles.docTitle}>{doc.label}</div>
                          <div style={styles.docMeta}>{doc.required ? "Bắt buộc" : "Tùy chọn"}</div>
                        </div>
                      </div>
                      <span style={doc.required ? styles.req : styles.opt}>{doc.required ? "Bắt buộc" : "Tùy chọn"}</span>
                    </div>
                  );
                }) : <div style={styles.emptyNote}>Chưa có danh sách giấy tờ cho dịch vụ này.</div>}
              </div>
            </div>

            <div style={styles.card}>
              <SectionTitle icon={Info} title="Câu hỏi thường gặp" />
              <div style={styles.faqList}>
                {faq.map((item) => (
                  <details key={item.q} style={styles.faqItem}>
                    <summary style={styles.faqQ}>{item.q}</summary>
                    <div style={styles.faqA}>{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.sideCol}>
            {step === 1 && (
              <div style={styles.card}>
                <SectionTitle icon={UploadCloud} title="Nộp hồ sơ online" />
                <p style={styles.helperText}>Điền thông tin cá nhân và tải lên đúng các giấy tờ bắt buộc để hoàn tất hồ sơ một lần.</p>

                <div style={styles.formGrid}>
                  <Input label="Họ tên" name="fullName" value={formData.fullName} onChange={onChange} error={formErrors.fullName} />
                  <Input label="CCCD/CMND" name="citizenId" value={formData.citizenId} onChange={onChange} error={formErrors.citizenId} />
                  <Input label="Email" name="email" value={formData.email} onChange={onChange} error={formErrors.email} />
                  <Input label="Số điện thoại" name="phone" value={formData.phone} onChange={onChange} error={formErrors.phone} />
                  <Input label="Địa chỉ" name="address" value={formData.address} onChange={onChange} error={formErrors.address} fullWidth />
                  <Textarea label="Ghi chú" name="note" value={formData.note} onChange={onChange} />
                </div>

                <div style={styles.uploadSection}>
                  {docs.map((doc) => {
                    const attached = fileItems[doc.key];
                    return (
                      <label key={doc.key} style={styles.uploadBox}>
                        <div style={styles.uploadTitleRow}>
                          <div>
                            <div style={styles.uploadTitle}>{doc.label}</div>
                            <div style={styles.uploadSub}>{doc.required ? "Bắt buộc" : "Tùy chọn"} · Chọn file hoặc ảnh để tải lên</div>
                          </div>
                          <span style={doc.required ? styles.req : styles.opt}>{doc.required ? "Bắt buộc" : "Tùy chọn"}</span>
                        </div>
                        <input type="file" onChange={(e) => onPickFile(doc.key, e.target.files?.[0])} style={styles.fileInput} />
                        {attached ? (
                          <div style={styles.filePreviewBox}>
                            <div style={styles.fileName}>{attached.name}</div>
                            {attached.type?.startsWith("image/") ? <img src={attached.previewUrl} alt="preview" style={styles.preview} /> : null}
                          </div>
                        ) : null}
                      </label>
                    );
                  })}
                </div>

                {formErrors.files ? <div style={styles.error}>{formErrors.files}</div> : null}
                <div style={styles.actions}>
                  <button type="button" style={styles.primaryBtn} onClick={onSubmit} disabled={submitting}>
                    {submitting ? "Đang xử lý..." : "Tiếp tục nộp hồ sơ"}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={styles.card}>
                <SectionTitle icon={CreditCard} title="Thanh toán chuyển khoản" />
                <p style={styles.helperText}>Quét QR hoặc chuyển khoản theo nội dung bên dưới. Sau khi thanh toán, bấm kiểm tra trạng thái để hệ thống cập nhật tự động.</p>
                <div style={styles.paymentBox}>
                  <div style={styles.paymentRow}><span>Mã hồ sơ đang thanh toán</span><strong>{currentDossierId || "Chưa có mã hồ sơ"}</strong></div>
                  <div style={styles.paymentRow}><span>Số tiền</span><strong>{currency.format(paymentInfo?.amount || bankPayment?.amount || service?.fee || 0)} VNĐ</strong></div>
                  <div style={styles.paymentRow}><span>Trạng thái payment</span><strong>{paymentStatusLabel}</strong></div>
                  <div style={styles.paymentRow}><span>Số tài khoản</span><strong>{paymentInfo?.bankAccount || bankPayment?.bankAccount || "Đang cập nhật"}</strong></div>
                  <div style={styles.paymentRow}><span>Tên tài khoản</span><strong>{paymentInfo?.bankAccountName || bankPayment?.bankAccountName || "Đang cập nhật"}</strong></div>
                  <div style={styles.paymentRow}><span>Nội dung CK</span><strong style={styles.transferContent}>{paymentInfo?.transferContent || bankPayment?.transferContent || "Chưa có từ backend"}</strong></div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" style={styles.secondaryBtn} onClick={copyTransferContent} disabled={!paymentInfo?.transferContent && !bankPayment?.transferContent}><Copy size={16} /> Sao chép nội dung</button>
                  <button type="button" style={styles.secondaryBtn} onClick={checkPaymentStatus} disabled={checkingPayment}><RefreshCw size={16} /> {checkingPayment ? "Đang kiểm tra..." : "Kiểm tra trạng thái thanh toán"}</button>
                </div>
                {paymentInfo?.qrUrl || bankPayment?.qrUrl ? (
                  <img src={paymentInfo?.qrUrl || bankPayment?.qrUrl} alt="payment qr" style={styles.qr} />
                ) : (
                  <div style={{ marginTop: 12, color: "#64748b" }}>Chưa có QR từ backend.</div>
                )}
                <div style={styles.actions}>
                  <button type="button" style={styles.secondaryBtn} onClick={() => setStep(1)}>Quay lại sửa hồ sơ</button>
                  <button type="button" style={styles.primaryBtn} onClick={checkPaymentStatus} disabled={checkingPayment}>Kiểm tra trạng thái thanh toán</button>
                </div>
                <button type="button" onClick={onMockPaid} style={{ ...styles.mockBtn, opacity: isPaid ? 0.6 : 1, cursor: isPaid ? "not-allowed" : "pointer" }} disabled={isPaid}>Đánh dấu thanh toán thành công (demo)</button>
              </div>
            )}

            {step === 3 && (
              <div style={styles.card}>
                <SectionTitle icon={CheckCircle2} title="Hồ sơ đã sẵn sàng xử lý" />
                <div style={styles.successBox}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{paymentStatusLabel}</div>
                  <div>Mã hồ sơ: {currentDossierId || getSubmitDossierId(submitResult) || submitResult?.applicationCode}</div>
                  <div style={{ marginTop: 8, color: "#475569" }}>Hồ sơ đã được ghi nhận. Bạn có thể dùng mã này để tra cứu trạng thái về sau.</div>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link to="/services" style={styles.linkBtn}>Danh sách dịch vụ</Link>
                  <Link to="/" style={styles.linkBtnSecondary}>Trang chủ</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageShell({ children }) {
  return (
    <div style={styles.page}>
      <div style={{ maxWidth: 960, margin: "0 auto", background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <Icon size={18} color="#1d4ed8" />
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{title}</h2>
    </div>
  );
}

function Meta({ icon: Icon, label }) {
  return (
    <div style={styles.meta}>
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}

function SummaryChip({ label, value }) {
  return (
    <div style={styles.summaryChip}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function Input({ label, name, value, onChange, error, fullWidth = false }) {
  return (
    <label style={fullWidth ? { ...styles.field, gridColumn: "1 / -1" } : styles.field}>
      <span style={styles.label}>{label}</span>
      <input name={name} value={value} onChange={onChange} style={{ ...styles.input, borderColor: error ? "#ef4444" : "#dbe3ee" }} />
      {error ? <span style={styles.error}>{error}</span> : null}
    </label>
  );
}

function Textarea({ label, name, value, onChange }) {
  return (
    <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
      <span style={styles.label}>{label}</span>
      <textarea name={name} value={value} onChange={onChange} rows={4} style={styles.textarea} />
    </label>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)", padding: 24 },
  container: { maxWidth: 1240, margin: "0 auto" },
  breadcrumb: { display: "flex", gap: 8, alignItems: "center", color: "#64748b", fontSize: 13, marginBottom: 16, flexWrap: "wrap" },
  breadcrumbLink: { display: "inline-flex", gap: 6, alignItems: "center", color: "#1d4ed8", textDecoration: "none", fontWeight: 700 },
  hero: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 20 },
  heroLeft: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 30px rgba(15,23,42,.05)" },
  heroRight: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 30px rgba(15,23,42,.05)" },
  badge: { display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  title: { margin: "14px 0 8px", fontSize: 34, fontWeight: 900, color: "#0f172a" },
  subtitle: { margin: 0, color: "#475569", lineHeight: 1.7, maxWidth: 760 },
  metaRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 },
  meta: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155", fontSize: 13, fontWeight: 700 },
  progressCard: { background: "#f8fafc", borderRadius: 20, padding: 18, border: "1px solid #e2e8f0" },
  stepRow: { display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12 },
  stepDotActive: { width: 26, height: 26, borderRadius: 999, background: "#1d4ed8", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stepDotInactive: { width: 26, height: 26, borderRadius: 999, background: "#e2e8f0", color: "#475569", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stepTitle: { fontWeight: 800, color: "#0f172a" },
  stepDesc: { marginTop: 2, color: "#64748b", fontSize: 13, lineHeight: 1.5 },
  timelineCard: { marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14 },
  timelineCardTitle: { fontWeight: 800, color: "#0f172a", marginBottom: 10 },
  timelineRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", color: "#334155", fontSize: 14 },
  timelineIndex: { width: 22, height: 22, borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 },
  grid: { display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 },
  mainCol: { display: "flex", flexDirection: "column", gap: 16 },
  sideCol: { display: "flex", flexDirection: "column", gap: 16 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20, boxShadow: "0 8px 24px rgba(15,23,42,.04)" },
  helperText: { margin: "0 0 14px", color: "#475569", lineHeight: 1.7 },
  requirementSummary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 },
  summaryChip: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 12 },
  summaryLabel: { display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 },
  summaryValue: { fontSize: 18, color: "#0f172a" },
  docList: { display: "grid", gap: 12 },
  docRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: 14, border: "1px solid #eef2f7", borderRadius: 18, background: "#fff" },
  docMain: { display: "flex", gap: 12, alignItems: "center" },
  docIconWrap: { width: 34, height: 34, borderRadius: 12, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" },
  docTitle: { fontWeight: 800, color: "#0f172a" },
  docMeta: { marginTop: 3, fontSize: 12, color: "#64748b" },
  req: { background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, alignSelf: "center" },
  opt: { background: "#eff6ff", color: "#1d4ed8", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, alignSelf: "center" },
  emptyNote: { color: "#64748b", padding: 14, border: "1px dashed #cbd5e1", borderRadius: 16, background: "#f8fafc" },
  faqList: { display: "grid", gap: 8 },
  faqItem: { padding: "10px 0", borderBottom: "1px solid #eef2f7" },
  faqQ: { cursor: "pointer", fontWeight: 800, color: "#0f172a" },
  faqA: { marginTop: 8, color: "#475569", lineHeight: 1.6 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 800, color: "#334155" },
  input: { height: 46, borderRadius: 14, border: "1px solid #dbe3ee", padding: "0 14px", outline: "none", background: "#fff" },
  textarea: { borderRadius: 14, border: "1px solid #dbe3ee", padding: 14, outline: "none", background: "#fff", fontFamily: "inherit" },
  uploadSection: { display: "grid", gap: 12, marginTop: 14 },
  uploadBox: { display: "block", border: "1px dashed #cbd5e1", borderRadius: 18, padding: 14, background: "#f8fafc" },
  uploadTitleRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  uploadTitle: { fontWeight: 800, color: "#0f172a" },
  uploadSub: { marginTop: 4, color: "#64748b", fontSize: 12 },
  fileInput: { marginTop: 10, width: "100%" },
  filePreviewBox: { marginTop: 10 },
  fileName: { fontSize: 13, fontWeight: 700, color: "#334155" },
  preview: { width: "100%", maxWidth: 240, marginTop: 10, borderRadius: 12, border: "1px solid #e2e8f0" },
  error: { color: "#dc2626", fontSize: 13, fontWeight: 700, marginTop: 6 },
  actions: { display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" },
  primaryBtn: { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 14, padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
  secondaryBtn: { background: "#e2e8f0", color: "#0f172a", border: "none", borderRadius: 14, padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
  mockBtn: { marginTop: 12, background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
  paymentBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  paymentRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", color: "#334155", alignItems: "flex-start" },
  transferContent: { textAlign: "right", wordBreak: "break-word", maxWidth: 260 },
  select: { width: "100%", height: 46, borderRadius: 14, border: "1px solid #dbe3ee", padding: "0 14px", marginTop: 8, background: "#fff" },
  qr: { width: "100%", maxWidth: 360, display: "block", margin: "16px auto 0", borderRadius: 20, border: "1px solid #e2e8f0", background: "#fff" },
  successBox: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 18, padding: 16, lineHeight: 1.7 },
  linkBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#1d4ed8", color: "#fff", textDecoration: "none", borderRadius: 14, padding: "12px 18px", fontWeight: 800 },
  linkBtnSecondary: { display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#e2e8f0", color: "#0f172a", textDecoration: "none", borderRadius: 14, padding: "12px 18px", fontWeight: 800 },
};
