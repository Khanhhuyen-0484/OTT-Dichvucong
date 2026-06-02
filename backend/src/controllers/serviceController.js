const { listServices, getService, upsertService, seedServicesToDynamo } = require("../store/serviceCatalogStore");
const { listCategories, seedDefaultCategories } = require("../store/serviceCategoryStore");
const { createNotification, getNotificationsByUser } = require("../store/notificationStore");
const { savePayment, getPaymentsByDossierId } = require("../store/paymentStore");
const { create, findByCode, readAll, updateByCode, deleteByCode, findDuplicateByCitizenAndService } = require("../store/serviceApplicationStore");
const { createPresignedGet } = require("../config/s3");
const { getIo } = require("../socket");

const ALLOWED_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "NEED_MORE",
  "SUPPLEMENTED",
  "COMPLETED",
  "RESULT_DELIVERED",
  "REJECTED"
]);

const STATUS_LABELS = {
  DRAFT: "Báº£n nhÃ¡p",
  PENDING_PAYMENT: "Chá» thanh toÃ¡n",
  PAID: "ÄÃ£ thanh toÃ¡n",
  PENDING: "Há»“ sÆ¡ Ä‘Ã£ ná»™p",
  PROCESSING: "Äang xá»­ lÃ½",
  NEED_MORE: "YÃªu cáº§u bá»• sung",
  APPROVED: "ÄÃ£ duyá»‡t",
  SUPPLEMENTED: "ÄÃ£ bá»• sung",
  COMPLETED: "ÄÃ£ hoÃ n thÃ nh",
  RESULT_DELIVERED: "ÄÃ£ tráº£ káº¿t quáº£",
  CANCELLED: "ÄÃ£ há»§y",
  REJECTED: "ÄÃ£ tá»« chá»‘i"
};

const DEFAULT_TIMELINE = [
  "Tiáº¿p nháº­n há»“ sÆ¡",
  "Kiá»ƒm tra tÃ­nh há»£p lá»‡",
  "Xá»­ lÃ½ chuyÃªn viÃªn",
  "PhÃª duyá»‡t / bá»• sung",
  "Tráº£ káº¿t quáº£"
];

