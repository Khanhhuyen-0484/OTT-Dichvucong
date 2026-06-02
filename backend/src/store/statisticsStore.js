const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");
const { readAll: readApplications } = require("./serviceApplicationStore");
const { listServices } = require("./serviceCatalogStore");

const PAYMENTS_TABLE = process.env.DYNAMO_PAYMENTS_TABLE || "Payments";
const PAID_STATUSES = new Set(["PAID", "COMPLETED"]);
const PENDING_PAYMENT_STATUSES = new Set(["PENDING"]);
const UNPAID_PAYMENT_STATUSES = new Set(["UNPAID", "DRAFT", "FAILED", "CANCELLED", "CANCELED", "EXPIRED"]);
const REPORT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const STATUS_LABELS = {
  PENDING: "Chờ tiếp nhận",
  PROCESSING: "Đang xử lý",
  NEED_MORE: "Yêu cầu bổ sung",
  SUPPLEMENTED: "Đã bổ sung",
  APPROVED: "Đã duyệt",
  COMPLETED: "Hoàn thành",
  RESULT_DELIVERED: "Đã trả kết quả",
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

function dateKeyFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const localDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/);
  if (localDateTime) return localDateTime[1];
  const parsed = parseDate(raw);
  return parsed ? formatDateKey(parsed) : "";
}

function repairTextEncoding(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/[ÃÂÄÅÆ]|[\u0080-\u009F]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, "latin1").toString("utf8").trim();
    return decoded && !decoded.includes("�") ? decoded : text;
  } catch {
    return text;
  }
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
  return DATE_KEY_FORMATTER.format(date);
}

function normalizeDateKey(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = parseDate(raw);
  return parsed ? formatDateKey(parsed) : "";
}

function inRange(dateKey, fromKey, toKey) {
  if (!dateKey) return false;
  if (fromKey && dateKey < fromKey) return false;
  if (toKey && dateKey > toKey) return false;
  return true;
}

function addDaysToDateKey(dateKey, days) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

function buildDateSeries(fromKey, toKey, valueMap, fallbackRecords = []) {
  const keys = [];
  if (fromKey && toKey && fromKey <= toKey) {
    let key = fromKey;
    let guard = 0;
    while (key && key <= toKey && guard < 370) {
      keys.push(key);
      key = addDaysToDateKey(key, 1);
      guard += 1;
    }
  }

  if (!keys.length) {
    fallbackRecords.forEach((record) => {
      if (record.paidDateKey) keys.push(record.paidDateKey);
    });
  }

  return Array.from(new Set(keys))
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((date) => ({
      date,
      revenue: safeNumber(valueMap.get(date)?.revenue || 0),
      paidCount: safeNumber(valueMap.get(date)?.paidCount || 0),
    }));
}

function normalizeDateRange(query = {}) {
  const now = new Date();
  const todayKey = formatDateKey(now);
  return {
    fromKey: normalizeDateKey(query.fromDate || query.from),
    toKey: normalizeDateKey(query.toDate || query.to),
    todayKey,
    monthStartKey: `${todayKey.slice(0, 7)}-01`,
  };
}

function getApplicationDate(application) {
  return parseDate(application?.submittedAt || application?.createdAt || application?.updatedAt);
}

function getApplicationPaymentDateValue(application) {
  return (
    application?.paidAt ||
      application?.transactionDate ||
      application?.paymentDate ||
      application?.paymentCompletedAt ||
      application?.completedAt ||
      application?.updatedAt ||
      application?.createdAt
  );
}

function getApplicationPaymentDate(application) {
  return parseDate(getApplicationPaymentDateValue(application));
}

function getApplicationPaymentDateKey(application) {
  return dateKeyFromValue(getApplicationPaymentDateValue(application));
}

function getPaymentDateValue(payment) {
  return (
    payment?.paidAt ||
      payment?.transactionDate ||
      payment?.paymentDate ||
      payment?.paymentCompletedAt ||
      payment?.completedAt ||
      payment?.updatedAt ||
      payment?.createdAt
  );
}

function getPaymentDate(payment, application) {
  return parseDate(getPaymentDateValue(payment)) || getApplicationPaymentDate(application);
}

function getPaymentDateKey(payment, application) {
  return dateKeyFromValue(getPaymentDateValue(payment)) || getApplicationPaymentDateKey(application);
}

