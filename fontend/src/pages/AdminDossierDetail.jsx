import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeAlert, Ban, Clock3, Download, FileCheck2, FileText, Play, RefreshCw, Upload, X } from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import { deliverAdminDossierResult, downloadApplicationResult, getAdminDossier, getApiErrorMessage, resolvedApiBaseUrl, updateAdminDossierStatus } from "../lib/api";

const STATUS_META = {
  PENDING: { text: "Chá» tiáº¿p nháº­n", color: "bg-slate-100 text-slate-700", icon: Clock3 },
  PROCESSING: { text: "Äang xá»­ lÃ½", color: "bg-sky-100 text-sky-700", icon: Play },
  NEED_MORE: { text: "YÃªu cáº§u bá»• sung", color: "bg-amber-100 text-amber-700", icon: BadgeAlert },
  SUPPLEMENTED: { text: "ÄÃ£ bá»• sung", color: "bg-indigo-100 text-indigo-700", icon: FileText },
  REJECTED: { text: "Tá»« chá»‘i", color: "bg-red-100 text-red-700", icon: Ban },
  COMPLETED: { text: "HoÃ n thÃ nh", color: "bg-emerald-100 text-emerald-700", icon: FileCheck2 },
  RESULT_DELIVERED: { text: "Đã trả kết quả", color: "bg-emerald-100 text-emerald-700", icon: FileCheck2 },
};

