const { listServices, getService, upsertService, seedServicesToDynamo } = require("../store/serviceCatalogStore");
const { listCategories, seedDefaultCategories } = require("../store/serviceCategoryStore");
const { createNotification, getNotificationsByUser } = require("../store/notificationStore");
const { savePayment, getPaymentsByDossierId } = require("../store/paymentStore");
const { create, findByCode, readAll, updateByCode } = require("../store/serviceApplicationStore");
const { getIo } = require("../socket");

const ALLOWED_STATUSES = new Set(["PENDING", "PROCESSING", "NEED_MORE", "COMPLETED", "REJECTED"]);
const STATUS_LABELS = { PENDING: "Hồ sơ đã nộp", PROCESSING: "Đang xử lý", NEED_MORE: "Yêu cầu bổ sung", COMPLETED: "Đã hoàn thành", REJECTED: "Đã từ chối" };

const fallbackServices = {
  "ho-tich-khai-sinh": { serviceId: "ho-tich-khai-sinh", id: "ho-tich-khai-sinh", name: "Đăng ký khai sinh", description: "Tiếp nhận, xử lý và trả kết quả đăng ký khai sinh trực tuyến cho công dân.", categoryName: "Hộ tịch", processingTime: "3 ngày làm việc", fee: 0, documents: [{ key: "birthCert", label: "Giấy chứng sinh", required: true }, { key: "idCard", label: "CCCD/CMND người nộp", required: true }, { key: "marriageCert", label: "Giấy đăng ký kết hôn (nếu có)", required: false }], timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"], faq: [] },
  "dat-dai-bien-dong": { serviceId: "dat-dai-bien-dong", id: "dat-dai-bien-dong", name: "Đăng ký biến động đất đai", description: "Tiếp nhận hồ sơ thay đổi, sang tên hoặc cập nhật thông tin quyền sử dụng đất.", categoryName: "Đất đai", processingTime: "5 ngày làm việc", fee: 20000, documents: [{ key: "landCert", label: "Giấy chứng nhận quyền sử dụng đất", required: true }, { key: "mutationForm", label: "Đơn đăng ký biến động", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"], faq: [] },
  "xay-dung-cap-phep": { serviceId: "xay-dung-cap-phep", id: "xay-dung-cap-phep", name: "Xin cấp phép xây dựng", description: "Nộp hồ sơ đề nghị cấp phép xây dựng và theo dõi trạng thái xử lý.", categoryName: "Xây dựng", processingTime: "7 ngày làm việc", fee: 50000, documents: [{ key: "landCert", label: "Giấy tờ quyền sử dụng đất", required: true }, { key: "design", label: "Bản vẽ thiết kế", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"], faq: [] },
  "gplx-doi": { serviceId: "gplx-doi", id: "gplx-doi", name: "Đổi giấy phép lái xe", description: "Tiếp nhận hồ sơ đổi giấy phép lái xe theo quy trình điện tử.", categoryName: "Giao thông", processingTime: "4 ngày làm việc", fee: 150000, documents: [{ key: "oldLicense", label: "Giấy phép lái xe cũ", required: true }, { key: "health", label: "Giấy khám sức khỏe", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"], faq: [] },
  "ho-chieu-pho-thong": { serviceId: "ho-chieu-pho-thong", id: "ho-chieu-pho-thong", name: "Cấp hộ chiếu phổ thông", description: "Tiếp nhận hồ sơ cấp hộ chiếu phổ thông cho công dân đủ điều kiện.", categoryName: "Hộ chiếu", processingTime: "8 ngày làm việc", fee: 200000, documents: [{ key: "photo", label: "Ảnh chân dung", required: true }, { key: "idCard", label: "CCCD/CMND", required: true }], timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"], faq: [] },
  "doanh-nghiep-thanh-lap": { serviceId: "doanh-nghiep-thanh-lap", id: "doanh-nghiep-thanh-lap", name: "Đăng ký thành lập doanh nghiệp", description: "Nộp hồ sơ đăng ký doanh nghiệp và theo dõi tiến trình xử lý.", categoryName: "Doanh nghiệp", processingTime: "3-5 ngày làm việc", fee: 100000, documents: [{ key: "charter", label: "Điều lệ công ty", required: true }, { key: "memberList", label: "Danh sách thành viên/cổ đông", required: true }, { key: "idCard", label: "CCCD/CMND người đại diện", required: true }], timeline: ["Tiếp nhận hồ sơ", "Kiểm tra tính hợp lệ", "Xử lý chuyên viên", "Phê duyệt / bổ sung", "Trả kết quả"], faq: [] }
};

/** ID demo trên trang chủ → ID dịch vụ trong catalog backend */
const SERVICE_ALIASES = {
  "demo-ho-tich": "ho-tich-khai-sinh",
  "demo-dat-dai": "dat-dai-bien-dong",
  "demo-xay-dung": "xay-dung-cap-phep",
  "demo-gplx": "gplx-doi",
  "demo-ho-chieu": "ho-chieu-pho-thong",
  "demo-doanh-nghiep": "doanh-nghiep-thanh-lap",
};

function generateDossierCode() { const now = new Date(); return `HS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function validateForm(formData) { const errors = {}; if (!formData?.fullName?.trim()) errors.fullName = "Họ tên là bắt buộc"; if (!/^[0-9]{12}$/.test(formData?.citizenId || "")) errors.citizenId = "CCCD phải đủ 12 số"; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.email || "")) errors.email = "Email không đúng định dạng"; if (!/^[0-9]{10,11}$/.test(formData?.phone || "")) errors.phone = "Số điện thoại không hợp lệ"; if (!formData?.address?.trim()) errors.address = "Địa chỉ là bắt buộc"; return errors; }
function userId(req) { return req.user?.id || req.user?._id || req.user?.sub || req.user?.email || null; }
function nowIso() { return new Date().toISOString(); }
function normalizeStatus(status) { const s = String(status || "").trim().toUpperCase(); return ALLOWED_STATUSES.has(s) ? s : "PENDING"; }
function pushTimeline(application, entry) { const timelineItem = { status: normalizeStatus(entry.status), action: String(entry.action || "").trim(), note: String(entry.note || "").trim(), actor: String(entry.actor || "").trim(), createdAt: entry.createdAt || nowIso() }; const timeline = [...(application.timeline || application.history || []), timelineItem]; return timeline; }

function withRequestedServiceId(service, requestedId) {
  if (!service || !requestedId || requestedId === service.serviceId) return service;
  return { ...service, serviceId: requestedId, id: requestedId };
}

function resolveService(serviceId) {
  const requestedId = String(serviceId || "").trim();
  const canonicalId = SERVICE_ALIASES[requestedId] || requestedId;
  const local = fallbackServices[canonicalId];
  if (local) return Promise.resolve(withRequestedServiceId(local, requestedId));
  return getService(canonicalId).then((svc) => withRequestedServiceId(svc || null, requestedId));
}

function slugify(text) { return String(text || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function pad4() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }
function todayStamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
function generateCode(prefix) { return `${prefix}-${todayStamp()}-${pad4()}`; }
function generateServiceId() { return generateCode("DV"); }
function generateRequirementId() { return generateCode("GT"); }
function generateFaqId() { return generateCode("FAQ"); }
function generateStepId() { return generateCode("STEP"); }
function validateServicePayload(body) { const errors = {}; if (!String(body?.name || "").trim()) errors.name = "Tên dịch vụ là bắt buộc"; if (!String(body?.categoryId || "").trim()) errors.categoryId = "Danh mục là bắt buộc"; const fee = Number(body?.fee ?? 0); if (Number.isNaN(fee) || fee < 0) errors.fee = "Lệ phí phải lớn hơn hoặc bằng 0"; if (!String(body?.processingTime || "").trim()) errors.processingTime = "Thời gian xử lý không được để trống"; if (!String(body?.agency || "").trim()) errors.agency = "Cơ quan xử lý là bắt buộc"; return errors; }
exports.getServiceCategories = async (_req, res) => {
  try {
    const categories = await listCategories();
    return res.json({ categories });
  } catch (error) {
    console.error("[getServiceCategories] error:", error);
    return res.status(500).json({ message: error.message || "Không tải được danh mục" });
  }
};
exports.seedServiceCategories = async (_req, res) => {
  try {
    const result = await seedDefaultCategories();
    return res.json({ message: "Đã seed danh mục mặc định", ...result });
  } catch (error) {
    console.error("[seedServiceCategories] error:", error);
    return res.status(500).json({ message: error.message || "Không seed được danh mục" });
  }
};
exports.getServices = async (req, res) => { const q = String(req.query.q || "").toLowerCase(); const category = String(req.query.category || "").toLowerCase(); const items = await listServices(); const filtered = items.filter((s) => { const text = `${s.name || ""} ${s.description || ""} ${s.categoryName || ""}`.toLowerCase(); return (!q || text.includes(q)) && (!category || String(s.categoryId || s.categoryName || "").toLowerCase() === category); }); res.json({ services: filtered }); };
exports.getServiceById = async (req, res) => { const service = await resolveService(req.params.serviceId); if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ" }); res.json(service); };
exports.submitApplication = async (req, res) => { const { serviceId, formData = {}, attachments = [], paymentMethod = "BANK_TRANSFER" } = req.body; if (!serviceId) return res.status(400).json({ message: "Thiếu serviceId" }); const service = await resolveService(serviceId); if (!service) return res.status(404).json({ message: "Dịch vụ không tồn tại" }); const errors = validateForm(formData); if (Object.keys(errors).length) return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors }); const dossierCode = generateDossierCode(); const dossierId = dossierCode; const createdAt = nowIso(); const timeline = [{ status: "PENDING", action: "submit", note: "Hồ sơ đã được nộp", actor: userId(req) || "user", createdAt }]; const application = { dossierCode, dossierId, id: dossierId, userId: userId(req), serviceId, serviceName: service.name, formData, citizenName: formData.fullName, phone: formData.phone, email: formData.email, attachments, paymentMethod, status: "PENDING", paymentStatus: "UNPAID", progress: 10, timeline, history: timeline, createdAt, updatedAt: createdAt, fee: service.fee || 0 }; await create(application); res.status(201).json({ message: "Nộp hồ sơ thành công", dossierId, dossierCode, application }); };
exports.getApplicationByCode = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Không tìm thấy hồ sơ" }); const payments = await getPaymentsByDossierId(application.dossierId || dossierId); const notifications = application.userId ? await getNotificationsByUser(application.userId) : []; res.json({ application, payments, notifications, timeline: application.timeline || application.history || [], statusDescription: STATUS_LABELS[application.status] || application.status }); };
exports.getMyApplications = async (req, res) => { const items = await readAll(); const filtered = items.filter((x) => !userId(req) || x.userId === userId(req)); res.json({ applications: filtered.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) }); };
exports.trackApplication = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Không tìm thấy hồ sơ" }); const payments = await getPaymentsByDossierId(application.dossierId || dossierId); const notifications = application.userId ? await getNotificationsByUser(application.userId) : []; res.json({ application, payments, notifications, timeline: application.timeline || application.history || [], statusDescription: STATUS_LABELS[application.status] || application.status }); };
exports.payForApplication = async (req, res) => { const { dossierId, dossierCode, paymentMethod = "BANK_TRANSFER", amount } = req.body; const targetDossierId = String(dossierId || dossierCode || "").trim(); const application = await findByCode(targetDossierId); if (!application) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
  const paymentId = `PAY-${Date.now()}`;
  const transferContent = `DH${Date.now()}`;
  const payment = {
    paymentId,
    dossierId: application.dossierId,
    amount: Number(amount || application.fee || 0),
    paymentMethod,
    provider: "SEPAY",
    paymentStatus: "PENDING",
    transactionId: "",
    transactionDate: "",
    bankCode: "",
    bankAccount: "",
    bankAccountName: "",
    transferContent,
    qrUrl: "",
    paidAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await savePayment(payment);
  await updateByCode(application.dossierId, { ...application, paymentStatus: "PENDING", updatedAt: nowIso() });
  return res.status(200).json({ message: "Đã tạo bản ghi thanh toán PENDING", payment }); };
exports.adminCreateService = async (req, res) => { const body = req.body || {}; const validationErrors = validateServicePayload(body); if (Object.keys(validationErrors).length) return res.status(400).json({ message: "Dữ liệu dịch vụ không hợp lệ", errors: validationErrors }); const serviceId = generateServiceId(); const requirementId = generateRequirementId(); const faqId = generateFaqId(); const stepId = generateStepId(); const item = { serviceId, id: serviceId, name: String(body.name || "").trim(), description: String(body.description || "").trim(), categoryId: String(body.categoryId || "").trim(), categoryName: String(body.categoryName || body.category || "Khác").trim(), fee: Number(body.fee || 0), processingTime: String(body.processingTime || ""), documents: Array.isArray(body.documents) ? body.documents.map((doc) => ({ ...doc, requirementId, id: requirementId })) : [], faq: Array.isArray(body.faq) ? body.faq.map((faq) => ({ ...faq, faqId, id: faqId })) : [], timeline: Array.isArray(body.timeline) ? body.timeline.map((step) => ({ ...(typeof step === "object" ? step : { status: step }), stepId, id: stepId })) : [], workflow: Array.isArray(body.workflow) ? body.workflow.map((step) => ({ ...(typeof step === "object" ? step : { status: step }), stepId, id: stepId })) : [], active: body.active !== false, updatedAt: new Date().toISOString(), createdAt: body.createdAt || new Date().toISOString(), agency: String(body.agency || "").trim(), level: String(body.level || "Mức 3").trim() }; await upsertService(item); res.status(201).json({ message: "Đã lưu dịch vụ", service: item, serviceId, requirementId, faqId, stepId }); };
exports.seedServices = async (_req, res) => { const result = await seedServicesToDynamo(); res.json({ message: "Đã seed dịch vụ vào DynamoDB", ...result }); };
exports.adminUpdateService = async (req, res) => { const serviceId = req.params.serviceId; const current = await resolveService(serviceId); if (!current) return res.status(404).json({ message: "Không tìm thấy dịch vụ" }); const next = { ...current, ...req.body, serviceId, id: serviceId, updatedAt: nowIso() }; await upsertService(next); res.json({ message: "Đã cập nhật dịch vụ", service: next }); };

exports.updateApplicationStatus = async (req, res) => {
  try {
    const dossierId = String(req.params.applicationCode || req.params.id || req.body?.dossierId || req.body?.dossierCode || req.body?.applicationCode || "").trim();
    const application = await findByCode(dossierId);
    if (!application) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });

    const status = normalizeStatus(req.body?.status);
    const note = String(req.body?.note || "").trim();
    const action = String(req.body?.action || req.method?.toLowerCase() || status.toLowerCase()).trim();
    if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    if ((status === "NEED_MORE" || status === "REJECTED") && !note) return res.status(400).json({ message: "Vui lòng nhập lý do" });

    const now = nowIso();
    const timeline = pushTimeline(application, { status, action, note, actor: req.user?.email || req.user?.id || "admin", createdAt: now });
    const updated = await updateByCode(application.dossierId || dossierId, { ...application, status, updatedAt: now, timeline, history: timeline, decisionNote: note || application.decisionNote || "" });
    if (!updated) return res.status(500).json({ message: "Không cập nhật được hồ sơ" });

    try {
      if (updated.userId) {
        await createNotification({ notificationId: `NTF-${Date.now()}`, userId: updated.userId, dossierId: updated.dossierId, title: `Hồ sơ ${updated.dossierId} cập nhật trạng thái`, message: `${updated.serviceName || "Hồ sơ"} đã chuyển sang trạng thái ${status}.`, createdAt: now });
        const io = getIo();
        io?.to?.(`user_${updated.userId}`)?.emit?.("service-application-updated", { dossierId: updated.dossierId, status, timeline });
      }
    } catch (socketErr) {
      console.warn("[updateApplicationStatus] notification/socket error:", socketErr?.message || socketErr);
    }

    return res.json({ message: "Đã cập nhật trạng thái hồ sơ", application: updated });
  } catch (err) {
    console.error("[updateApplicationStatus] error:", err);
    return res.status(500).json({ message: err.message || "Lỗi cập nhật trạng thái hồ sơ" });
  }
};

exports.addApplicationSupplement = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Không tìm thấy hồ sơ" }); if (application.userId && userId(req) && String(application.userId) !== String(userId(req))) return res.status(403).json({ message: "Không có quyền bổ sung hồ sơ này" }); if (String(application.status || "").toUpperCase() !== "NEED_MORE") return res.status(400).json({ message: "Hồ sơ hiện không ở trạng thái yêu cầu bổ sung" }); const { formData = {}, attachments = [] } = req.body || {}; const nextFormData = { ...(application.formData || {}), ...formData }; const nextAttachments = Array.isArray(attachments) && attachments.length ? attachments : (application.attachments || []); const timeline = pushTimeline(application, { status: "PROCESSING", action: "supplement", note: "Người dân đã bổ sung hồ sơ", actor: userId(req) || "citizen", createdAt: nowIso() }); const updated = await updateByCode(application.dossierId || dossierId, { ...application, formData: nextFormData, attachments: nextAttachments, status: "PROCESSING", updatedAt: nowIso(), timeline, history: timeline }); return res.json({ message: "Đã bổ sung hồ sơ", application: updated }); };

exports.downloadApplicationResult = async (req, res) => { const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim(); const application = await findByCode(dossierId); if (!application) return res.status(404).json({ message: "Không tìm thấy hồ sơ" }); if (String(application.status || "").toUpperCase() !== "COMPLETED") return res.status(400).json({ message: "Hồ sơ chưa hoàn thành" }); const payload = { dossierId: application.dossierId, dossierCode: application.dossierCode, serviceName: application.serviceName, citizenName: application.citizenName, completedAt: nowIso(), decisionNote: application.decisionNote || "" }; res.json({ message: "Tải kết quả thành công", result: payload }); };
exports.adminDeleteService = async (req, res) => { const serviceId = req.params.serviceId; const current = await resolveService(serviceId); if (!current) return res.status(404).json({ message: "Không tìm thấy dịch vụ" }); await upsertService({ ...current, active: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); res.json({ message: "Đã xóa dịch vụ" }); };
