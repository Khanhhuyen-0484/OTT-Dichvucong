import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Edit3, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import { deleteService, getApiErrorMessage, getServices, seedServices, updateService } from "../lib/api";

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((item) => {
      const text = `${item.name || ""} ${item.description || ""} ${item.categoryName || item.category || ""}`.toLowerCase();
      return !q || text.includes(q);
    });
  }, [services, query]);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await getServices();
      setServices(data.services || []);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSeed() {
    setBusy(true);
    try {
      await seedServices();
      await load();
      setMessage("Đã seed dịch vụ mẫu");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(service) {
    const id = service.serviceId || service.id;
    if (!id) return;
    setBusy(true);
    try {
      await updateService(id, { ...service, active: service.active === false });
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(service) {
    const id = service.serviceId || service.id;
    if (!id || !window.confirm("Xóa dịch vụ này?")) return;
    setBusy(true);
    try {
      await deleteService(id);
      await load();
      setMessage("Đã xóa dịch vụ");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <BackToDashboardButton variant="soft" />
          <Link to="/admin/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                <Sparkles className="h-4 w-4" />
                Admin dịch vụ công
              </div>
              <h1 className="mt-3 text-3xl font-black text-slate-900">Quản lý dịch vụ công</h1>
              <p className="mt-2 text-sm text-slate-600">Theo dõi, tạo mới, bật tắt và xóa dịch vụ.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSeed} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                <RefreshCw className="h-4 w-4" />
                Seed mẫu
              </button>
              <Link to="/admin/services/create" className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white hover:bg-[#00264d]">
                <Plus className="h-4 w-4" />
                Tạo dịch vụ
              </Link>
            </div>
          </div>

          <div className="mt-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm dịch vụ..." className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#003366]" />
            </div>
          </div>
        </section>

        {message ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div> : null}
        {loading ? <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">Đang tải dịch vụ...</div> : null}

        {!loading && (
          <section className="mt-6 grid gap-4">
            {filtered.map((service) => {
              const id = service.serviceId || service.id;
              return (
                <div key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{service.categoryName || service.category || "Dịch vụ"}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${service.active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{service.active === false ? "Tạm ẩn" : "Đang hoạt động"}</span>
                      </div>
                      <h2 className="mt-3 text-xl font-black text-slate-900">{service.name}</h2>
                      <p className="mt-2 text-sm text-slate-600">{service.description || "Chưa có mô tả"}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span><strong>Lệ phí:</strong> {new Intl.NumberFormat("vi-VN").format(service.fee || 0)} VNĐ</span>
                        <span><strong>Thời gian:</strong> {service.processingTime || "-"}</span>
                        <span><strong>Cơ quan:</strong> {service.agency || "-"}</span>
                        <span><strong>Giấy tờ:</strong> {Array.isArray(service.documents) ? service.documents.length : 0}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link to={`/admin/services/${id}/edit`} className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                        <Edit3 className="h-4 w-4" />
                        Sửa
                      </Link>
                      <button disabled={busy} onClick={() => toggleActive(service)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                        {service.active === false ? "Bật lại" : "Tạm ẩn"}
                      </button>
                      <button disabled={busy} onClick={() => handleDelete(service)} className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!filtered.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có dịch vụ phù hợp.</div> : null}
          </section>
        )}
      </main>
    </div>
  );
}
