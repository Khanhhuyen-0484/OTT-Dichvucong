import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  FileCheck2,
  FileText,
  Headphones,
  Home,
  Info,
  Loader2,
  LogIn,
  MapPin,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
} from "lucide-react";
import {
  createBankTransferPayment,
  getApiErrorMessage,
  getBankTransferPaymentStatus,
  getServiceById,
  mockPaymentComplete,
  presignAttachmentUpload,
  submitServiceApplication,
} from "../lib/api";
import { uploadToS3 } from "../lib/uploadToS3.js";
import { useAuth } from "../context/AuthContext.jsx";

const defaultFaq = [
  { q: "Hồ sơ thiếu giấy tờ thì xử lý thế nào?", a: "Hệ thống sẽ cảnh báo giấy tờ bắt buộc còn thiếu trước khi bạn nộp hồ sơ. Sau khi tiếp nhận, cán bộ có thể yêu cầu bổ sung nếu tài liệu chưa hợp lệ." },
  { q: "Tôi có thể thanh toán trực tuyến không?", a: "Có. Sau khi hồ sơ được tạo, hệ thống hiển thị mã QR VietQR/SePay, nội dung chuyển khoản và trạng thái thanh toán realtime." },
  { q: "Sau khi nộp hồ sơ tôi tra cứu ở đâu?", a: "Bạn có thể vào mục Hồ sơ đã nộp hoặc dùng mã hồ sơ để tra cứu tiến độ xử lý." },
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
  },
  "demo-dat-dai": {
    name: "Đăng ký biến động đất đai",
    description: "Tiếp nhận hồ sơ, đính kèm giấy tờ và theo dõi tiến độ xử lý biến động đất đai.",
    categoryName: "Đất đai",
    processingTime: "5 ngày làm việc",
    fee: 20000,
    documents: [
      { key: "landPaper", label: "Giấy chứng nhận quyền sử dụng đất", required: true },
      { key: "requestForm", label: "Đơn đăng ký biến động", required: true },
    ],
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
  },
  "demo-gplx": {
    name: "Đổi giấy phép lái xe",
    description: "Điền thông tin, tải hồ sơ và nhận mã tra cứu sau khi nộp.",
    categoryName: "Giao thông",
    processingTime: "4 ngày làm việc",
    fee: 150000,
    documents: [
      { key: "oldLicense", label: "Giấy phép lái xe cũ", required: true },
      { key: "health", label: "Giấy khám sức khỏe", required: true },
    ],
  },
};

const wizardSteps = [
  { id: 1, title: "Thông tin cá nhân", icon: UserRound },
  { id: 2, title: "Giấy tờ đính kèm", icon: Paperclip },
  { id: 3, title: "Xác nhận hồ sơ", icon: ClipboardCheck },
  { id: 4, title: "Thanh toán", icon: CreditCard },
];