const fallbackServices = {
  "ho-tich-khai-sinh": {
    serviceId: "ho-tich-khai-sinh",
    id: "ho-tich-khai-sinh",
    name: "ÄÄƒng kÃ½ khai sinh",
    description: "Tiáº¿p nháº­n, xá»­ lÃ½ vÃ  tráº£ káº¿t quáº£ Ä‘Äƒng kÃ½ khai sinh trá»±c tuyáº¿n cho cÃ´ng dÃ¢n.",
    categoryName: "Há»™ tá»‹ch",
    processingTime: "3 ngÃ y lÃ m viá»‡c",
    fee: 0,
    documents: [
      { key: "birthCert", label: "Giáº¥y chá»©ng sinh", required: true },
      { key: "idCard", label: "CCCD/CMND ngÆ°á»i ná»™p", required: true },
      { key: "marriageCert", label: "Giáº¥y Ä‘Äƒng kÃ½ káº¿t hÃ´n (náº¿u cÃ³)", required: false }
    ],
    timeline: DEFAULT_TIMELINE,
    faq: []
  },
  "dat-dai-bien-dong": {
    serviceId: "dat-dai-bien-dong",
    id: "dat-dai-bien-dong",
    name: "ÄÄƒng kÃ½ biáº¿n Ä‘á»™ng Ä‘áº¥t Ä‘ai",
    description: "Tiáº¿p nháº­n há»“ sÆ¡ thay Ä‘á»•i, sang tÃªn hoáº·c cáº­p nháº­t thÃ´ng tin quyá»n sá»­ dá»¥ng Ä‘áº¥t.",
    categoryName: "Äáº¥t Ä‘ai",
    processingTime: "5 ngÃ y lÃ m viá»‡c",
    fee: 20000,
    documents: [
      { key: "landCert", label: "Giáº¥y chá»©ng nháº­n quyá»n sá»­ dá»¥ng Ä‘áº¥t", required: true },
      { key: "mutationForm", label: "ÄÆ¡n Ä‘Äƒng kÃ½ biáº¿n Ä‘á»™ng", required: true },
      { key: "idCard", label: "CCCD/CMND", required: true }
    ],
    timeline: DEFAULT_TIMELINE,
    faq: []
  },
  "xay-dung-cap-phep": {
    serviceId: "xay-dung-cap-phep",
    id: "xay-dung-cap-phep",
    name: "Xin cáº¥p phÃ©p xÃ¢y dá»±ng",
    description: "Ná»™p há»“ sÆ¡ Ä‘á» nghá»‹ cáº¥p phÃ©p xÃ¢y dá»±ng vÃ  theo dÃµi tráº¡ng thÃ¡i xá»­ lÃ½.",
    categoryName: "XÃ¢y dá»±ng",
    processingTime: "7 ngÃ y lÃ m viá»‡c",
    fee: 50000,
    documents: [
      { key: "landCert", label: "Giáº¥y tá» quyá»n sá»­ dá»¥ng Ä‘áº¥t", required: true },
      { key: "design", label: "Báº£n váº½ thiáº¿t káº¿", required: true },
      { key: "idCard", label: "CCCD/CMND", required: true }
    ],
    timeline: DEFAULT_TIMELINE,
    faq: []
  },
  "gplx-doi": {
    serviceId: "gplx-doi",
    id: "gplx-doi",
    name: "Äá»•i giáº¥y phÃ©p lÃ¡i xe",
    description: "Tiáº¿p nháº­n há»“ sÆ¡ Ä‘á»•i giáº¥y phÃ©p lÃ¡i xe theo quy trÃ¬nh Ä‘iá»‡n tá»­.",
    categoryName: "Giao thÃ´ng",
    processingTime: "4 ngÃ y lÃ m viá»‡c",
    fee: 150000,
    documents: [
      { key: "oldLicense", label: "Giáº¥y phÃ©p lÃ¡i xe cÅ©", required: true },
      { key: "health", label: "Giáº¥y khÃ¡m sá»©c khá»e", required: true },
      { key: "idCard", label: "CCCD/CMND", required: true }
    ],
    timeline: DEFAULT_TIMELINE,
    faq: []
  },
  "ho-chieu-pho-thong": {
    serviceId: "ho-chieu-pho-thong",
    id: "ho-chieu-pho-thong",
    name: "Cáº¥p há»™ chiáº¿u phá»• thÃ´ng",
    description: "Tiáº¿p nháº­n há»“ sÆ¡ cáº¥p há»™ chiáº¿u phá»• thÃ´ng cho cÃ´ng dÃ¢n Ä‘á»§ Ä‘iá»u kiá»‡n.",
    categoryName: "Há»™ chiáº¿u",
    processingTime: "8 ngÃ y lÃ m viá»‡c",
    fee: 200000,
    documents: [
      { key: "photo", label: "áº¢nh chÃ¢n dung", required: true },
      { key: "idCard", label: "CCCD/CMND", required: true }
    ],
    timeline: DEFAULT_TIMELINE,
    faq: []
  },
  "doanh-nghiep-thanh-lap": {
    serviceId: "doanh-nghiep-thanh-lap",
    id: "doanh-nghiep-thanh-lap",
    name: "ÄÄƒng kÃ½ thÃ nh láº­p doanh nghiá»‡p",
    description: "Ná»™p há»“ sÆ¡ Ä‘Äƒng kÃ½ doanh nghiá»‡p vÃ  theo dÃµi tiáº¿n trÃ¬nh xá»­ lÃ½.",
    categoryName: "Doanh nghiá»‡p",
    processingTime: "3-5 ngÃ y lÃ m viá»‡c",
    fee: 100000,
    documents: [
      { key: "charter", label: "Äiá»u lá»‡ cÃ´ng ty", required: true },
      { key: "memberList", label: "Danh sÃ¡ch thÃ nh viÃªn/cá»• Ä‘Ã´ng", required: true },
      { key: "idCard", label: "CCCD/CMND ngÆ°á»i Ä‘áº¡i diá»‡n", required: true }
    ],
    timeline: DEFAULT_TIMELINE,
    faq: []
  }
};

/** ID demo trÃªn trang chá»§ -> ID dá»‹ch vá»¥ trong catalog backend */
const SERVICE_ALIASES = {
  "demo-ho-tich": "ho-tich-khai-sinh",
  "demo-dat-dai": "dat-dai-bien-dong",
  "demo-xay-dung": "xay-dung-cap-phep",
  "demo-gplx": "gplx-doi",
  "demo-ho-chieu": "ho-chieu-pho-thong",
  "demo-doanh-nghiep": "doanh-nghiep-thanh-lap"
};

