const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");
const { readAll: readApplications } = require("./serviceApplicationStore");
const { listServices } = require("./serviceCatalogStore");

const PAYMENTS_TABLE = process.env.DYNAMO_PAYMENTS_TABLE || "Payments";

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
}

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }

function inRange(date, fromDate, toDate) {
  if (!date) return false;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
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

function normalizeDateRange(query = {}) {
  const now = new Date();
  const from = query.fromDate ? parseDate(query.fromDate) : null;
  const to = query.toDate ? parseDate(query.toDate) : null;
  return {
    fromDate: from ? startOfDay(from) : null,
    toDate: to ? endOfDay(to) : null,
    todayStart: startOfDay(now),
    monthStart: startOfMonth(now),
  };
}

async function getAdminStatistics(query = {}) {
  const { fromDate, toDate, todayStart, monthStart } = normalizeDateRange(query);
  const [applicationsRaw, services, paymentsRaw] = await Promise.all([readApplications(), listServices(), getPayments()]);

  const applications = applicationsRaw.map((app) => ({ ...app, createdAtDate: parseDate(app.createdAt) || parseDate(app.updatedAt) || null }));
  const filteredApplications = applications.filter((app) => inRange(app.createdAtDate, fromDate, toDate));
  const todayApplications = applications.filter((app) => inRange(app.createdAtDate, todayStart, endOfDay(todayStart)));
  const monthApplications = applications.filter((app) => inRange(app.createdAtDate, monthStart, null));

  const byStatus = { pending: 0, processing: 0, needMore: 0, completed: 0, rejected: 0 };
  const statusMap = { PENDING: "pending", PROCESSING: "processing", NEED_MORE: "needMore", COMPLETED: "completed", REJECTED: "rejected" };
  filteredApplications.forEach((app) => {
    const key = statusMap[String(app.status || "").toUpperCase()];
    if (key) byStatus[key] += 1;
  });

  const serviceMap = new Map(services.map((svc) => [String(svc.serviceId || svc.id || ""), svc]));
  const byServiceMap = new Map();
  filteredApplications.forEach((app) => {
    const serviceId = String(app.serviceId || "").trim() || "unknown";
    const service = serviceMap.get(serviceId) || {};
    const current = byServiceMap.get(serviceId) || { serviceId, serviceName: service.name || app.serviceName || "Không rõ", total: 0, completed: 0, rejected: 0, completedRevenue: 0 };
    current.total += 1;
    const status = String(app.status || "").toUpperCase();
    if (status === "COMPLETED") current.completed += 1;
    if (status === "REJECTED") current.rejected += 1;
    byServiceMap.set(serviceId, current);
  });

  const paymentLookup = new Map();
  paymentsRaw.forEach((p) => {
    const dossierId = String(p.dossierId || p.applicationId || p.applicationCode || "").trim();
    if (!dossierId) return;
    const createdAt = toDate(p.createdAt);
    if (!inRange(createdAt, fromDate, toDate)) return;
    const status = String(p.paymentStatus || p.status || "").toUpperCase();
    if (status !== "PAID") return;
    paymentLookup.set(dossierId, (paymentLookup.get(dossierId) || 0) + safeNumber(p.amount));
  });

  let totalRevenue = 0;
  let paidTransactions = 0;
  let unpaidTransactions = 0;

  const revenueByServiceMap = new Map();
  const revenueByMonthMap = new Map();

  paymentsRaw.forEach((payment) => {
    const status = String(payment.paymentStatus || payment.status || "").toUpperCase();
    const amount = safeNumber(payment.amount);
    const createdAt = toDate(payment.createdAt);
    if (!inRange(createdAt, fromDate, toDate)) return;

    if (status === "PAID") {
      totalRevenue += amount;
      paidTransactions += 1;
      const dossierId = String(payment.dossierId || payment.applicationId || payment.applicationCode || "").trim();
      const app = applications.find((x) => String(x.dossierId || x.id || x.dossierCode || x.applicationCode || x.applicationId || "") === dossierId);
      const serviceId = String(app?.serviceId || "unknown").trim() || "unknown";
      const service = serviceMap.get(serviceId) || {};
      const serviceCurrent = revenueByServiceMap.get(serviceId) || { serviceId, serviceName: service.name || app?.serviceName || "Không rõ", revenue: 0 };
      serviceCurrent.revenue += amount;
      revenueByServiceMap.set(serviceId, serviceCurrent);

      const monthKey = createdAt ? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}` : "unknown";
      revenueByMonthMap.set(monthKey, (revenueByMonthMap.get(monthKey) || 0) + amount);
    } else {
      unpaidTransactions += 1;
    }
  });

  const byService = Array.from(byServiceMap.values()).map((item) => ({
    ...item,
    completedRate: item.total ? Math.round((item.completed / item.total) * 1000) / 10 : 0,
    revenue: safeNumber(revenueByServiceMap.get(item.serviceId)?.revenue || 0),
  })).sort((a, b) => b.total - a.total);

  const revenueByService = Array.from(revenueByServiceMap.values()).sort((a, b) => b.revenue - a.revenue);
  const byMonth = Array.from(revenueByMonthMap.entries()).map(([month, revenue]) => ({ month, revenue })).sort((a, b) => a.month.localeCompare(b.month));

  return {
    overview: {
      totalApplications: filteredApplications.length,
      todayApplications: todayApplications.length,
      monthApplications: monthApplications.length,
    },
    byStatus,
    byService,
    revenue: {
      totalRevenue,
      paidTransactions,
      unpaidTransactions,
      byService: revenueByService,
      byMonth,
    },
  };
}

module.exports = { getAdminStatistics };