const currency = new Intl.NumberFormat("vi-VN");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ServiceWizard() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [openFaq, setOpenFaq] = useState(0);
  const [submitResult, setSubmitResult] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    citizenId: "",
    email: "",
    phone: "",
    province: "",
    district: "",
    ward: "",
    address: "",
    note: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [fileItems, setFileItems] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [dragKey, setDragKey] = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    async function loadService() {
      try {
        const { data } = await getServiceById(serviceId);
        setService(data);
      } catch (e) {
        const demo = demoServices[serviceId];
        if (demo) setService({ serviceId, id: serviceId, faq: defaultFaq, ...demo });
        else setError(getApiErrorMessage(e) || "Không tìm thấy dịch vụ");
      } finally {
        setLoading(false);
      }
    }
    loadService();
  }, [serviceId]);

  useEffect(() => () => {
    Object.values(fileItems).forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    if (pollRef.current) clearInterval(pollRef.current);
  }, [fileItems]);

  const docs = useMemo(() => service?.documents || [], [service]);
  const requiredDocs = useMemo(() => docs.filter((doc) => doc.required), [docs]);
  const missingDocs = useMemo(() => requiredDocs.filter((doc) => !fileItems[doc.key]), [requiredDocs, fileItems]);
  const feeAmount = Number(service?.fee || submitResult?.application?.fee || submitResult?.fee || 0);
  const isFree = feeAmount <= 0;
  const currentDossierId = getSubmitDossierId(submitResult) || paymentInfo?.dossierId;
  const isPaid = String(paymentStatus).toUpperCase() === "PAID";
  const faq = service?.faq?.length ? service.faq : defaultFaq;

  const aiTips = useMemo(() => {
    const tips = [];
    if (missingDocs.length) tips.push(`Còn thiếu ${missingDocs.length} giấy tờ bắt buộc trước khi nộp.`);
    Object.values(fileItems).forEach((item) => {
      if (item.file?.size > MAX_FILE_SIZE) tips.push(`File ${item.name} vượt quá 10MB, nên nén hoặc chọn file khác.`);
      if (!item.type) tips.push(`File ${item.name} chưa xác định định dạng, hãy kiểm tra trước khi gửi.`);
    });
    if (!formData.phone || !formData.address) tips.push("Nên điền đầy đủ số điện thoại và nơi cư trú để cán bộ liên hệ khi cần.");
    if (!tips.length) tips.push("Hồ sơ đang đầy đủ thông tin cơ bản. Bạn có thể chuyển sang bước xác nhận.");
    return tips;
  }, [fileItems, formData.address, formData.phone, missingDocs.length]);

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
    if (name === "fullName" && !value.trim()) return "Vui lòng nhập họ và tên";
    if (name === "citizenId" && !/^\d{9,12}$/.test(value)) return "CCCD/CMND phải từ 9 đến 12 số";
    if (name === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Email không đúng định dạng";
    if (name === "phone" && !/^0?\d{9,10}$/.test(value)) return "Số điện thoại không hợp lệ";
    if (name === "address" && !value.trim()) return "Vui lòng nhập địa chỉ cư trú";
    return "";
  }

  function validatePersonal() {
    const next = {};
    ["fullName", "citizenId", "phone", "address"].forEach((key) => {
      const msg = validateField(key, formData[key] || "");
      if (msg) next[key] = msg;
    });
    if (formData.email) {
      const msg = validateField("email", formData.email);
      if (msg) next.email = msg;
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateFiles() {
    const next = {};
    if (missingDocs.length) next.files = `Bạn còn thiếu ${missingDocs.length} giấy tờ bắt buộc`;
    Object.entries(fileItems).forEach(([key, item]) => {
      if (item.file?.size > MAX_FILE_SIZE) next[key] = "File vượt quá 10MB";
    });
    setFormErrors((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  }

  function handleNext() {
    if (!user) return navigate("/auth");
    if (step === 1 && !validatePersonal()) return;
    if (step === 2 && !validateFiles()) return;
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  }

  function addFile(docKey, file) {
    if (!file) return;
    const previewUrl = file.type?.startsWith("image/") ? URL.createObjectURL(file) : "";
    setFileItems((prev) => ({
      ...prev,
      [docKey]: {
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl,
        uploadStatus: file.size > MAX_FILE_SIZE ? "error" : "ready",
        progress: file.size > MAX_FILE_SIZE ? 0 : 100,
      },
    }));
    setFormErrors((prev) => ({ ...prev, [docKey]: file.size > MAX_FILE_SIZE ? "File vượt quá 10MB" : "", files: "" }));
  }

  function removeFile(docKey) {
    setFileItems((prev) => {
      const next = { ...prev };
      if (next[docKey]?.previewUrl) URL.revokeObjectURL(next[docKey].previewUrl);
      delete next[docKey];
      return next;
    });
  }

  async function saveDraft() {
    const draft = {
      serviceId,
      formData,
      files: Object.fromEntries(Object.entries(fileItems).map(([key, item]) => [key, { name: item.name, size: item.size, type: item.type }])),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`dvc-draft-${serviceId}`, JSON.stringify(draft));
    alert("Đã lưu nháp trên trình duyệt hiện tại.");
  }

  async function submitApplication() {
    if (!user) return navigate("/auth");
    if (!validatePersonal() || !validateFiles()) return;
    try {
      setSubmitting(true);
      setStep(3);
      const uploaded = [];

      for (const [key, item] of Object.entries(fileItems)) {
        setFileItems((prev) => ({ ...prev, [key]: { ...prev[key], uploadStatus: "uploading", progress: 35 } }));
        const safeContentType = item.type || "application/octet-stream";
        const safeKey = `chat-media/${serviceId || "service"}/${key}-${Date.now()}-${item.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const presignRes = await presignAttachmentUpload({ key: safeKey, contentType: safeContentType, fileName: item.name, applicationId: "new", docKey: key });
        setFileItems((prev) => ({ ...prev, [key]: { ...prev[key], progress: 70 } }));
        const uploadRes = await uploadToS3(item.file);
        const fileUrl = uploadRes?.publicUrl || presignRes.data?.publicUrl || item.previewUrl;
        setFileItems((prev) => ({ ...prev, [key]: { ...prev[key], uploadStatus: "done", progress: 100 } }));
        uploaded.push({ key, fileName: item.name, name: item.name, mimeType: safeContentType, fileType: safeContentType, size: item.file.size, fileUrl, url: fileUrl, path: fileUrl });
      }

      const { data } = await submitServiceApplication({
        serviceId: service?.serviceId || service?.id || serviceId,
        formData: {
          fullName: formData.fullName,
          citizenId: formData.citizenId,
          email: formData.email,
          phone: formData.phone,
          address: [formData.address, formData.ward, formData.district, formData.province].filter(Boolean).join(", "),
          requestContent: formData.note,
        },
        paymentMethod: "BANK_TRANSFER",
        attachments: uploaded,
      });

      const dossierId = getSubmitDossierId(data);
      if (!dossierId) throw new Error("Thiếu mã hồ sơ từ phản hồi nộp hồ sơ");

      setSubmitResult(data);
      setPaymentExpireAt(new Date(Date.now() + 60 * 60 * 1000).toISOString());
      setPaymentStatus("PENDING");

      if (Number(service?.fee || data.application?.fee || 0) <= 0) {
        setPaymentStatus("PAID");
        setStep(4);
        return;
      }

      const { data: bankTransfer } = await createBankTransferPayment({ dossierId, amount: data.application?.fee || data.fee || service?.fee || 0 });
      setPaymentInfo(bankTransfer || null);
      setSubmitResult((prev) => ({ ...(prev || {}), dossierId, bankPayment: bankTransfer || {} }));
      setPaymentStatus(bankTransfer?.paymentStatus || bankTransfer?.status || "PENDING");
      setStep(4);
    } catch (e) {
      alert(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function checkPaymentStatus() {
    if (!currentDossierId) return;
    setCheckingPayment(true);
    try {
      const { data } = await getBankTransferPaymentStatus(currentDossierId);
      setPaymentStatus(data.paymentStatus || "PENDING");
    } finally {
      setCheckingPayment(false);
    }
  }

  async function markDemoPaid() {
    if (!currentDossierId) return;
    await mockPaymentComplete(currentDossierId);
    setPaymentStatus("PAID");
  }

  async function copyTransferContent() {
    const text = paymentInfo?.transferContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  if (loading) return <PageState text="Đang tải dữ liệu dịch vụ..." />;
  if (error || !service) return <PageState text={error || "Không tìm thấy dịch vụ"} />;

  return (
    <div className="min-h-screen bg-[#f4f8fd] pb-12 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900"><ArrowLeft className="h-4 w-4" /> Trang chủ</Link>
          <span>/</span>
          <Link to="/services" className="text-blue-700 hover:text-blue-900">Dịch vụ công</Link>
          <span>/</span>
          <span>{service.name}</span>
        </div>

        <section className="mb-5 overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-[#073763] via-[#0b5c9a] to-[#1687c7] text-white shadow-2xl shadow-blue-950/10">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_330px] lg:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-black ring-1 ring-white/20">
                <Sparkles className="h-4 w-4" /> Nộp hồ sơ trực tuyến
              </span>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">{service.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/82">{service.description || "Hoàn thiện thông tin, tải giấy tờ, xác nhận và thanh toán trên một quy trình thống nhất."}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Meta icon={Clock3} label={service.processingTime || "Đang cập nhật"} />
                <Meta icon={Banknote} label={`${currency.format(feeAmount)} VNĐ`} />
                <Meta icon={Building2} label={service.categoryName || service.category || "Hành chính công"} />
              </div>
            </div>
            <div className="relative min-h-[190px] rounded-3xl bg-white/12 p-5 ring-1 ring-white/18 backdrop-blur">
              <div className="absolute right-5 top-5 grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#0b5c9a] shadow-lg">
                <FileCheck2 className="h-7 w-7" />
              </div>
              <div className="pr-16">
                <div className="text-sm font-black text-white/70">Trợ lý hồ sơ</div>
                <div className="mt-2 text-2xl font-black">Kiểm tra trước khi gửi</div>
                <p className="mt-3 text-sm leading-6 text-white/72">AI helper sẽ nhắc giấy tờ còn thiếu, file quá dung lượng và các thông tin nên bổ sung.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-20 mb-5 rounded-3xl border border-[#e5edf5] bg-white/92 p-3 shadow-lg shadow-blue-950/5 backdrop-blur">
          <div className="grid gap-2 sm:grid-cols-4">
            {wizardSteps.map((item) => {
              const Icon = item.icon;
              const active = step === item.id;
              const done = step > item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.id < step && setStep(item.id)}
                  className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 text-left transition ${active ? "bg-blue-700 text-white shadow-lg shadow-blue-900/15" : done ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-white/16" : "bg-white"}`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span>
                    <span className="block text-xs font-black opacity-70">Bước {item.id}</span>
                    <span className="block text-sm font-black">{item.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <main className="space-y-5">
            {!user ? <LoginGate navigate={navigate} /> : null}
            {user && step === 1 ? (
              <Card>
                <SectionHeader icon={UserRound} title="Thông tin người nộp hồ sơ" subtitle="Thông tin này dùng để tiếp nhận, liên hệ và trả kết quả hồ sơ." />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Họ và tên" name="fullName" value={formData.fullName} onChange={onChange} error={formErrors.fullName} />
                  <Field label="CCCD/CMND" name="citizenId" value={formData.citizenId} onChange={onChange} error={formErrors.citizenId} />
                  <Field label="Email" name="email" value={formData.email} onChange={onChange} error={formErrors.email} />
                  <Field label="Số điện thoại" name="phone" value={formData.phone} onChange={onChange} error={formErrors.phone} />
                </div>
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <SectionHeader icon={MapPin} title="Thông tin cư trú" subtitle="Nhập địa chỉ hiện tại hoặc nơi nhận kết quả theo yêu cầu dịch vụ." compact />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Tỉnh/Thành phố" name="province" value={formData.province} onChange={onChange} />
                    <Field label="Quận/Huyện" name="district" value={formData.district} onChange={onChange} />
                    <Field label="Phường/Xã" name="ward" value={formData.ward} onChange={onChange} />
                    <Field label="Địa chỉ chi tiết" name="address" value={formData.address} onChange={onChange} error={formErrors.address} className="md:col-span-3" />
                  </div>
                </div>
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <SectionHeader icon={MessageSquareText} title="Ghi chú bổ sung" subtitle="Mô tả ngắn yêu cầu xử lý hoặc thông tin cán bộ cần lưu ý." compact />
                  <textarea
                    name="note"
                    value={formData.note}
                    onChange={onChange}
                    rows={5}
                    className="mt-3 w-full rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    placeholder="Ví dụ: Tôi muốn nhận kết quả qua bưu chính..."
                  />
                </div>
              </Card>
            ) : null}

            {user && step === 2 ? (
              <Card>
                <SectionHeader icon={UploadCloud} title="Giấy tờ đính kèm" subtitle="Kéo thả file hoặc bấm để chọn. Hỗ trợ ảnh, PDF, DOC/DOCX; khuyến nghị dưới 10MB/file." />
                {formErrors.files ? <InlineAlert text={formErrors.files} /> : null}
                <div className="grid gap-4">
                  {docs.length ? docs.map((doc) => (
                    <UploadZone
                      key={doc.key}
                      doc={doc}
                      item={fileItems[doc.key]}
                      error={formErrors[doc.key]}
                      active={dragKey === doc.key}
                      onFile={(file) => addFile(doc.key, file)}
                      onRemove={() => removeFile(doc.key)}
                      onDragState={setDragKey}
                    />
                  )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">Dịch vụ này chưa cấu hình danh sách giấy tờ.</div>}
                </div>
              </Card>
            ) : null}

            {user && step === 3 ? (
              <Card>
                <SectionHeader icon={ClipboardCheck} title="Xác nhận hồ sơ" subtitle="Kiểm tra lại thông tin trước khi nộp. Sau khi nộp, hệ thống sẽ tạo mã hồ sơ và chuyển sang thanh toán nếu có lệ phí." />
                <ReviewBlock title="Thông tin cá nhân" rows={[
                  ["Họ tên", formData.fullName],
                  ["CCCD/CMND", formData.citizenId],
                  ["Email", formData.email || "Chưa cung cấp"],
                  ["Số điện thoại", formData.phone],
                ]} />
                <ReviewBlock title="Thông tin cư trú" rows={[
                  ["Địa chỉ", [formData.address, formData.ward, formData.district, formData.province].filter(Boolean).join(", ") || "Chưa cung cấp"],
                  ["Ghi chú", formData.note || "Không có"],
                ]} />
                <ReviewBlock title="Giấy tờ đính kèm" rows={docs.map((doc) => [doc.label, fileItems[doc.key]?.name || (doc.required ? "Chưa đính kèm" : "Không có")])} />
                {submitting ? <InlineAlert tone="info" text="Đang tải file và nộp hồ sơ. Vui lòng không đóng trang." /> : null}
              </Card>
            ) : null}

            {user && step === 4 ? (
              <PaymentPanel
                isFree={isFree}
                isPaid={isPaid}
                paymentInfo={paymentInfo}
                paymentStatus={paymentStatus}
                paymentExpireAt={paymentExpireAt}
                currentDossierId={currentDossierId}
                feeAmount={feeAmount}
                checkingPayment={checkingPayment}
                onCopy={copyTransferContent}
                onCheck={checkPaymentStatus}
                onDemoPaid={markDemoPaid}
              />
            ) : null}

            <FAQ faq={faq} openFaq={openFaq} setOpenFaq={setOpenFaq} />
          </main>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <ServiceInfo service={service} feeAmount={feeAmount} docs={docs} />
            <AiHelper tips={aiTips} />
            <div className="rounded-[24px] border border-[#e5edf5] bg-white p-5 shadow-lg shadow-blue-950/5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Headphones className="h-5 w-5" /></div>
                <div>
                  <div className="font-black text-[#0f2f57]">Hỗ trợ trực tuyến</div>
                  <div className="text-sm font-semibold text-slate-500">Hotline: 1900 1022</div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {user ? (
          <div className="sticky bottom-4 z-20 mx-auto mt-6 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#e5edf5] bg-white/95 p-3 shadow-2xl shadow-blue-950/10 backdrop-blur">
            <button type="button" onClick={saveDraft} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-200">
              <Save className="h-4 w-4" /> Lưu nháp
            </button>
            <div className="flex flex-wrap gap-3">
              {step > 1 ? <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Quay lại</button> : null}
              {step < 3 ? <button type="button" onClick={handleNext} className="h-12 rounded-2xl bg-blue-700 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800">Tiếp tục</button> : null}
              {step === 3 ? <button type="button" onClick={submitApplication} disabled={submitting} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-700 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Nộp hồ sơ</button> : null}
              {step === 4 && !isPaid && !isFree ? <button type="button" onClick={checkPaymentStatus} className="h-12 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-700">Thanh toán ngay</button> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PageState({ text }) {
  return <div className="min-h-screen bg-[#f4f8fd] p-6"><div className="mx-auto max-w-3xl rounded-3xl border border-[#e5edf5] bg-white p-8 font-bold text-slate-700 shadow-lg">{text}</div></div>;
}

function Meta({ icon: Icon, label }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-2 text-xs font-black ring-1 ring-white/18"><Icon className="h-4 w-4" /> {label}</span>;
}

function Card({ children }) {
  return <section className="rounded-[28px] border border-[#e5edf5] bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">{children}</section>;
}

function SectionHeader({ icon: Icon, title, subtitle, compact = false }) {
  return (
    <div className={compact ? "mb-3" : "mb-5"}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-black text-[#0f2f57]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, error, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-black text-[#0f2f57]">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className={`mt-2 h-13 min-h-13 w-full rounded-2xl border bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 ${error ? "border-rose-300" : "border-[#dbe3ee]"}`}
      />
      {error ? <span className="mt-1 block text-xs font-bold text-rose-600">{error}</span> : null}
    </label>
  );
}

function UploadZone({ doc, item, error, active, onFile, onRemove, onDragState }) {
  return (
    <div
      onDragOver={(event) => { event.preventDefault(); onDragState(doc.key); }}
      onDragLeave={() => onDragState("")}
      onDrop={(event) => {
        event.preventDefault();
        onDragState("");
        onFile(event.dataTransfer.files?.[0]);
      }}
      className={`rounded-3xl border-2 border-dashed p-4 transition ${active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/45"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm"><UploadCloud className="h-5 w-5" /></div>
          <div>
            <div className="font-black text-[#0f2f57]">{doc.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{doc.required ? "Bắt buộc" : "Tùy chọn"} · Kéo thả hoặc chọn file</div>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${doc.required ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{doc.required ? "Bắt buộc" : "Tùy chọn"}</span>
      </div>
      <label className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-blue-700 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5">
        Chọn file
        <input type="file" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
      </label>
      {item ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-800">{item.name}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{formatSize(item.size)} · {item.uploadStatus === "error" ? "File lỗi" : item.uploadStatus === "uploading" ? "Đang tải lên" : item.uploadStatus === "done" ? "Đã tải lên" : "Sẵn sàng"}</div>
            </div>
            <button type="button" onClick={onRemove} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100">Xóa</button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${item.uploadStatus === "error" ? "bg-rose-500" : "bg-blue-600"}`} style={{ width: `${item.progress || 0}%` }} />
          </div>
          {item.previewUrl ? <img src={item.previewUrl} alt="preview" className="mt-3 max-h-44 rounded-2xl border border-slate-200 object-cover" /> : null}
        </div>
      ) : null}
      {error ? <div className="mt-2 text-xs font-bold text-rose-600">{error}</div> : null}
    </div>
  );
}

function formatSize(size = 0) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function LoginGate({ navigate }) {
  return (
    <Card>
      <SectionHeader icon={LogIn} title="Đăng nhập để nộp hồ sơ" subtitle="Bạn vẫn có thể xem thông tin dịch vụ. Đăng nhập để tải giấy tờ, nộp hồ sơ và thanh toán." />
      <button type="button" onClick={() => navigate("/auth")} className="h-12 rounded-2xl bg-blue-700 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800">Đăng nhập / Đăng ký</button>
    </Card>
  );
}

function ReviewBlock({ title, rows }) {
  return (
    <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">{title}</div>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-2xl bg-white px-4 py-3 text-sm sm:grid-cols-[180px_1fr]">
            <span className="font-bold text-slate-500">{label}</span>
            <span className="font-black text-[#0f2f57]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentPanel({ isFree, isPaid, paymentInfo, paymentStatus, paymentExpireAt, currentDossierId, feeAmount, checkingPayment, onCopy, onCheck, onDemoPaid }) {
  return (
    <Card>
      <SectionHeader icon={CreditCard} title={isFree ? "Hồ sơ không phát sinh lệ phí" : "Thanh toán lệ phí"} subtitle="Thanh toán qua VietQR/SePay và kiểm tra trạng thái tự động." />
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <InfoRow label="Mã hồ sơ" value={currentDossierId || "Đang tạo"} />
        <InfoRow label="Số tiền" value={`${currency.format(paymentInfo?.amount || feeAmount || 0)} VNĐ`} />
        <InfoRow label="Trạng thái" value={isPaid ? "Thanh toán thành công" : paymentStatus || "PENDING"} />
        {!isFree ? (
          <>
            <InfoRow label="Tài khoản" value={paymentInfo?.bankAccount || "Đang cập nhật"} />
            <InfoRow label="Chủ tài khoản" value={paymentInfo?.bankAccountName || "Đang cập nhật"} />
            <InfoRow label="Nội dung CK" value={paymentInfo?.transferContent || "Chưa có"} />
          </>
        ) : null}
      </div>
      {paymentInfo?.qrUrl ? <img src={paymentInfo.qrUrl} alt="payment qr" className="mx-auto mt-5 w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-2" /> : null}
      {paymentExpireAt ? <div className="mt-3 text-center text-xs font-bold text-slate-500">Hết hạn: {new Date(paymentExpireAt).toLocaleString("vi-VN")}</div> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {!isFree ? <button type="button" onClick={onCopy} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700 hover:bg-slate-200"><Copy className="h-4 w-4" /> Sao chép nội dung</button> : null}
        {!isFree ? <button type="button" onClick={onCheck} disabled={checkingPayment} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-70"><RefreshCw className="h-4 w-4" /> {checkingPayment ? "Đang kiểm tra" : "Kiểm tra thanh toán"}</button> : null}
        {!isFree ? <button type="button" onClick={onDemoPaid} disabled={isPaid} className="h-12 rounded-2xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-60">Đánh dấu đã thanh toán demo</button> : null}
        <Link to="/my-applications" className="inline-flex h-12 items-center rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700">Xem hồ sơ đã nộp</Link>
      </div>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return <div className="flex flex-wrap justify-between gap-3 border-b border-slate-200 py-3 last:border-b-0"><span className="text-sm font-bold text-slate-500">{label}</span><strong className="text-right text-sm text-[#0f2f57]">{value}</strong></div>;
}

function FAQ({ faq, openFaq, setOpenFaq }) {
  return (
    <Card>
      <SectionHeader icon={Info} title="Câu hỏi thường gặp" subtitle="Các nội dung hay gặp khi chuẩn bị và nộp hồ sơ trực tuyến." />
      <div className="space-y-3">
        {faq.map((item, index) => {
          const open = openFaq === index;
          return (
            <button key={item.q} type="button" onClick={() => setOpenFaq(open ? -1 : index)} className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <span className="font-black text-[#0f2f57]">{item.q}</span>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
              </div>
              <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{item.a}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ServiceInfo({ service, feeAmount, docs }) {
  return (
    <div className="rounded-[28px] border border-[#e5edf5] bg-white p-5 shadow-xl shadow-blue-950/5">
      <SectionHeader icon={FileText} title="Thông tin dịch vụ" compact />
      <div className="space-y-3">
        <InfoRow label="Thời gian xử lý" value={service.processingTime || "Đang cập nhật"} />
        <InfoRow label="Lệ phí" value={`${currency.format(feeAmount)} VNĐ`} />
        <InfoRow label="Cơ quan xử lý" value={service.agency || service.department || "Bộ phận một cửa"} />
        <InfoRow label="Số giấy tờ" value={`${docs.length} mục`} />
        <InfoRow label="Hotline" value="1900 1022" />
      </div>
    </div>
  );
}

function AiHelper({ tips }) {
  return (
    <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-xl shadow-blue-950/5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-700 text-white"><Bot className="h-5 w-5" /></div>
        <div>
          <div className="font-black text-[#0f2f57]">AI hỗ trợ hồ sơ</div>
          <div className="text-sm font-semibold text-slate-500">Gợi ý theo dữ liệu đang nhập</div>
        </div>
      </div>
      <div className="space-y-2">
        {tips.map((tip) => (
          <div key={tip} className="flex gap-2 rounded-2xl bg-white/75 p-3 text-sm font-bold leading-6 text-slate-700 ring-1 ring-blue-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineAlert({ text, tone = "warn" }) {
  return (
    <div className={`mb-4 flex gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${tone === "info" ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100" : "bg-amber-50 text-amber-800 ring-1 ring-amber-100"}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
