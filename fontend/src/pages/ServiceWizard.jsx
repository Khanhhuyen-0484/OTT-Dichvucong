import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Info,
  Loader2,
  LogIn,
  MapPin,
  Paperclip,
  RefreshCw,
  Save,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import {
  createBankTransferPayment,
  deleteServiceDraft,
  getApiErrorMessage,
  getBankTransferPaymentStatus,
  getServiceDraft,
  getServiceById,
  mockPaymentComplete,
  presignAttachmentUpload,
  saveServiceDraft,
  submitServiceApplication,
} from "../lib/api";
import { uploadToS3 } from "../lib/uploadToS3.js";
import { useAuth } from "../context/AuthContext.jsx";
import { isPaidStatus, paymentStatusLabel } from "../lib/statusLabels.js";

const defaultFaq = [
  {
    q: "Hồ sơ thiếu giấy tờ thì xử lý thế nào?",
    a: "Hệ thống sẽ cảnh báo giấy tờ bắt buộc còn thiếu trước khi nộp. Cán bộ có thể yêu cầu bổ sung nếu tài liệu chưa hợp lệ.",
  },
  {
    q: "Tôi có thể thanh toán trực tuyến không?",
    a: "Có. Sau khi tạo hồ sơ, hệ thống hiển thị thông tin VietQR/SePay và trạng thái thanh toán để bạn kiểm tra.",
  },
  {
    q: "Sau khi nộp hồ sơ tôi tra cứu ở đâu?",
    a: "Bạn có thể vào mục Hồ sơ đã nộp hoặc dùng mã hồ sơ để tra cứu tiến độ xử lý.",
  },
];

