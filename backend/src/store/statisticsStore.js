const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");
const { readAll: readApplications } = require("./serviceApplicationStore");
const { listServices } = require("./serviceCatalogStore");

const PAYMENTS_TABLE = process.env.DYNAMO_PAYMENTS_TABLE || "Payments";
const PAID_STATUSES = new Set(["PAID", "COMPLETED"]);
const PENDING_PAYMENT_STATUSES = new Set(["PENDING"]);
const UNPAID_PAYMENT_STATUSES = new Set(["UNPAID", "DRAFT", "FAILED", "CANCELLED", "CANCELED", "EXPIRED"]);

const STATUS_LABELS = {
  PENDING: "Chờ tiếp nhận",
  PROCESSING: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  SUPPLEMENTED: "Đã bổ sung",
  COMPLETED: "Hoàn thành",
  REJECTED: "Từ chối",
};

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateKey(date) {
  if (!date) return "Không rõ ngày";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function inRange(date, fromDate, toDate) {
  if (!date) return false;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function normalizeDateRange(query = {}) {
  const now = new Date();
  const from = parseDate(query.fromDate || query.from);
  const to = parseDate(query.toDate || query.to);
  return {
    fromDate: from ? startOfDay(from) : null,
    toDate: to ? endOfDay(to) : null,
    todayStart: startOfDay(now),
    todayEnd: endOfDay(now),
    monthStart: startOfMonth(now),
  };
}

function getApplicationDate(application) {
  return parseDate(application?.createdAt || application?.submittedAt || application?.updatedAt);
}

function getPaymentDate(payment) {
  return parseDate(
    payment?.paidAt ||
      payment?.paymentCompletedAt ||
      payment?.completedAt ||
      payment?.updatedAt ||
      payment?.createdAt
  );
}

function getPaymentStatus(payment) {
  return String(payment?.paymentStatus || payment?.status || "UNPAID").trim().toUpperCase();
}

function getApplicationPaymentStatus(application) {
  return String(application?.paymentStatus || "UNPAID").trim().toUpperCase();
}

function normalizeApplicationStatus(application) {
  const status = String(application?.status || "PENDING").trim().toUpperCase();
  const paymentStatus = getApplicationPaymentStatus(application);
  if (status === "DRAFT" && isPaidStatus(paymentStatus)) return "PENDING";
  if (status === "SUBMITTED" || status === "RECEIVED" || status === "WAITING" || status === "WAITING_RECEIVE") return "PENDING";
  return status;
}

function getDossierKey(item) {
  return String(
    item?.dossierId ||
      item?.dossierCode ||
      item?.applicationCode ||
      item?.id ||
      ""
  ).trim();
}

function dedupeApplications(items = []) {
  const map = new Map();

  for (const item of items) {
    const key = getDossierKey(item);
    if (!key) continue;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }

    const prevTime = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
    const nextTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

    if (nextTime >= prevTime) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

function isSubmittedApplication(application) {
  const status = String(application?.status || "").trim().toUpperCase();
  return status !== "DRAFT" || isPaidStatus(getApplicationPaymentStatus(application));
}

function isPaidStatus(status) {
  return PAID_STATUSES.has(String(status || "").trim().toUpperCase());
}

async function getPayments() {
  try {
    const client = getDynamoClient();
    const data = await client.send(new ScanCommand({ TableName: PAYMENTS_TABLE }));
    return Array.isArray(data.Items) ? data.Items : [];
  } catch (error) {
    console.warn("[statisticsStore.getPayments] fallback empty:", error?.message || error);
    return [];
  }
}

function buildServiceLookup(services = []) {
  return new Map(
    services.map((service) => [
      String(service.serviceId || service.id || "").trim(),
      service,
    ])
  );
}

function getServiceKey(application, serviceMap) {
  const directServiceId = String(application?.serviceId || application?.service?.serviceId || "").trim();
  if (directServiceId) return directServiceId;

  const serviceName = String(application?.serviceName || application?.service?.name || "").trim();
  if (serviceName) {
    const matchedService = Array.from(serviceMap.values()).find(
      (service) => String(service.name || "").trim() === serviceName
    );
    return String(matchedService?.serviceId || matchedService?.id || serviceName).trim();
  }

  return "unknown";
}

function getServiceName(serviceMap, application, serviceId) {
  const service = serviceMap.get(String(serviceId || "").trim()) || {};
  return application?.serviceName || service.name || application?.service?.name || "Không rõ dịch vụ";
}

function normalizeServiceGroupName(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getServiceGroup(application, serviceMap, fallbackServiceId) {
  const serviceId = String(fallbackServiceId || getServiceKey(application, serviceMap)).trim() || "unknown";
  const serviceName = getServiceName(serviceMap, application, serviceId);
  const nameKey = normalizeServiceGroupName(serviceName);

  return {
    serviceGroupKey: nameKey ? `name:${nameKey}` : `id:${serviceId}`,
    serviceId,
    serviceName,
  };
}

function normalizePayment(payment, applicationsByCode, serviceMap) {
  const dossierId = String(payment.dossierId || payment.applicationId || payment.applicationCode || "").trim();
  const application = applicationsByCode.get(dossierId);
  const serviceGroup = getServiceGroup(application, serviceMap, payment.serviceId);
  const status = getPaymentStatus(payment);
  const paidDate = getPaymentDate(payment);

  return {
    ...payment,
    dossierId,
    serviceId: serviceGroup.serviceId,
    serviceName: serviceGroup.serviceName,
    serviceGroupKey: serviceGroup.serviceGroupKey,
    status,
    amount: safeNumber(payment.amount || payment.paymentAmount || application?.fee),
    paidDate,
    paidDateKey: formatDateKey(paidDate),
  };
}

function addRevenue(map, key, base, amount) {
  const current = map.get(key) || { ...base, revenue: 0, paidCount: 0 };
  current.revenue += amount;
  current.paidCount += 1;
  map.set(key, current);
}

async function getAdminStatistics(query = {}) {
  try {
    const { fromDate, toDate, todayStart, todayEnd, monthStart } = normalizeDateRange(query);
    const [applicationsRaw, services, paymentsRaw] = await Promise.all([
      readApplications(),
      listServices(),
      getPayments(),
    ]);

    const serviceMap = buildServiceLookup(services);
    const uniqueApplications = dedupeApplications(Array.isArray(applicationsRaw) ? applicationsRaw : []);
    const applications = uniqueApplications
      .filter(isSubmittedApplication)
      .map((application) => ({
        ...application,
        status: normalizeApplicationStatus(application),
        createdAtDate: getApplicationDate(application),
      }));

    const applicationsByCode = new Map();
    applications.forEach((application) => {
      const code = getDossierKey(application);
      if (code) applicationsByCode.set(code, application);
    });

    const filteredApplications = applications.filter((application) =>
      inRange(application.createdAtDate, fromDate, toDate)
    );

    const todayApplications = applications.filter((application) =>
      inRange(application.createdAtDate, todayStart, todayEnd)
    );
    const monthApplications = applications.filter((application) =>
      inRange(application.createdAtDate, monthStart, null)
    );

    const byStatus = {
      pending: 0,
      processing: 0,
      needMore: 0,
      supplemented: 0,
      completed: 0,
      rejected: 0,
    };
    const statusMap = {
      PENDING: "pending",
      PROCESSING: "processing",
      NEED_MORE: "needMore",
      SUPPLEMENTED: "supplemented",
      COMPLETED: "completed",
      REJECTED: "rejected",
    };

    const byServiceMap = new Map();
    filteredApplications.forEach((application) => {
      const statusKey = statusMap[application.status];
      if (statusKey) byStatus[statusKey] += 1;

      const serviceGroup = getServiceGroup(application, serviceMap);
      const current = byServiceMap.get(serviceGroup.serviceGroupKey) || {
        serviceId: serviceGroup.serviceId,
        serviceName: serviceGroup.serviceName,
        serviceGroupKey: serviceGroup.serviceGroupKey,
        total: 0,
        completed: 0,
        rejected: 0,
      };
      current.total += 1;
      if (application.status === "COMPLETED") current.completed += 1;
      if (application.status === "REJECTED") current.rejected += 1;
      byServiceMap.set(serviceGroup.serviceGroupKey, current);
    });

    const normalizedPayments = (Array.isArray(paymentsRaw) ? paymentsRaw : []).map((payment) =>
      normalizePayment(payment, applicationsByCode, serviceMap)
    );
    const filteredPayments = normalizedPayments.filter((payment) =>
      inRange(payment.paidDate, fromDate, toDate)
    );
    const paidPayments = normalizedPayments.filter((payment) => isPaidStatus(payment.status));

    const revenueByServiceMap = new Map();
    const revenueByDateMap = new Map();
    const countedPaidDossiers = new Set();
    let totalRevenue = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;
    let paidCount = 0;
    let pendingPaymentCount = 0;
    let unpaidCount = 0;

    filteredPayments.forEach((payment) => {
      if (isPaidStatus(payment.status)) {
        totalRevenue += payment.amount;
        paidCount += 1;
        addRevenue(
          revenueByServiceMap,
          payment.serviceGroupKey || payment.serviceId,
          { serviceId: payment.serviceId, serviceName: payment.serviceName },
          payment.amount
        );
        addRevenue(
          revenueByDateMap,
          payment.paidDateKey,
          { date: payment.paidDateKey },
          payment.amount
        );
        if (payment.dossierId) countedPaidDossiers.add(payment.dossierId);
        return;
      }

      if (PENDING_PAYMENT_STATUSES.has(payment.status)) {
        pendingPaymentCount += 1;
      } else if (UNPAID_PAYMENT_STATUSES.has(payment.status) || payment.status) {
        unpaidCount += 1;
      }
    });

    todayRevenue = paidPayments
      .filter((payment) => inRange(payment.paidDate, todayStart, todayEnd))
      .reduce((sum, payment) => sum + payment.amount, 0);
    monthRevenue = paidPayments
      .filter((payment) => inRange(payment.paidDate, monthStart, null))
      .reduce((sum, payment) => sum + payment.amount, 0);

    filteredApplications.forEach((application) => {
      const code = getDossierKey(application);
      const paymentStatus = getApplicationPaymentStatus(application);
      if (!isPaidStatus(paymentStatus) || countedPaidDossiers.has(code)) return;

      const amount = safeNumber(application.fee || application.paymentAmount);
      if (amount <= 0) return;

      const paidDate = parseDate(
        application.paidAt ||
          application.paymentCompletedAt ||
          application.completedAt ||
          application.updatedAt ||
          application.createdAt
      );
      if (!inRange(paidDate, fromDate, toDate)) return;

      const serviceGroup = getServiceGroup(application, serviceMap);
      totalRevenue += amount;
      paidCount += 1;
      if (inRange(paidDate, todayStart, todayEnd)) todayRevenue += amount;
      if (inRange(paidDate, monthStart, null)) monthRevenue += amount;

      addRevenue(
        revenueByServiceMap,
        serviceGroup.serviceGroupKey,
        { serviceId: serviceGroup.serviceId, serviceName: serviceGroup.serviceName },
        amount
      );
      addRevenue(revenueByDateMap, formatDateKey(paidDate), { date: formatDateKey(paidDate) }, amount);
    });

    const byService = Array.from(byServiceMap.values())
      .map((item) => ({
        ...item,
        completedRate: item.total ? Math.round((item.completed / item.total) * 1000) / 10 : 0,
        revenue: safeNumber(revenueByServiceMap.get(item.serviceGroupKey || item.serviceId)?.revenue || 0),
      }))
      .sort((a, b) => b.total - a.total);

    const revenueByService = Array.from(revenueByServiceMap.values()).sort((a, b) => b.revenue - a.revenue);
    const revenueByDate = Array.from(revenueByDateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const latestApplications = [...filteredApplications]
      .sort((a, b) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0))
      .slice(0, 8)
      .map((application) => {
        const serviceGroup = getServiceGroup(application, serviceMap);
        return {
          dossierId: getDossierKey(application),
          dossierCode: application.dossierCode || application.applicationCode || getDossierKey(application),
          serviceName: application.serviceName || serviceGroup.serviceName,
          status: application.status,
          statusLabel: STATUS_LABELS[application.status] || application.status,
          createdAt: application.createdAt,
          paymentStatus: application.paymentStatus,
        };
      });

    const latestPayments = filteredPayments
      .filter((payment) => isPaidStatus(payment.status))
      .sort((a, b) => (b.paidDate?.getTime() || 0) - (a.paidDate?.getTime() || 0))
      .slice(0, 8)
      .map((payment) => ({
        paymentId: payment.paymentId,
        dossierId: payment.dossierId,
        serviceName: payment.serviceName,
        amount: payment.amount,
        paymentStatus: payment.status,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt || payment.paymentCompletedAt || payment.completedAt || payment.updatedAt || payment.createdAt,
      }));

    const totals = {
      totalApplications: filteredApplications.length,
      todayApplications: todayApplications.length,
      monthApplications: monthApplications.length,
      totalRevenue,
      todayRevenue,
      monthRevenue,
      paidCount,
      pendingPaymentCount,
      unpaidCount,
    };

    return {
      totals,
      overview: {
        totalApplications: totals.totalApplications,
        todayApplications: totals.todayApplications,
        monthApplications: totals.monthApplications,
      },
      byStatus,
      byService,
      revenueByService,
      revenueByDate,
      latestApplications,
      latestPayments,
      revenue: {
        totalRevenue,
        todayRevenue,
        monthRevenue,
        paidTransactions: paidCount,
        pendingPaymentCount,
        unpaidTransactions: unpaidCount,
        byService: revenueByService,
        byDate: revenueByDate,
      },
    };
  } catch (error) {
    console.error("[statisticsStore.getAdminStatistics] error:", error?.name, error?.message, error);
    return {
      totals: {
        totalApplications: 0,
        todayApplications: 0,
        monthApplications: 0,
        totalRevenue: 0,
        todayRevenue: 0,
        monthRevenue: 0,
        paidCount: 0,
        pendingPaymentCount: 0,
        unpaidCount: 0,
      },
      overview: { totalApplications: 0, todayApplications: 0, monthApplications: 0 },
      byStatus: { pending: 0, processing: 0, needMore: 0, supplemented: 0, completed: 0, rejected: 0 },
      byService: [],
      revenueByService: [],
      revenueByDate: [],
      latestApplications: [],
      latestPayments: [],
      revenue: {
        totalRevenue: 0,
        todayRevenue: 0,
        monthRevenue: 0,
        paidTransactions: 0,
        pendingPaymentCount: 0,
        unpaidTransactions: 0,
        byService: [],
        byDate: [],
      },
    };
  }
}

module.exports = { getAdminStatistics };