function generateDossierCode() {
  const now = new Date();
  return `HS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function validateForm(formData) {
  const errors = {};
  if (!formData?.fullName?.trim()) errors.fullName = "Há» tÃªn lÃ  báº¯t buá»™c";
  if (!/^[0-9]{12}$/.test(formData?.citizenId || "")) errors.citizenId = "CCCD pháº£i Ä‘á»§ 12 sá»‘";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.email || "")) errors.email = "Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng";
  if (!/^[0-9]{10,11}$/.test(formData?.phone || "")) errors.phone = "Sá»‘ Ä‘iá»‡n thoáº¡i khÃ´ng há»£p lá»‡";
  if (!formData?.address?.trim()) errors.address = "Äá»‹a chá»‰ lÃ  báº¯t buá»™c";
  return errors;
}

function userId(req) {
  return req.user?.id || req.user?._id || req.user?.sub || req.user?.email || null;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toUpperCase();
  return ALLOWED_STATUSES.has(s) ? s : "PENDING";
}

function pushTimeline(application, entry) {
  const timelineItem = {
    status: normalizeStatus(entry.status),
    action: String(entry.action || "").trim(),
    note: String(entry.note || "").trim(),
    actor: String(entry.actor || "").trim(),
    createdAt: entry.createdAt || nowIso()
  };
  return [...(application.timeline || application.history || []), timelineItem];
}

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

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pad4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function generateCode(prefix) {
  return `${prefix}-${todayStamp()}-${pad4()}`;
}

function generateServiceId() {
  return generateCode("DV");
}

function generateRequirementId() {
  return generateCode("GT");
}

function generateFaqId() {
  return generateCode("FAQ");
}

function generateStepId() {
  return generateCode("STEP");
}

function validateServicePayload(body) {
  const errors = {};
  if (!String(body?.name || "").trim()) errors.name = "TÃªn dá»‹ch vá»¥ lÃ  báº¯t buá»™c";
  if (!String(body?.categoryId || "").trim()) errors.categoryId = "Danh má»¥c lÃ  báº¯t buá»™c";
  const fee = Number(body?.fee ?? 0);
  if (Number.isNaN(fee) || fee < 0) errors.fee = "Lá»‡ phÃ­ pháº£i lá»›n hÆ¡n hoáº·c báº±ng 0";
  if (!String(body?.processingTime || "").trim()) errors.processingTime = "Thá»i gian xá»­ lÃ½ khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng";
  if (!String(body?.agency || "").trim()) errors.agency = "CÆ¡ quan xá»­ lÃ½ lÃ  báº¯t buá»™c";
  return errors;
}

exports.getServiceCategories = async (_req, res) => {
  try {
    const categories = await listCategories();
    return res.json({ categories });
  } catch (error) {
    console.error("[getServiceCategories] error:", error);
    return res.status(500).json({ message: error.message || "KhÃ´ng táº£i Ä‘Æ°á»£c danh má»¥c" });
  }
};

exports.seedServiceCategories = async (_req, res) => {
  try {
    const result = await seedDefaultCategories();
    return res.json({ message: "ÄÃ£ seed danh má»¥c máº·c Ä‘á»‹nh", ...result });
  } catch (error) {
    console.error("[seedServiceCategories] error:", error);
    return res.status(500).json({ message: error.message || "KhÃ´ng seed Ä‘Æ°á»£c danh má»¥c" });
  }
};

exports.getServices = async (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const category = String(req.query.category || "").toLowerCase();
  const items = await listServices();
  const filtered = items.filter((s) => {
    const text = `${s.name || ""} ${s.description || ""} ${s.categoryName || ""} ${s.category || ""}`.toLowerCase();
    const categoryValues = [s.categoryId, s.categoryName, s.category]
      .map((value) => String(value || "").toLowerCase())
      .filter(Boolean);
    return (!q || text.includes(q)) && (!category || categoryValues.includes(category));
  });
  res.json({ services: filtered });
};

exports.getServiceById = async (req, res) => {
  const service = await resolveService(req.params.serviceId);
  if (!service) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥" });
  res.json(service);
};

exports.checkDuplicateDossier = async (req, res) => {
  try {
    const citizenId = String(req.body?.citizenId || req.body?.cccd || "").trim();
    const serviceId = String(req.body?.serviceId || "").trim();
    if (!/^[0-9]{9,12}$/.test(citizenId)) return res.status(400).json({ message: "CCCD/CMND không hợp lệ" });
    if (!serviceId) return res.status(400).json({ message: "Thiếu serviceId" });

    const result = await checkDuplicateApplication(citizenId, serviceId);
    return res.json(result);
  } catch (error) {
    console.error("[checkDuplicateDossier] error:", error);
    return res.status(500).json({ message: error.message || "Không kiểm tra được hồ sơ trùng" });
  }
};

exports.submitApplication = async (req, res) => {
  const { serviceId, formData = {}, attachments = [], paymentMethod = "BANK_TRANSFER" } = req.body;
  if (!serviceId) return res.status(400).json({ message: "Thiáº¿u serviceId" });

  const service = await resolveService(serviceId);
  if (!service) return res.status(404).json({ message: "Dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i" });

  const errors = validateForm(formData);
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡", errors });
  }

  const duplicate = await checkDuplicateApplication(formData.citizenId, serviceId);
  if (duplicate.duplicate) {
    return res.status(409).json({
      ...duplicate,
      message: "Đã tồn tại hồ sơ cho dịch vụ này.",
    });
  }

  const dossierCode = generateDossierCode();
  const dossierId = dossierCode;
  const createdAt = nowIso();
  const fee = Number(service.fee || 0);
  const shouldGoToAdmin = fee <= 0;
  const status = shouldGoToAdmin ? "PENDING" : "DRAFT";
  const timeline = shouldGoToAdmin
    ? [
        {
          status: "PENDING",
          action: "submit",
          note: "Há»“ sÆ¡ Ä‘Ã£ Ä‘Æ°á»£c ná»™p",
          actor: userId(req) || "user",
          createdAt
        }
      ]
    : [];

  const application = {
    dossierCode,
    dossierId,
    id: dossierId,
    userId: userId(req),
    serviceId,
    serviceName: service.name,
    formData,
    citizenName: formData.fullName,
    phone: formData.phone,
    email: formData.email,
    attachments,
    paymentMethod,
    status,
    paymentStatus: fee <= 0 ? "PAID" : "UNPAID",
    progress: shouldGoToAdmin ? 10 : 0,
    timeline,
    history: timeline,
    createdAt,
    updatedAt: createdAt,
    fee
  };

  await create(application);
  res.status(201).json({
    message: shouldGoToAdmin ? "Ná»™p há»“ sÆ¡ thÃ nh cÃ´ng" : "ÄÃ£ lÆ°u nhÃ¡p há»“ sÆ¡, vui lÃ²ng thanh toÃ¡n Ä‘á»ƒ gá»­i há»“ sÆ¡",
    dossierId,
    dossierCode,
    application,
    isDraft: !shouldGoToAdmin
  });
};

exports.getApplicationByCode = async (req, res) => {
  const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim();
  const application = await findByCode(dossierId);
  if (!application) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡" });
  const role = String(req.user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "staff";
  if (!isAdmin && application.userId && userId(req) && String(application.userId) !== String(userId(req))) {
    return res.status(403).json({ message: "Không có quyền xem hồ sơ này" });
  }

  const payments = await getPaymentsByDossierId(application.dossierId || dossierId);
  const notifications = application.userId ? await getNotificationsByUser(application.userId) : [];
  const paymentStatus = String(application.paymentStatus || "").toUpperCase();
  const visibleApplication =
    Number(application.fee || 0) <= 0 || paymentStatus === "COMPLETED" || paymentStatus === "PAID"
      ? application
      : { ...application, status: "DRAFT", timeline: [], history: [] };
  const publicApplication = {
    ...visibleApplication,
    resultFileUrl: undefined,
    resultFileKey: undefined
  };

  res.json({
    application: publicApplication,
    payments,
    notifications,
    timeline: publicApplication.timeline || publicApplication.history || [],
    statusDescription: STATUS_LABELS[publicApplication.status] || publicApplication.status
  });
};

exports.getMyApplications = async (req, res) => {
  const scope = String(req.query?.scope || "submitted").toLowerCase();
  const items = await readAll();
  const byUser = items.filter((x) => !userId(req) || x.userId === userId(req));
  const drafts = byUser.filter(
    (x) =>
      String(x.status || "").toUpperCase() === "DRAFT" ||
      (Number(x.fee || 0) > 0 && !["COMPLETED", "PAID"].includes(String(x.paymentStatus || "").toUpperCase()))
  );
  const submitted = byUser.filter(
    (x) => Number(x.fee || 0) <= 0 || ["COMPLETED", "PAID"].includes(String(x.paymentStatus || "").toUpperCase())
  );
  const applications = scope === "all" ? byUser : submitted;
  res.json({
    applications: applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    drafts: drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    submitted: submitted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
};

function findWizardDraft(items, uid, serviceId) {
  return items
    .filter(
      (item) =>
        item.userId === uid &&
        String(item.serviceId || "") === String(serviceId || "") &&
        String(item.status || "").toUpperCase() === "DRAFT" &&
        String(item.draftType || "").toUpperCase() === "WIZARD"
    )
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
}

function duplicatePayload(application) {
  if (!application) return null;
  const status = application.duplicateStatus || application.status || "";
  return {
    dossierId: application.dossierId || application.applicationCode || application.id || "",
    dossierCode: application.dossierCode || application.applicationCode || application.dossierId || "",
    status,
    statusLabel: STATUS_LABELS[status] || status,
    submittedAt: application.submittedAt || application.createdAt || application.updatedAt || "",
    serviceId: application.serviceId || "",
    serviceName: application.serviceName || "",
    reason: application.decisionNote || application.rejectReason || application.resultNote || "",
  };
}

async function checkDuplicateApplication(citizenId, serviceId) {
  const result = await findDuplicateByCitizenAndService(citizenId, serviceId);
  if (result.duplicate) {
    return {
      duplicate: true,
      ...duplicatePayload(result.application),
      message: "Bạn đã có hồ sơ cho dịch vụ này.",
    };
  }
  const lastApplication = duplicatePayload(result.application);
  return lastApplication ? { duplicate: false, lastApplication } : { duplicate: false };
}

exports.getServiceDraft = async (req, res) => {
  const uid = userId(req);
  const serviceId = String(req.params.serviceId || "").trim();
  if (!uid) return res.status(401).json({ message: "Vui lÃ²ng Ä‘Äƒng nháº­p" });
  if (!serviceId) return res.status(400).json({ message: "Thiáº¿u serviceId" });

  const items = await readAll();
  const draft = findWizardDraft(items, uid, serviceId);
  return res.json({ draft });
};

exports.saveServiceDraft = async (req, res) => {
  const uid = userId(req);
  const serviceId = String(req.params.serviceId || req.body?.serviceId || "").trim();
  if (!uid) return res.status(401).json({ message: "Vui lÃ²ng Ä‘Äƒng nháº­p" });
  if (!serviceId) return res.status(400).json({ message: "Thiáº¿u serviceId" });

  const service = await resolveService(serviceId);
  if (!service) return res.status(404).json({ message: "Dá»‹ch vá»¥ khÃ´ng tá»“n táº¡i" });

  const items = await readAll();
  const existing = findWizardDraft(items, uid, serviceId);
  const now = nowIso();
  const step = Math.min(4, Math.max(1, Number(req.body?.step || existing?.step || 1)));
  const dossierId = existing?.dossierId || generateDossierCode();
  const files = req.body?.files && typeof req.body.files === "object" ? req.body.files : {};
  const attachments = Object.entries(files).map(([key, item]) => ({
    key,
    name: item?.name || "",
    fileName: item?.name || "",
    mimeType: item?.type || "",
    fileType: item?.type || "",
    size: Number(item?.size || 0),
  }));

  const draft = {
    ...(existing || {}),
    dossierCode: dossierId,
    dossierId,
    id: dossierId,
    userId: uid,
    serviceId,
    serviceName: service.name,
    formData: req.body?.formData || {},
    citizenName: req.body?.formData?.fullName || "",
    phone: req.body?.formData?.phone || "",
    email: req.body?.formData?.email || "",
    attachments,
    draftType: "WIZARD",
    step,
    stepTitle: String(req.body?.stepTitle || "").trim(),
    status: "DRAFT",
    paymentStatus: "UNPAID",
    progress: 0,
    fee: Number(service.fee || req.body?.fee || 0),
    timeline: [],
    history: [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const saved = existing ? await updateByCode(existing.dossierId, draft) : await create(draft);
  return res.json({ message: "ÄÃ£ lÆ°u nhÃ¡p há»“ sÆ¡", draft: saved });
};

exports.deleteServiceDraft = async (req, res) => {
  const uid = userId(req);
  const serviceId = String(req.params.serviceId || "").trim();
  if (!uid) return res.status(401).json({ message: "Vui lÃ²ng Ä‘Äƒng nháº­p" });
  if (!serviceId) return res.status(400).json({ message: "Thiáº¿u serviceId" });

  const items = await readAll();
  const draft = findWizardDraft(items, uid, serviceId);
  if (draft?.dossierId) await deleteByCode(draft.dossierId);
  return res.json({ message: "ÄÃ£ xoÃ¡ báº£n nhÃ¡p" });
};

exports.trackApplication = async (req, res) => {
  const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim();
  const application = await findByCode(dossierId);
  if (!application) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡" });

  const payments = await getPaymentsByDossierId(application.dossierId || dossierId);
  const notifications = application.userId ? await getNotificationsByUser(application.userId) : [];
  const paymentStatus = String(application.paymentStatus || "").toUpperCase();
  const visibleApplication =
    Number(application.fee || 0) <= 0 || paymentStatus === "COMPLETED" || paymentStatus === "PAID"
      ? application
      : { ...application, status: "DRAFT", timeline: [], history: [] };
  const publicApplication = {
    ...visibleApplication,
    resultFileUrl: undefined,
    resultFileKey: undefined
  };

  res.json({
    application: publicApplication,
    payments,
    notifications,
    timeline: publicApplication.timeline || publicApplication.history || [],
    statusDescription: STATUS_LABELS[publicApplication.status] || publicApplication.status
  });
};

exports.getMyServiceNotifications = async (req, res) => {
  const notifications = await getNotificationsByUser(userId(req));
  res.json({ notifications });
};

exports.getApplicationPayments = async (req, res) => {
  const dossierId = String(req.params.applicationId || req.params.applicationCode || req.params.dossierId || "").trim();
  const payments = await getPaymentsByDossierId(dossierId);
  res.json({ payments });
};

exports.payForApplication = async (req, res) => {
  const { dossierId, dossierCode, paymentMethod = "BANK_TRANSFER", amount } = req.body;
  const targetDossierId = String(dossierId || dossierCode || "").trim();
  const application = await findByCode(targetDossierId);
  if (!application) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡" });

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
    updatedAt: nowIso()
  };

  await savePayment(payment);
  await updateByCode(application.dossierId, {
    ...application,
    paymentStatus: "PENDING",
    status: "DRAFT",
    updatedAt: nowIso()
  });

  return res.status(200).json({ message: "ÄÃ£ táº¡o báº£n ghi thanh toÃ¡n PENDING", payment });
};

exports.adminCreateService = async (req, res) => {
  const body = req.body || {};
  const validationErrors = validateServicePayload(body);
  if (Object.keys(validationErrors).length) {
    return res.status(400).json({ message: "Dá»¯ liá»‡u dá»‹ch vá»¥ khÃ´ng há»£p lá»‡", errors: validationErrors });
  }

  const serviceId = generateServiceId();
  const requirementId = generateRequirementId();
  const faqId = generateFaqId();
  const stepId = generateStepId();
  const item = {
    serviceId,
    id: serviceId,
    name: String(body.name || "").trim(),
    description: String(body.description || "").trim(),
    categoryId: String(body.categoryId || "").trim(),
    categoryName: String(body.categoryName || body.category || "KhÃ¡c").trim(),
    fee: Number(body.fee || 0),
    processingTime: String(body.processingTime || ""),
    documents: Array.isArray(body.documents) ? body.documents.map((doc) => ({ ...doc, requirementId, id: requirementId })) : [],
    faq: Array.isArray(body.faq) ? body.faq.map((faq) => ({ ...faq, faqId, id: faqId })) : [],
    timeline: Array.isArray(body.timeline)
      ? body.timeline.map((step) => ({ ...(typeof step === "object" ? step : { status: step }), stepId, id: stepId }))
      : [],
    workflow: Array.isArray(body.workflow)
      ? body.workflow.map((step) => ({ ...(typeof step === "object" ? step : { status: step }), stepId, id: stepId }))
      : [],
    active: body.active !== false,
    updatedAt: new Date().toISOString(),
    createdAt: body.createdAt || new Date().toISOString(),
    agency: String(body.agency || "").trim(),
    level: String(body.level || "Má»©c 3").trim()
  };

  await upsertService(item);
  res.status(201).json({ message: "ÄÃ£ lÆ°u dá»‹ch vá»¥", service: item, serviceId, requirementId, faqId, stepId });
};

exports.seedServices = async (_req, res) => {
  const result = await seedServicesToDynamo();
  res.json({ message: "ÄÃ£ seed dá»‹ch vá»¥ vÃ o DynamoDB", ...result });
};

exports.adminUpdateService = async (req, res) => {
  const serviceId = req.params.serviceId;
  const current = await resolveService(serviceId);
  if (!current) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥" });

  const next = { ...current, ...req.body, serviceId, id: serviceId, updatedAt: nowIso() };
  await upsertService(next);
  res.json({ message: "ÄÃ£ cáº­p nháº­t dá»‹ch vá»¥", service: next });
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const dossierId = String(
      req.params.applicationCode ||
        req.params.id ||
        req.body?.dossierId ||
        req.body?.dossierCode ||
        req.body?.applicationCode ||
        ""
    ).trim();
    const application = await findByCode(dossierId);
    if (!application) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡" });

    const status = normalizeStatus(req.body?.status);
    const note = String(req.body?.note || "").trim();
    const action = String(req.body?.action || req.method?.toLowerCase() || status.toLowerCase()).trim();
    if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ message: "Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡" });
    if ((status === "NEED_MORE" || status === "REJECTED") && !note) {
      return res.status(400).json({ message: "Vui lÃ²ng nháº­p lÃ½ do" });
    }

    const now = nowIso();
    const timeline = pushTimeline(application, {
      status,
      action,
      note,
      actor: req.user?.email || req.user?.id || "admin",
      createdAt: now
    });
    const updated = await updateByCode(application.dossierId || dossierId, {
      ...application,
      status,
      updatedAt: now,
      timeline,
      history: timeline,
      decisionNote: note || application.decisionNote || ""
    });
    if (!updated) return res.status(500).json({ message: "KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c há»“ sÆ¡" });

    try {
      if (updated.userId) {
        const isNeedMore = status === "NEED_MORE";
        const title = isNeedMore
          ? `Há»“ sÆ¡ ${updated.dossierId} cáº§n bá»• sung`
          : `Há»“ sÆ¡ ${updated.dossierId} cáº­p nháº­t tráº¡ng thÃ¡i`;
        const message = isNeedMore
          ? `${updated.serviceName || "Há»“ sÆ¡"} cáº§n bá»• sung thÃ´ng tin. LÃ½ do: ${note}`
          : `${updated.serviceName || "Há»“ sÆ¡"} Ä‘Ã£ chuyá»ƒn sang tráº¡ng thÃ¡i ${STATUS_LABELS[status] || status}.`;
        const notification = await createNotification({
          notificationId: `NTF-${Date.now()}`,
          userId: updated.userId,
          dossierId: updated.dossierId,
          title,
          message,
          type: isNeedMore ? "NEED_MORE" : "STATUS_UPDATE",
          status,
          actionUrl: `/my-applications/${updated.dossierId}`,
          createdAt: now
        });
        const io = getIo();
        io?.to?.(`user_${updated.userId}`)?.emit?.("service-application-updated", {
          dossierId: updated.dossierId,
          status,
          timeline,
          notification
        });
      }
    } catch (socketErr) {
      console.warn("[updateApplicationStatus] notification/socket error:", socketErr?.message || socketErr);
    }

    return res.json({ message: "ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i há»“ sÆ¡", application: updated });
  } catch (err) {
    console.error("[updateApplicationStatus] error:", err);
    return res.status(500).json({ message: err.message || "Lá»—i cáº­p nháº­t tráº¡ng thÃ¡i há»“ sÆ¡" });
  }
};

exports.addApplicationSupplement = async (req, res) => {
  const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim();
  const application = await findByCode(dossierId);
  if (!application) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡" });
  if (application.userId && userId(req) && String(application.userId) !== String(userId(req))) {
    return res.status(403).json({ message: "KhÃ´ng cÃ³ quyá»n bá»• sung há»“ sÆ¡ nÃ y" });
  }
  if (String(application.status || "").toUpperCase() !== "NEED_MORE") {
    return res.status(400).json({ message: "Há»“ sÆ¡ hiá»‡n khÃ´ng á»Ÿ tráº¡ng thÃ¡i yÃªu cáº§u bá»• sung" });
  }

  const { formData = {}, attachments = [], note = "" } = req.body || {};
  const supplementNote = String(note || formData.supplementNote || "").trim();
  const nextFormData = { ...(application.formData || {}), ...formData };
  const existingAttachments = Array.isArray(application.attachments)
    ? application.attachments.map((item) => ({
        ...item,
        attachmentGroup: item.attachmentGroup || item.source || "initial",
      }))
    : [];
  const supplementAttachments = Array.isArray(attachments)
    ? attachments.map((item) => ({
        ...item,
        attachmentGroup: "supplement",
        source: "supplement",
        supplementedAt: nowIso(),
      }))
    : [];
  const nextAttachments = supplementAttachments.length
    ? [...existingAttachments, ...supplementAttachments]
    : existingAttachments;
  const timeline = pushTimeline(application, {
    status: "SUPPLEMENTED",
    action: "supplement",
    note: supplementNote || "NgÆ°á»i dÃ¢n Ä‘Ã£ bá»• sung há»“ sÆ¡",
    actor: userId(req) || "citizen",
    createdAt: nowIso()
  });
  const updated = await updateByCode(application.dossierId || dossierId, {
    ...application,
    formData: nextFormData,
    attachments: nextAttachments,
    supplementAttachments: [
      ...(Array.isArray(application.supplementAttachments) ? application.supplementAttachments : []),
      ...supplementAttachments,
    ],
    status: "SUPPLEMENTED",
    updatedAt: nowIso(),
    timeline,
    history: timeline
  });

  try {
    const io = getIo();
    io?.to?.("admin")?.emit?.("service-application-supplemented", {
      dossierId: updated.dossierId,
      status: "SUPPLEMENTED",
      application: updated
    });
  } catch {}

  return res.json({ message: "ÄÃ£ bá»• sung há»“ sÆ¡", application: updated });
};

exports.downloadApplicationResult = async (req, res) => {
  const dossierId = String(req.params.dossierId || req.params.applicationCode || "").trim();
  const application = await findByCode(dossierId);
  if (!application) return res.status(404).json({ message: "Không tìm th?y h? so" });

  const role = String(req.user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "staff";
  if (!isAdmin && application.userId && userId(req) && String(application.userId) !== String(userId(req))) {
    return res.status(403).json({ message: "Không có quy?n t?i k?t qu? h? so này" });
  }

  const status = String(application.status || "").toUpperCase();
  const hasResultFile = Boolean(application.resultFileKey || application.resultFileUrl);
  if (!hasResultFile && status !== "COMPLETED" && status !== "RESULT_DELIVERED") {
    return res.status(400).json({ message: "H? so chua có k?t qu?" });
  }

  if (hasResultFile) {
    let downloadUrl = application.resultFileUrl || "";
    if (application.resultFileKey) {
      try {
        downloadUrl = await createPresignedGet(application.resultFileKey, 300);
      } catch (err) {
        console.warn("[downloadApplicationResult] presign failed:", err?.message || err);
      }
    }
    return res.json({
      message: "T?i k?t qu? thành công",
      result: {
        dossierId: application.dossierId,
        dossierCode: application.dossierCode,
        serviceName: application.serviceName,
        status: application.status,
        resultFileUrl: downloadUrl,
        resultFileKey: application.resultFileKey,
        resultDeliveredAt: application.resultDeliveredAt,
        resultNote: application.resultNote || ""
      }
    });
  }

  const payload = {
    dossierId: application.dossierId,
    dossierCode: application.dossierCode,
    serviceName: application.serviceName,
    citizenName: application.citizenName,
    completedAt: nowIso(),
    decisionNote: application.decisionNote || ""
  };
  return res.json({ message: "T?i k?t qu? thành công", result: payload });
};

exports.adminDeleteService = async (req, res) => {
  const serviceId = req.params.serviceId;
  const current = await resolveService(serviceId);
  if (!current) return res.status(404).json({ message: "KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥" });
  await upsertService({
    ...current,
    active: false,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  res.json({ message: "ÄÃ£ xÃ³a dá»‹ch vá»¥" });
};