const WORKFLOW_BUTTONS = [
  { key: "PENDING", label: "Tiáº¿p nháº­n", icon: Clock3, className: "bg-slate-700 hover:bg-slate-800 text-white" },
  { key: "PROCESSING", label: "Äang xá»­ lÃ½", icon: Play, className: "bg-sky-600 hover:bg-sky-700 text-white" },
  { key: "NEED_MORE", label: "YÃªu cáº§u bá»• sung", icon: BadgeAlert, className: "bg-amber-500 hover:bg-amber-600 text-white" },
  { key: "REJECTED", label: "Tá»« chá»‘i", icon: Ban, className: "bg-red-600 hover:bg-red-700 text-white" },
  { key: "COMPLETED", label: "HoÃ n thÃ nh", icon: FileCheck2, className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

function statusLabel(status) {
  return STATUS_META[String(status || "").toUpperCase()] || { text: status || "ChÆ°a rÃµ", color: "bg-slate-100 text-slate-700" };
}

function getAttachmentUrl(fileUrl) {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return encodeURI(fileUrl);
  const base = String(resolvedApiBaseUrl || "/api").replace(/\/api\/?$/, "");
  return encodeURI(`${base}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`);
}

function Field({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}

export default function AdminDossierDetail() {
  const { dossierId } = useParams();
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workflowModal, setWorkflowModal] = useState(null);
  const [resultModal, setResultModal] = useState({ open: false, file: null, note: "" });

  const status = String(dossier?.status || "PENDING").toUpperCase();
  const statusMeta = statusLabel(status);
  const timeline = Array.isArray(dossier?.timeline) ? dossier.timeline : Array.isArray(dossier?.history) ? dossier.history : [];
  const attachments = Array.isArray(dossier?.attachments) ? dossier.attachments : [];
  const formData = dossier?.formData || {};

  const headerStats = useMemo(() => [
    { label: "MÃ£ há»“ sÆ¡", value: dossier?.applicationCode || dossier?.dossierCode || dossier?.dossierId || dossier?.id },
    { label: "Dá»‹ch vá»¥", value: dossier?.serviceName || dossier?.serviceId },
    { label: "NgÃ y táº¡o", value: formatDate(dossier?.createdAt) },
    { label: "Thanh toÃ¡n", value: dossier?.paymentStatus || "UNPAID" },
  ], [dossier]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await getAdminDossier(dossierId);
      setDossier(data.dossier || null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dossierId]);

  async function submitWorkflow(nextStatus, note = "") {
    setBusy(true);
    setMessage("");
    try {
      await updateAdminDossierStatus(dossierId, { status: nextStatus, note, action: String(nextStatus).toLowerCase() });
      setWorkflowModal(null);
      setMessage("ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i há»“ sÆ¡");
      await load();
    } catch (err) {
      setMessage(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitResultDelivery() {
    if (!resultModal.file) {
      setMessage("Vui lòng chọn file PDF kết quả");
      return;
    }
    if (resultModal.file.type !== "application/pdf") {
      setMessage("Chỉ chấp nhận file PDF");
      return;
    }
    if (resultModal.file.size > 10 * 1024 * 1024) {
      setMessage("File PDF tối đa 10MB");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", resultModal.file);
      formData.append("note", resultModal.note || "");
      const { data } = await deliverAdminDossierResult(dossierId, formData);
      setDossier(data.dossier || null);
      setResultModal({ open: false, file: null, note: "" });
      setMessage(data.emailFailed ? "Đã trả kết quả, nhưng gửi email thất bại" : "Đã trả kết quả hồ sơ");
      await load();
    } catch (err) {
      setMessage(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openResultFile() {
    try {
      const code = dossier?.dossierId || dossier?.applicationCode || dossierId;
      const { data } = await downloadApplicationResult(code);
      const url = data?.result?.resultFileUrl || dossier?.resultFileUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMessage(getApiErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <BackToDashboardButton variant="soft" className="mb-5" />

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-600">Äang táº£i há»“ sÆ¡...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm font-semibold text-red-700">{error}</div>
        ) : dossier ? (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    <FileText className="h-4 w-4" />
                    Chi tiáº¿t há»“ sÆ¡
                  </div>
                  <h1 className="mt-3 text-3xl font-black text-slate-900">{dossier.serviceName || "Há»“ sÆ¡ dá»‹ch vá»¥ cÃ´ng"}</h1>
                  <p className="mt-2 text-sm text-slate-600">Theo dÃµi thÃ´ng tin kÃª khai, tÃ i liá»‡u vÃ  xá»­ lÃ½ workflow cá»§a há»“ sÆ¡.</p>
                </div>
                <div className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${statusMeta.color}`}>{statusMeta.text}</div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {headerStats.map((item) => <Field key={item.label} label={item.label} value={item.value} />)}
              </div>
            </section>

            {message ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div> : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
              <section className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900">ThÃ´ng tin ngÆ°á»i ná»™p</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Há» tÃªn" value={dossier.citizenName || formData.fullName} />
                    <Field label="Email" value={dossier.email || formData.email} />
                    <Field label="Sá»‘ Ä‘iá»‡n thoáº¡i" value={dossier.phone || formData.phone} />
                    <Field label="CCCD/CMND" value={formData.citizenId || dossier.citizenId} />
                    <Field label="Äá»‹a chá»‰" value={formData.address || dossier.address} />
                    <Field label="Ná»™i dung yÃªu cáº§u" value={formData.requestContent || formData.note || formData.supplementNote} />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900">TÃ i liá»‡u Ä‘Ã­nh kÃ¨m</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {attachments.length ? attachments.map((file, idx) => {
                      const url = getAttachmentUrl(file.fileUrl || file.url || file.path || "");
                      const fileName = file.fileName || file.name || file.label || `TÃ i liá»‡u ${idx + 1}`;
                      return (
                        <div key={`${fileName}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="font-bold text-slate-900">{file.label || fileName}</div>
                          <div className="mt-2 text-sm text-slate-600">
                            <div><strong>Tá»‡p:</strong> {fileName}</div>
                            <div><strong>Loáº¡i:</strong> {file.mimeType || file.type || "-"}</div>
                            <div><strong>KÃ­ch thÆ°á»›c:</strong> {file.size ? `${Math.round(file.size / 1024)} KB` : "-"}</div>
                          </div>
                          {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-[#003366] px-3 py-2 text-sm font-semibold text-white">Má»Ÿ tÃ i liá»‡u</a> : null}
                        </div>
                      );
                    }) : <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 md:col-span-2">KhÃ´ng cÃ³ tÃ i liá»‡u Ä‘Ã­nh kÃ¨m.</div>}
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-900">Xá»­ lÃ½ há»“ sÆ¡</h2>
                      <p className="mt-1 text-sm text-slate-600">Cáº­p nháº­t tráº¡ng thÃ¡i workflow.</p>
                    </div>
                    <button type="button" onClick={load} className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><RefreshCw className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {WORKFLOW_BUTTONS.map((btn) => {
                      const Icon = btn.icon;
                      const isCurrent = status === btn.key;
                      const disabled = busy || isCurrent || (btn.key === "COMPLETED" && status === "REJECTED");
                      return (
                        <button key={btn.key} type="button" disabled={disabled} onClick={() => (btn.key === "NEED_MORE" || btn.key === "REJECTED") ? setWorkflowModal({ status: btn.key, note: "" }) : submitWorkflow(btn.key, btn.key === "COMPLETED" ? "Há»“ sÆ¡ Ä‘Ã£ hoÃ n thÃ nh" : btn.label)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${btn.className}`}>
                          <Icon className="h-4 w-4" />
                          {btn.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setResultModal({ open: true, file: null, note: "" })}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      Trả kết quả
                    </button>
                  </div>
                </div>

                {(dossier.resultFileUrl || status === "RESULT_DELIVERED") ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <h2 className="text-lg font-black text-emerald-950">Kết quả hồ sơ</h2>
                    <p className="mt-1 text-sm font-semibold text-emerald-800">Hồ sơ đã có file kết quả PDF.</p>
                    {dossier.resultNote ? <p className="mt-3 rounded-2xl bg-white/70 p-3 text-sm font-semibold text-emerald-900">{dossier.resultNote}</p> : null}
                    <button
                      type="button"
                      onClick={openResultFile}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                    >
                      <Download className="h-4 w-4" />
                      Tải file kết quả
                    </button>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">Timeline</h2>
                    <span className="text-xs font-semibold text-slate-500">{timeline.length} má»‘c</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {timeline.length ? timeline.map((item, idx) => {
                      const meta = statusLabel(item.status);
                      return (
                        <div key={`${item.createdAt || idx}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${meta.color}`}>{meta.text}</span>
                            <span className="font-semibold text-slate-900">{item.action || "Cáº­p nháº­t tráº¡ng thÃ¡i"}</span>
                          </div>
                          <div className="mt-2 text-sm text-slate-700">{item.note || "-"}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)} Â· {item.actor || "-"}</div>
                        </div>
                      );
                    }) : <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">ChÆ°a cÃ³ timeline.</div>}
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </main>

      {resultModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">Trả kết quả hồ sơ</h3>
              <button onClick={() => setResultModal({ open: false, file: null, note: "" })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              File PDF kết quả
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setResultModal((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold"
              />
            </label>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Ghi chú
              <textarea
                value={resultModal.note}
                onChange={(event) => setResultModal((current) => ({ ...current, note: event.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-[#003366]"
                placeholder="Nhập ghi chú trả kết quả..."
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setResultModal({ open: false, file: null, note: "" })} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200">Hủy</button>
              <button onClick={submitResultDelivery} disabled={busy || !resultModal.file} className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">
                {busy ? "Đang gửi..." : "Gửi kết quả"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {workflowModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">{workflowModal.status === "NEED_MORE" ? "Nháº­p lÃ½ do yÃªu cáº§u bá»• sung" : "Nháº­p lÃ½ do tá»« chá»‘i"}</h3>
              <button onClick={() => setWorkflowModal(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <textarea value={workflowModal.note} onChange={(event) => setWorkflowModal({ ...workflowModal, note: event.target.value })} rows={5} className="mt-4 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#003366]" placeholder="Nháº­p lÃ½ do..." />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setWorkflowModal(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200">Há»§y</button>
              <button onClick={() => submitWorkflow(workflowModal.status, workflowModal.note)} disabled={busy || !String(workflowModal.note || "").trim()} className="flex-1 rounded-xl bg-[#003366] px-4 py-3 font-bold text-white disabled:opacity-50">XÃ¡c nháº­n</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