const demoServices = {
  "demo-ho-tich": {
    name: "Đăng ký khai sinh",
    description: "Nộp hồ sơ khai sinh trực tuyến, theo dõi trạng thái và nhận thông báo xử lý.",
    categoryName: "Hộ tịch",
    processingTime: "3 ngày làm việc",
    agency: "UBND cấp xã",
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
    agency: "Văn phòng đăng ký đất đai",
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
    agency: "Phòng Quản lý đô thị",
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
    agency: "Sở Giao thông vận tải",
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

function clampStep(value) {
  const next = Number(value || 1);
  return Number.isFinite(next) ? Math.min(4, Math.max(1, next)) : 1;
}

export default function ServiceWizard() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [openFaq, setOpenFaq] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
  const userDraftKey = user?.id || user?.email || user?.phone || "guest";
  const draftStorageKey = `dvc-draft-${userDraftKey}-${serviceId}`;
  const legacyDraftStorageKey = `dvc-draft-${serviceId}`;

  useEffect(() => {
    let ignore = false;

    async function loadService() {
      try {
        const { data } = await getServiceById(serviceId);
        if (!ignore) setService(data);
      } catch (e) {
        const demo = demoServices[serviceId];
        if (demo && !ignore) setService({ serviceId, id: serviceId, faq: defaultFaq, ...demo });
        else if (!ignore) setError(getApiErrorMessage(e) || "Không tìm thấy dịch vụ");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadService();
    return () => {
      ignore = true;
    };
  }, [serviceId]);

  useEffect(() => {
    let ignore = false;

    function restoreDraft(draft) {
      if (ignore || !draft || String(draft.serviceId) !== String(serviceId)) return;
      setFormData((prev) => ({ ...prev, ...(draft.formData || {}) }));
      setStep(clampStep(draft.step));
      if (draft.submitResult) setSubmitResult(draft.submitResult);
      if (draft.paymentInfo) setPaymentInfo(draft.paymentInfo);
      if (draft.paymentExpireAt) setPaymentExpireAt(draft.paymentExpireAt);
      if (draft.savedPaymentStatus) setPaymentStatus(draft.savedPaymentStatus);
      const files = draft.files || Object.fromEntries((draft.attachments || []).map((item) => [item.key, item]));
      if (files && typeof files === "object") {
        setFileItems(
          Object.fromEntries(
            Object.entries(files).map(([key, item]) => [
              key,
              {
                name: item?.name || item?.fileName || "File đã lưu nháp",
                type: item?.type || item?.fileType || item?.mimeType || "",
                size: item?.size || 0,
                uploadStatus: "saved",
                progress: 100,
              },
            ])
          )
        );
      }
    }

    async function loadDraft() {
      if (user) {
        try {
          const { data } = await getServiceDraft(serviceId);
          if (data?.draft) {
            restoreDraft(data.draft);
            return;
          }
        } catch {}
      }

      const rawDraft = localStorage.getItem(draftStorageKey) || localStorage.getItem(legacyDraftStorageKey);
      if (!rawDraft) return;
      try {
        restoreDraft(JSON.parse(rawDraft));
      } catch {}
    }

    loadDraft();
    return () => {
      ignore = true;
    };
  }, [draftStorageKey, legacyDraftStorageKey, serviceId, user]);

  const docs = useMemo(() => service?.documents || [], [service]);
  const requiredDocs = useMemo(() => docs.filter((doc) => doc.required), [docs]);
  const missingDocs = useMemo(() => requiredDocs.filter((doc) => !fileItems[doc.key]), [requiredDocs, fileItems]);
  const feeAmount = Number(service?.fee || submitResult?.application?.fee || submitResult?.fee || 0);
  const isFree = feeAmount <= 0;
  const currentDossierId = getSubmitDossierId(submitResult) || paymentInfo?.dossierId;
  const isPaid = isPaidStatus(paymentStatus);
  const faq = service?.faq?.length ? service.faq : defaultFaq;
  const currentStep = wizardSteps.find((item) => item.id === step) || wizardSteps[0];

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
      if (!item.file) next[key] = "Vui lòng chọn lại file trước khi nộp hồ sơ";
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

  function handlePrimaryAction() {
    if (step < 3) return handleNext();
    if (step === 3) return submitApplication();
    return checkPaymentStatus();
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
      serviceName: service?.name || "",
      categoryName: service?.categoryName || service?.category || "",
      fee: feeAmount,
      step,
      stepTitle: currentStep.title,
      status: "DRAFT",
      paymentStatus: "UNPAID",
      userKey: userDraftKey,
      formData,
      files: Object.fromEntries(Object.entries(fileItems).map(([key, item]) => [key, { name: item.name, size: item.size, type: item.type }])),
      submitResult,
      paymentInfo,
      paymentExpireAt,
      savedPaymentStatus: paymentStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const finishDraftSave = () => {
      alert(`Lưu nháp thành công tại bước ${step}/4 - ${currentStep.title}.`);
      navigate("/my-applications?view=draft", { replace: true });
    };

    try {
      if (!user) throw new Error("AUTH_REQUIRED");
      await saveServiceDraft(serviceId, draft);
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(legacyDraftStorageKey);
      return finishDraftSave();
    } catch {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      localStorage.removeItem(legacyDraftStorageKey);
      return finishDraftSave();
    }
  }

  async function submitApplication() {
    if (!user) return navigate("/auth");
    if (!validatePersonal() || !validateFiles()) {
      setStep(1);
      return;
    }
    try {
      setSubmitting(true);
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
      await deleteServiceDraft(serviceId).catch(() => {});
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(legacyDraftStorageKey);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    <div className="min-h-screen bg-[#f4f8fd] pb-[136px] text-slate-800 sm:pb-[120px]">
      <main className="mx-auto max-w-[1200px] px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900">
            <ArrowLeft className="h-4 w-4" /> Trang chủ
          </Link>
          <span>/</span>
          <Link to="/services" className="text-blue-700 hover:text-blue-900">Dịch vụ công</Link>
          <span>/</span>
          <span className="truncate">{service.name}</span>
        </div>

        <section className="mb-4 rounded-[22px] border border-blue-100 bg-gradient-to-br from-[#073763] via-[#0b5c9a] to-[#1687c7] p-4 text-white shadow-xl shadow-blue-950/10 sm:rounded-[24px] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black ring-1 ring-white/20">
                <FileText className="h-4 w-4" /> Nộp hồ sơ trực tuyến
              </span>
              <h1 className="text-xl font-black leading-tight sm:text-3xl">{service.name}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                <MetaPill icon={Clock3} text={service.processingTime || "Theo quy định"} />
                <MetaPill icon={Banknote} text={isFree ? "Miễn phí" : `${currency.format(feeAmount)}đ`} />
                <MetaPill icon={ClipboardCheck} text={service.categoryName || service.category || "Dịch vụ công"} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-blue-800 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 sm:w-auto"
            >
              <Info className="h-4 w-4" /> Xem thông tin dịch vụ
            </button>
          </div>
        </section>

        <ProgressSteps step={step} />

        {!user && <LoginGate navigate={navigate} />}

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card>
              <StepHeader step={step} currentStep={currentStep} />
              {step === 1 && (
                <PersonalStep formData={formData} formErrors={formErrors} onChange={onChange} />
              )}
              {step === 2 && (
                <FilesStep
                  docs={docs}
                  fileItems={fileItems}
                  formErrors={formErrors}
                  dragKey={dragKey}
                  onFile={addFile}
                  onRemove={removeFile}
                  onDragState={setDragKey}
                />
              )}
              {step === 3 && (
                <ReviewStep service={service} formData={formData} docs={docs} fileItems={fileItems} feeAmount={feeAmount} isFree={isFree} />
              )}
              {step === 4 && (
                <PaymentStep
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
                  onFinish={() => navigate("/services", { replace: true })}
                />
              )}
            </Card>
            <CompactFaq faq={faq} openFaq={openFaq} setOpenFaq={setOpenFaq} />
          </div>

          <aside className="lg:sticky lg:top-5 lg:self-start">
            <ServiceInfoCard service={service} feeAmount={feeAmount} />
          </aside>
        </div>
      </main>

      {!(step === 4 && isPaid) && (
        <ActionBar
          step={step}
          currentStep={currentStep}
          submitting={submitting}
          checkingPayment={checkingPayment}
          onBack={() => setStep((current) => Math.max(1, current - 1))}
          onSave={saveDraft}
          onNext={handlePrimaryAction}
        />
      )}

      {showInfoModal && (
        <InfoModal service={service} feeAmount={feeAmount} docs={docs} onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}

function PageState({ text }) {
  return <div className="flex min-h-[60vh] items-center justify-center bg-[#f4f8fd] px-6 text-center text-lg font-black text-slate-700">{text}</div>;
}

function MetaPill({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 ring-1 ring-white/20">
      <Icon className="h-4 w-4" /> {text}
    </span>
  );
}

function ProgressSteps({ step }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {wizardSteps.map((item) => {
          const Icon = item.icon;
          const active = item.id === step;
          const done = item.id < step;
          return (
            <div
              key={item.id}
              className={`min-w-0 flex items-center gap-2 rounded-2xl px-2 py-2 text-xs font-black transition sm:px-3 sm:text-sm ${
                active ? "bg-blue-700 text-white shadow-lg shadow-blue-700/20" : done ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"
              }`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-white/18" : done ? "bg-emerald-100" : "bg-white"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="truncate">{item.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ children }) {
  return <section className="rounded-[24px] border border-[#e5edf5] bg-white p-4 shadow-sm sm:p-5">{children}</section>;
}

function StepHeader({ step, currentStep }) {
  const Icon = currentStep.icon;
  return (
    <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-blue-600">Bước {step}/4</p>
        <h2 className="text-xl font-black text-[#0f2f57]">{currentStep.title}</h2>
      </div>
    </div>
  );
}

function PersonalStep({ formData, formErrors, onChange }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-base font-black text-[#0f2f57]">Thông tin cá nhân</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Họ và tên" name="fullName" value={formData.fullName} onChange={onChange} error={formErrors.fullName} />
          <Field label="CCCD/CMND" name="citizenId" value={formData.citizenId} onChange={onChange} error={formErrors.citizenId} />
          <Field label="Số điện thoại" name="phone" value={formData.phone} onChange={onChange} error={formErrors.phone} />
          <Field label="Email" name="email" value={formData.email} onChange={onChange} error={formErrors.email} />
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-base font-black text-[#0f2f57]">Thông tin cư trú</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Tỉnh/Thành phố" name="province" value={formData.province} onChange={onChange} />
          <Field label="Quận/Huyện" name="district" value={formData.district} onChange={onChange} />
          <Field label="Phường/Xã" name="ward" value={formData.ward} onChange={onChange} />
        </div>
        <Field className="mt-3" label="Địa chỉ thường trú" name="address" value={formData.address} onChange={onChange} error={formErrors.address} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-black text-[#0f2f57]">Ghi chú bổ sung</label>
        <textarea
          name="note"
          value={formData.note}
          onChange={onChange}
          rows={3}
          placeholder="Nhập nội dung cần cán bộ lưu ý, nếu có"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </div>
    </div>
  );
}

function FilesStep({ docs, fileItems, formErrors, dragKey, onFile, onRemove, onDragState }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-500">Tải giấy tờ bắt buộc cho hồ sơ. Mỗi file tối đa 10MB.</p>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{docs.length} giấy tờ</span>
      </div>
      {formErrors.files && <InlineAlert text={formErrors.files} />}
      <div className="grid gap-3">
        {docs.map((doc) => (
          <UploadCard
            key={doc.key}
            doc={doc}
            item={fileItems[doc.key]}
            error={formErrors[doc.key]}
            active={dragKey === doc.key}
            onFile={(file) => onFile(doc.key, file)}
            onRemove={() => onRemove(doc.key)}
            onDragState={(active) => onDragState(active ? doc.key : "")}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewStep({ service, formData, docs, fileItems, feeAmount, isFree }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReviewBox title="Người nộp hồ sơ" rows={[
        ["Họ và tên", formData.fullName],
        ["CCCD/CMND", formData.citizenId],
        ["Số điện thoại", formData.phone],
        ["Email", formData.email || "Chưa nhập"],
        ["Địa chỉ", [formData.address, formData.ward, formData.district, formData.province].filter(Boolean).join(", ")],
      ]} />
      <ReviewBox title="Hồ sơ dịch vụ" rows={[
        ["Dịch vụ", service.name],
        ["Danh mục", service.categoryName || service.category || "Dịch vụ công"],
        ["Giấy tờ", `${Object.keys(fileItems).length}/${docs.length} file`],
        ["Lệ phí", isFree ? "Miễn phí" : `${currency.format(feeAmount)}đ`],
      ]} />
      {formData.note && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <p className="text-xs font-black uppercase text-slate-500">Ghi chú</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{formData.note}</p>
        </div>
      )}
    </div>
  );
}

function PaymentStep({ isFree, isPaid, paymentInfo, paymentStatus, paymentExpireAt, currentDossierId, feeAmount, checkingPayment, onCopy, onCheck, onDemoPaid, onFinish }) {
  const qrImage = paymentInfo?.qrImageUrl || paymentInfo?.qrUrl || paymentInfo?.qrCode || paymentInfo?.payment?.qrUrl || "";
  if (!currentDossierId) {
    return <InlineAlert text="Bạn cần xác nhận hồ sơ trước khi thanh toán." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[20px] border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-black uppercase text-blue-700">Mã hồ sơ</p>
        <p className="mt-1 break-all text-xl font-black text-[#0f2f57]">{currentDossierId}</p>
        <div className="mt-4 rounded-2xl bg-white p-3">
          <InfoRow label="Số tiền" value={isFree ? "Miễn phí" : `${currency.format(feeAmount)}đ`} />
          <InfoRow label="Trạng thái" value={isPaid ? "Đã thanh toán" : paymentStatusLabel(paymentStatus, "Đang chờ")} />
          {paymentExpireAt && <InfoRow label="Hạn thanh toán" value={new Date(paymentExpireAt).toLocaleString("vi-VN")} />}
        </div>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
        {isFree || isPaid ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-black">{isFree ? "Dịch vụ miễn phí" : "Thanh toán đã xác nhận"}</p>
              <p className="text-sm font-semibold">Hồ sơ đã được ghi nhận trên hệ thống.</p>
            </div>
            </div>
            <p className="mt-3 text-sm font-semibold">Nộp hồ sơ thành công. Bạn có thể kết thúc để quay về danh sách dịch vụ.</p>
            <button
              type="button"
              onClick={onFinish}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Kết thúc
            </button>
          </div>
        ) : (
          <>
            <p className="text-lg font-black text-[#0f2f57]">Thanh toán trực tuyến</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Quét mã VietQR hoặc chuyển khoản đúng nội dung để hệ thống tự đối soát.</p>
            {qrImage && (
              <img src={qrImage} alt="Mã QR thanh toán" className="mx-auto mt-4 h-56 w-56 max-w-full rounded-2xl border border-slate-200 object-contain p-2 sm:mx-0" />
            )}
            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold">
              <InfoRow label="Ngân hàng" value={paymentInfo?.bankCode || paymentInfo?.bankName || "Theo cấu hình hệ thống"} />
              <InfoRow label="Số tài khoản" value={paymentInfo?.bankAccount || paymentInfo?.accountNo || "Đang cập nhật"} />
              <InfoRow label="Nội dung" value={paymentInfo?.transferContent || currentDossierId} />
            </div>
            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              <button type="button" onClick={onCopy} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
                <Copy className="h-4 w-4" /> Sao chép nội dung
              </button>
              <button type="button" onClick={onCheck} disabled={checkingPayment} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">
                {checkingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Kiểm tra
              </button>
              {import.meta.env.DEV && (
                <button type="button" onClick={onDemoPaid} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white">Demo đã trả</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, error, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-black text-[#0f2f57]">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className={`h-12 w-full rounded-2xl border bg-white px-4 text-sm font-semibold outline-none transition focus:ring-4 ${
          error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
        }`}
      />
      {error && <span className="mt-1 flex items-center gap-1 text-xs font-bold text-rose-600"><AlertCircle className="h-3.5 w-3.5" /> {error}</span>}
    </label>
  );
}

function UploadCard({ doc, item, error, active, onFile, onRemove, onDragState }) {
  return (
    <div className={`rounded-2xl border p-3 transition ${active ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            onDragState(true);
          }}
          onDragLeave={() => onDragState(false)}
          onDrop={(event) => {
            event.preventDefault();
            onDragState(false);
            onFile(event.dataTransfer.files?.[0]);
          }}
          className="flex min-h-[76px] flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-blue-400 hover:bg-blue-50"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">
            <UploadCloud className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-[#0f2f57]">
              {doc.label} {doc.required && <b className="text-rose-500">*</b>}
            </span>
            <span className="block truncate text-xs font-semibold text-slate-500">{item ? item.name : "Kéo thả hoặc bấm để chọn file"}</span>
          </span>
          <input type="file" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
        </label>

        {item && (
          <div className="flex w-full items-center gap-3 sm:w-[240px]">
            {item.previewUrl ? (
              <img src={item.previewUrl} alt={item.name} className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <FileText className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-700">{formatSize(item.size)}</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                <div className={`h-1.5 rounded-full ${item.uploadStatus === "error" ? "bg-rose-500" : "bg-blue-600"}`} style={{ width: `${item.progress || 0}%` }} />
              </div>
            </div>
            <button type="button" onClick={onRemove} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
    </div>
  );
}

function ReviewBox({ title, rows }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 font-black text-[#0f2f57]">{title}</h3>
      <div className="space-y-2">
        {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value || "Chưa nhập"} />)}
      </div>
    </div>
  );
}

function ServiceInfoCard({ service, feeAmount }) {
  return (
    <div className="rounded-[24px] border border-[#e5edf5] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-[#0f2f57]">Thông tin dịch vụ</h3>
      <div className="mt-4 space-y-3">
        <InfoLine icon={Clock3} label="Thời gian xử lý" value={service.processingTime || "Theo quy định"} />
        <InfoLine icon={Banknote} label="Lệ phí" value={feeAmount > 0 ? `${currency.format(feeAmount)}đ` : "Miễn phí"} />
        <InfoLine icon={Building2} label="Cơ quan xử lý" value={service.agency || service.department || "Bộ phận một cửa"} />
        <InfoLine icon={MapPin} label="Hotline hỗ trợ" value={service.hotline || "1900 0000"} />
      </div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase text-slate-400">{label}</p>
        <p className="break-words text-sm font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-800">{value}</span>
    </div>
  );
}

function CompactFaq({ faq, openFaq, setOpenFaq }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpenFaq(openFaq === "list" ? null : "list")}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-[#0f2f57]"
      >
        Câu hỏi thường gặp
        <ChevronDown className={`h-4 w-4 transition ${openFaq === "list" ? "rotate-180" : ""}`} />
      </button>
      {openFaq === "list" && (
        <div className="border-t border-slate-100 p-3">
          {faq.map((item, index) => (
            <details key={item.q || index} className="group rounded-2xl px-3 py-2 open:bg-slate-50">
              <summary className="cursor-pointer text-sm font-black text-slate-700">{item.q}</summary>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{item.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginGate({ navigate }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <LogIn className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">Bạn cần đăng nhập để nộp hồ sơ</p>
          <p className="text-sm font-semibold">Bạn vẫn có thể xem thông tin dịch vụ, nhưng cần tài khoản để gửi hồ sơ.</p>
        </div>
      </div>
      <button type="button" onClick={() => navigate("/auth")} className="h-11 rounded-2xl bg-amber-600 px-4 text-sm font-black text-white">
        Đăng nhập
      </button>
    </div>
  );
}

function ActionBar({ step, currentStep, submitting, checkingPayment, onBack, onSave, onNext }) {
  return (
    <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-24px)] -translate-x-1/2 rounded-[22px] border border-slate-200 bg-white/95 p-2 shadow-2xl shadow-slate-900/15 backdrop-blur md:bottom-6 md:w-[calc(100%-64px)] md:max-w-[1200px]">
      <div className="flex min-h-[56px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="px-2">
          <p className="text-xs font-black uppercase text-slate-400">Trạng thái</p>
          <p className="text-sm font-black text-[#0f2f57]">Bước {step}/4 - {currentStep.title}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          <button type="button" onClick={onBack} disabled={step === 1 || submitting} className="h-11 rounded-2xl border border-slate-200 px-2 text-xs font-black text-slate-700 transition sm:px-3 sm:text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            Quay lại
          </button>
          <button type="button" onClick={onSave} disabled={submitting} className="inline-flex h-11 items-center justify-center gap-1 rounded-2xl border border-blue-100 bg-blue-50 px-2 text-xs font-black text-blue-700 transition sm:gap-2 sm:px-3 sm:text-sm hover:bg-blue-100 disabled:opacity-50">
            <Save className="h-4 w-4" /> Lưu nháp
          </button>
          <button type="button" onClick={onNext} disabled={submitting || checkingPayment} className="inline-flex h-11 items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-[#073763] to-[#1167ad] px-2 text-xs font-black text-white shadow-lg shadow-blue-900/20 transition sm:gap-2 sm:px-4 sm:text-sm hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
            {submitting || checkingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoModal({ service, feeAmount, docs, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-600">Thông tin dịch vụ</p>
            <h2 className="text-2xl font-black text-[#0f2f57]">{service.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {service.description && <p className="mb-4 text-sm font-semibold leading-6 text-slate-600">{service.description}</p>}
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <ServiceInfoCard service={service} feeAmount={feeAmount} />
          <div className="rounded-[24px] border border-[#e5edf5] bg-slate-50 p-5">
            <p className="text-sm font-black text-[#0f2f57]">Giấy tờ cần chuẩn bị</p>
            <p className="mt-2 text-3xl font-black text-blue-700">{docs.length}</p>
            <p className="text-sm font-semibold text-slate-500">tài liệu trong hồ sơ</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineAlert({ text }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
      <AlertCircle className="h-4 w-4" /> {text}
    </div>
  );
}

function formatSize(size = 0) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