function getPaymentPaidAt(payment) {
  return getPaymentDateValue(payment) || "";
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
  if (status === "PAID") return "PENDING";
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

  const serviceName = repairTextEncoding(application?.serviceName || application?.service?.name);
  if (serviceName) {
    const serviceNameKey = normalizeServiceGroupName(serviceName);
    const matchedService = Array.from(serviceMap.values()).find(
      (service) => normalizeServiceGroupName(service.name) === serviceNameKey
    );
    return String(matchedService?.serviceId || matchedService?.id || serviceName).trim();
  }

  return "unknown";
}

function getServiceName(serviceMap, application, serviceId) {
  const service = serviceMap.get(String(serviceId || "").trim()) || {};
  return repairTextEncoding(service.name || application?.serviceName || application?.service?.name || "Không rõ dịch vụ");
}

function normalizeServiceGroupName(value) {
  return repairTextEncoding(value)
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
    serviceGroupKey: serviceId && serviceId !== "unknown" ? `id:${serviceId}` : `name:${nameKey || "unknown"}`,
    serviceId,
    serviceName,
  };
}

function normalizePayment(payment, applicationsByCode, serviceMap) {
  const dossierId = String(payment.dossierId || payment.applicationId || payment.applicationCode || "").trim();
  const application = applicationsByCode.get(dossierId);
  const serviceGroup = getServiceGroup(application, serviceMap, payment.serviceId);
  const status = getPaymentStatus(payment);
  const paidDate = getPaymentDate(payment, application);

  return {
    ...payment,
    dossierId,
    serviceId: serviceGroup.serviceId,
    serviceName: serviceGroup.serviceName,
    serviceGroupKey: serviceGroup.serviceGroupKey,
    status,
    amount: safeNumber(payment.amount || payment.paymentAmount || application?.fee),
    paidDate,
    paidDateKey: getPaymentDateKey(payment, application),
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
    const { fromKey, toKey, todayKey, monthStartKey } = normalizeDateRange(query);
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
        createdAtKey: getApplicationDate(application) ? formatDateKey(getApplicationDate(application)) : "",
      }));

    const applicationsByCode = new Map();
    applications.forEach((application) => {
      const code = getDossierKey(application);
      if (code) applicationsByCode.set(code, application);
    });

    const filteredApplications = applications.filter((application) =>
      inRange(application.createdAtKey, fromKey, toKey)
    );

    const todayApplications = applications.filter((application) =>
      inRange(application.createdAtKey, todayKey, todayKey)
    );
    const monthApplications = applications.filter((application) =>
      inRange(application.createdAtKey, monthStartKey, null)
    );

    const byStatus = {
      pending: 0,
      processing: 0,
      needMore: 0,
      supplemented: 0,
      approved: 0,
      completed: 0,
      resultDelivered: 0,
      rejected: 0,
    };
    const statusMap = {
      PENDING: "pending",
      PROCESSING: "processing",
      NEED_MORE: "needMore",
      SUPPLEMENTED: "supplemented",
      APPROVED: "approved",
      COMPLETED: "completed",
      RESULT_DELIVERED: "resultDelivered",
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
    const paidPayments = normalizedPayments.filter((payment) => isPaidStatus(payment.status));

    const revenueByServiceMap = new Map();
    const revenueByDateMap = new Map();
    const dossiersWithPaidPayment = new Set();
    let pendingPaymentCount = 0;
    let unpaidCount = 0;
    const debug = {
      dateRange: { fromKey, toKey, todayKey, monthStartKey, timeZone: REPORT_TIME_ZONE },
      dossiersScanned: uniqueApplications.length,
      dossiersSubmitted: applications.length,
      paymentsScanned: Array.isArray(paymentsRaw) ? paymentsRaw.length : 0,
      paidPayments: paidPayments.length,
      fallbackPaidDossiers: 0,
      ignoredPaidPayments: [],
      revenueRecords: [],
    };

    const revenueRecords = [];
    paidPayments.forEach((payment) => {
      const amount = safeNumber(payment.amount);
      if (amount <= 0 || !payment.paidDateKey) {
        debug.ignoredPaidPayments.push({
          paymentId: payment.paymentId,
          dossierId: payment.dossierId,
          status: payment.status,
          amount,
          paidDateKey: payment.paidDateKey,
          reason: amount <= 0 ? "NO_AMOUNT" : "NO_PAID_DATE",
        });
        return;
      }
      if (payment.dossierId) dossiersWithPaidPayment.add(payment.dossierId);
      revenueRecords.push({
        paymentId: payment.paymentId,
        dossierId: payment.dossierId,
        serviceId: payment.serviceId,
        serviceName: payment.serviceName,
        serviceGroupKey: payment.serviceGroupKey,
        amount,
        paidDate: payment.paidDate,
        paidDateKey: payment.paidDateKey,
        createdAt: payment.createdAt,
        paidAt: getPaymentPaidAt(payment),
        source: "Payments",
        status: payment.status,
      });
    });

    normalizedPayments.forEach((payment) => {
      if (isPaidStatus(payment.status)) return;
      if (PENDING_PAYMENT_STATUSES.has(payment.status)) {
        pendingPaymentCount += 1;
      } else if (UNPAID_PAYMENT_STATUSES.has(payment.status) || payment.status) {
        unpaidCount += 1;
      }
    });

    applications.forEach((application) => {
      const code = getDossierKey(application);
      const paymentStatus = getApplicationPaymentStatus(application);
      if (!isPaidStatus(paymentStatus) || dossiersWithPaidPayment.has(code)) return;

      const amount = safeNumber(application.fee || application.paymentAmount);
      if (amount <= 0) return;

      const paidDate = getApplicationPaymentDate(application);
      const paidDateKey = getApplicationPaymentDateKey(application);
      const serviceGroup = getServiceGroup(application, serviceMap);
      debug.fallbackPaidDossiers += 1;
      revenueRecords.push({
        paymentId: application.paymentId || "",
        dossierId: code,
        serviceId: serviceGroup.serviceId,
        serviceName: serviceGroup.serviceName,
        serviceGroupKey: serviceGroup.serviceGroupKey,
        amount,
        paidDate,
        paidDateKey,
        createdAt: application.createdAt,
        paidAt: paidDate?.toISOString?.() || application.updatedAt || application.createdAt,
        source: "Dossiers",
        status: paymentStatus,
      });
    });

    const filteredRevenueRecords = revenueRecords.filter((record) => inRange(record.paidDateKey, fromKey, toKey));
    debug.revenueRecords = revenueRecords.map((record) => ({
      source: record.source,
      paymentId: record.paymentId,
      dossierId: record.dossierId,
      serviceId: record.serviceId,
      serviceName: record.serviceName,
      amount: record.amount,
      paidDateKey: record.paidDateKey,
      inSelectedRange: inRange(record.paidDateKey, fromKey, toKey),
      isToday: inRange(record.paidDateKey, todayKey, todayKey),
    }));
    const totalRevenue = revenueRecords.reduce((sum, record) => sum + record.amount, 0);
    const todayRevenue = revenueRecords
      .filter((record) => inRange(record.paidDateKey, todayKey, todayKey))
      .reduce((sum, record) => sum + record.amount, 0);
    const monthRevenue = revenueRecords
      .filter((record) => inRange(record.paidDateKey, monthStartKey, null))
      .reduce((sum, record) => sum + record.amount, 0);
    const paidCount = filteredRevenueRecords.length;

    filteredRevenueRecords.forEach((record) => {
      addRevenue(
        revenueByServiceMap,
        record.serviceGroupKey || record.serviceId,
        { serviceId: record.serviceId, serviceName: record.serviceName },
        record.amount
      );
      addRevenue(revenueByDateMap, record.paidDateKey, { date: record.paidDateKey }, record.amount);
    });

    const byService = Array.from(byServiceMap.values())
      .map((item) => ({
        ...item,
        completedRate: item.total ? Math.round((item.completed / item.total) * 1000) / 10 : 0,
        revenue: safeNumber(revenueByServiceMap.get(item.serviceGroupKey || item.serviceId)?.revenue || 0),
      }))
      .sort((a, b) => b.total - a.total);

    const revenueByService = Array.from(revenueByServiceMap.values()).sort((a, b) => b.revenue - a.revenue);
    const revenueByDate = buildDateSeries(fromKey, toKey, revenueByDateMap, filteredRevenueRecords);

    const latestApplications = [...filteredApplications]
      .sort((a, b) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0))
      .slice(0, 8)
      .map((application) => {
        const serviceGroup = getServiceGroup(application, serviceMap);
        return {
          dossierId: getDossierKey(application),
          dossierCode: application.dossierCode || application.applicationCode || getDossierKey(application),
          serviceName: serviceGroup.serviceName,
          status: application.status,
          statusLabel: STATUS_LABELS[application.status] || application.status,
          createdAt: application.createdAt,
          paymentStatus: application.paymentStatus,
        };
      });

    const latestPayments = filteredRevenueRecords
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

    const response = {
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
    if (query.debug) response.debug = debug;
    return response;
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
      byStatus: { pending: 0, processing: 0, needMore: 0, supplemented: 0, approved: 0, completed: 0, resultDelivered: 0, rejected: 0 },
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
