const { GetCommand, PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { getDynamoClient } = require("../config/dynamoClient");
const { sendMessage, getChatHistory } = require("./supportConversationsStore");
const { findById } = require("./userStore");
const { readAll: readApplications, findByCode: findApplicationByCode, updateByCode: updateApplicationByCode } = require("./serviceApplicationStore");

const DOSSIER_STATUS_FLOW = new Set(["PENDING", "PROCESSING", "NEED_MORE", "SUPPLEMENTED", "COMPLETED", "REJECTED"]);

function isPaidApplication(app) {
  if (!app) return false;
  const fee = Number(app.fee || 0);
  const paymentStatus = String(app.paymentStatus || "").trim().toUpperCase();
  return fee <= 0 || paymentStatus === "COMPLETED" || paymentStatus === "PAID";
}

const SUPPORT_CONVERSATIONS_TABLE = process.env.SUPPORT_CONVERSATIONS_TABLE || process.env.DYNAMODB_SUPPORT_CONVERSATIONS_TABLE || "SupportConversations";
const ADMIN_AI_TABLE = process.env.DYNAMODB_ADMIN_AI_TABLE || "AdminAi";
const DEFAULT_AI_RULES = `1. Ch?? tu v?n trong ph?m vi C?.ng D?<ch v? c?ng v? th? t?c h?nh ch?nh ph?. bi?n.
2. Tr? l?i b?ng ti?ng Vi??t r? r?ng, l?<ch s?, ng?n g?n, d?. l?m theo.
3. N?u thi?u th?ng tin nhu ?'?<a phuong, lo?i h?" so, ?'?'i tu?ng n?Tp th? ph?i h?i l?i ng?n g?n.
4. Kh?ng kh?ng ?'?<nh ch?c ch?n c?c y?u c?u ph?p l? n?u chua ?'? d? ki??n; lu?n nh?c ngu?i d?n ?'?'i chi?u quy ?'?<nh v? co quan c? th?m quy?n.
5. Uu ti?n ?'ua ra: gi?y t? c?n chu?n b?<, c?c bu?>c th?c hi??n, noi ti?p nh?n, luu ? quan tr?ng.
6. Kh?ng b?<a th?ng tin, kh?ng suy ?'o?n m?c ph?/th?i h?n n?u kh?ng c? c?fn c? r? r?ng.
7. N?u c?u h?i vu?t ph?m vi, hu?>ng ngu?i d?ng sang c?n b?T h?- tr? ho?c co quan ti?p nh?n h?" so.`;

let localDb = null;
function ensureLocalDb() { if (!localDb) localDb = { conversations: [], ai: { id: "default", rulesText: DEFAULT_AI_RULES, history: [] } }; return localDb; }
function nowIso() { return new Date().toISOString(); }
function normalizeDossierStatus(status) { const s = String(status || "").trim().toUpperCase(); return DOSSIER_STATUS_FLOW.has(s) ? s : "PENDING"; }
function normalizeTimelineItem(item) { return { status: normalizeDossierStatus(item?.status), action: String(item?.action || "").trim(), note: String(item?.note || "").trim(), actor: String(item?.actor || item?.by || "").trim(), createdAt: item?.createdAt || item?.at || nowIso() }; }
async function getClient() { try { return getDynamoClient(); } catch { return null; } }
async function safeScan(tableName) { const client = await getClient(); if (!client) return []; const rs = await client.send(new ScanCommand({ TableName: tableName })); return rs.Items || []; }
async function safeGet(tableName, key) { const client = await getClient(); if (!client) return null; const rs = await client.send(new GetCommand({ TableName: tableName, Key: key })); return rs.Item || null; }
async function safePut(tableName, item) { const client = await getClient(); if (!client) return item; await client.send(new PutCommand({ TableName: tableName, Item: item })); return item; }
async function safeUpdate(tableName, params) { const client = await getClient(); if (!client) return null; return client.send(new UpdateCommand({ TableName: tableName, ...params })); }

async function getDashboardStats() {
  try {
    const dossiers = (await readApplications()).filter(isPaidApplication);
    const conversations = await safeScan(SUPPORT_CONVERSATIONS_TABLE);
    return {
      totalPending: dossiers.filter((x) => String(x.status || "").toUpperCase() === "PENDING").length,
      totalProcessing: dossiers.filter((x) => String(x.status || "").toUpperCase() === "PROCESSING").length,
      totalNeedMore: dossiers.filter((x) => String(x.status || "").toUpperCase() === "NEED_MORE").length,
      totalCompleted: dossiers.filter((x) => String(x.status || "").toUpperCase() === "COMPLETED").length,
      totalRejected: dossiers.filter((x) => String(x.status || "").toUpperCase() === "REJECTED").length,
      waitingMessages: conversations.filter((x) => x.status === "active" || x.status === "waiting").length
    };
  } catch (error) {
    console.error("[adminStore.getDashboardStats] error:", error?.name, error?.message, error);
    return { totalPending: 0, totalProcessing: 0, totalNeedMore: 0, totalCompleted: 0, totalRejected: 0, waitingMessages: 0 };
  }
}

async function listDossiers(query = "") {
  try {
    const dossiers = await readApplications();
    const visibleDossiers = dossiers.filter(isPaidApplication);
    const q = String(query || "").trim().toLowerCase();
    if (!q) return visibleDossiers;
    return visibleDossiers.filter((d) => String(d.dossierId || d.dossierCode || d.id || "").toLowerCase().includes(q) || String(d.phone || d.formData?.phone || "").toLowerCase().includes(q) || String(d.citizenName || d.formData?.fullName || "").toLowerCase().includes(q));
  } catch (error) {
    console.error("[adminStore.listDossiers] error:", error?.name, error?.message, error);
    return [];
  }
}

async function getDossierById(id) { return findApplicationByCode(id); }

function buildTimelineItem({ status, action, note, actor }) { return normalizeTimelineItem({ status, action, note, actor, createdAt: nowIso() }); }

async function appendDossierTimeline(current, item) {
  const nextTimeline = [...(current.timeline || []), normalizeTimelineItem(item)];
  const next = { ...current, status: normalizeDossierStatus(item.status), timeline: nextTimeline, history: nextTimeline, updatedAt: item.createdAt || nowIso() };
  await updateApplicationByCode(current.dossierId || current.id, next);
  return next;
}

async function decideDossier({ dossierId, action, note, adminEmail }) {
  const current = await getDossierById(dossierId);
  if (!current) return null;
  const actionMap = { receive: "PENDING", processing: "PROCESSING", request_more: "NEED_MORE", reject: "REJECTED", complete: "COMPLETED", approve: "PROCESSING" };
  const nextStatus = actionMap[action];
  if (!nextStatus) return null;
  const timelineItem = buildTimelineItem({ status: nextStatus, action, note, actor: adminEmail || "admin" });
  return appendDossierTimeline(current, timelineItem);
}

async function getOrCreateConversationByDossier(dossierId) {
  try {
    const found = await safeScan(SUPPORT_CONVERSATIONS_TABLE);
    let conv = found.find((x) => x.dossierId === dossierId) || null;
    if (!conv) {
      const dossier = await getDossierById(dossierId);
      conv = { id: `sup-${Date.now()}`, dossierId, citizenName: dossier?.citizenName || dossier?.formData?.fullName || "Ngu?i d?n", status: "active", messages: [], lastMessage: null, updatedAt: nowIso() };
      await safePut(SUPPORT_CONVERSATIONS_TABLE, conv);
    }
    return conv;
  } catch (error) {
    console.error("[adminStore.getOrCreateConversationByDossier] error:", error?.name, error?.message, error);
    return null;
  }
}

async function upsertConversationFromCitizen({ citizenUserId, citizenName, text }) { try { const uid = String(citizenUserId || "").trim(); if (!uid) return null; await sendMessage({ userId: uid, from: "citizen", text }); return getChatHistory(uid); } catch (error) { console.error("[adminStore.upsertConversationFromCitizen] error:", error?.name, error?.message, error); return null; } }
async function listConversations() { try { const conversations = await safeScan(SUPPORT_CONVERSATIONS_TABLE); const userIds = [...new Set(conversations.map((c) => c.citizenUserId || c.id).filter(Boolean))]; const userRecords = await Promise.all(userIds.map((uid) => findById(uid).catch(() => null))); const userMap = {}; userIds.forEach((uid, i) => { if (userRecords[i]) userMap[uid] = userRecords[i]; }); return conversations.map((conv) => { const uid = conv.citizenUserId || conv.id; const userRecord = userMap[uid] || null; const citizenName = (userRecord?.fullName && userRecord.fullName.trim()) ? userRecord.fullName.trim() : (conv.citizenName && conv.citizenName !== "Ngu?i d?n" && conv.citizenName.trim()) ? conv.citizenName.trim() : conv.citizenName || "Ngu?i d?n"; const avatarUrl = userRecord?.avatarUrl && userRecord.avatarUrl.trim() ? userRecord.avatarUrl.trim() : null; return { ...conv, citizenName, avatarUrl, latestMessage: conv.messages?.[conv.messages.length - 1] || null, unreadCount: conv.status === "active" || conv.status === "waiting" ? 1 : 0 }; }); } catch (error) { console.error("[adminStore.listConversations] error:", error?.name, error?.message, error); return []; } }
async function getConversationById(id) { try { return await getChatHistory(id); } catch { return null; } }
async function addConversationMessage({ conversationId, from, text, sender }) { try { const current = await getChatHistory(conversationId); if (!current) return null; return await sendMessage({ userId: conversationId, from, text, sender }); } catch { return null; } }
async function resolveConversation(conversationId) { const result = await safeUpdate(SUPPORT_CONVERSATIONS_TABLE, { Key: { id: conversationId }, UpdateExpression: "SET #status = :status, updatedAt = :updated_at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": "resolved", ":updated_at": nowIso() }, ConditionExpression: "attribute_exists(id)", ReturnValues: "ALL_NEW" }); return result?.Attributes || null; }
async function getAiHistory() { try { const item = await safeGet(ADMIN_AI_TABLE, { id: "default" }); if (item) return Array.isArray(item.history) ? item.history : []; return ensureLocalDb().ai.history; } catch { return ensureLocalDb().ai.history; } }
async function getAiRules() { try { const item = await safeGet(ADMIN_AI_TABLE, { id: "default" }); if (item) return String(item.rulesText || DEFAULT_AI_RULES); return ensureLocalDb().ai.rulesText; } catch { return ensureLocalDb().ai.rulesText; } }
async function updateAiRules(rulesText, adminEmail) { const historyItem = { id: `ai-${Date.now()}`, question: "C?p nh?t b?T quy t?c tr? l?i", answer: `Admin ${adminEmail || "unknown"} ?'? c?p nh?t rules`, at: nowIso() }; try { const result = await safeUpdate(ADMIN_AI_TABLE, { Key: { id: "default" }, UpdateExpression: "SET rulesText = :rules_text, history = list_append(:new_history, if_not_exists(history, :empty_list)), updatedAt = :updated_at", ExpressionAttributeValues: { ":rules_text": String(rulesText || ""), ":empty_list": [], ":new_history": [historyItem], ":updated_at": historyItem.at }, ReturnValues: "ALL_NEW" }); return result?.Attributes?.rulesText || String(rulesText || ""); } catch { const db = ensureLocalDb(); db.ai.rulesText = String(rulesText || ""); db.ai.history.unshift(historyItem); return db.ai.rulesText; } }
async function appendAiHistory(entry) { const historyItem = { id: entry?.id || `ai-${Date.now()}`, sessionId: String(entry?.sessionId || ""), question: String(entry?.question || "").slice(0, 4000), answer: String(entry?.answer || "").slice(0, 6000), source: String(entry?.source || "home_chat"), mode: String(entry?.mode || "fallback"), userId: String(entry?.userId || ""), userName: String(entry?.userName || ""), turnIndex: Number.isFinite(entry?.turnIndex) ? entry.turnIndex : 0, feedbackStatus: String(entry?.feedbackStatus || "pending"), confidenceLabel: String(entry?.confidenceLabel || "review"), note: String(entry?.note || "").slice(0, 1000), at: entry?.at || nowIso(), meta: entry?.meta && typeof entry.meta === "object" ? entry.meta : {} }; try { await safeUpdate(ADMIN_AI_TABLE, { Key: { id: "default" }, UpdateExpression: "SET history = list_append(:new_history, if_not_exists(history, :empty_list)), updatedAt = :updated_at", ExpressionAttributeValues: { ":new_history": [historyItem], ":empty_list": [], ":updated_at": nowIso() } }); } catch { ensureLocalDb().ai.history.unshift(historyItem); } return historyItem; }

module.exports = { getDashboardStats, listDossiers, getDossierById, decideDossier, getOrCreateConversationByDossier, upsertConversationFromCitizen, listConversations, getConversationById, addConversationMessage, resolveConversation, getAiHistory, getAiRules, updateAiRules, appendAiHistory };
