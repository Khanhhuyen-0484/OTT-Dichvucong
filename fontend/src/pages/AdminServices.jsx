import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, ClipboardList, Edit3, FileText, House, Layers3, LogOut, MessageCircleMore, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp, Zap } from "lucide-react";
import UserAvatar from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteService, getApiErrorMessage, getServices, seedServices, updateService } from "../lib/api";

const NAV_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: House, path: "/admin/dashboard" },
  { key: "records", label: "Quản lý hồ sơ", icon: ClipboardList, path: "/admin/documents" },
  { key: "services", label: "Quản lý dịch vụ", icon: FileText, path: "/admin/services" },
  { key: "statistics", label: "Thống kê", icon: TrendingUp, path: "/admin/statistics" },
  { key: "support", label: "Chat 1v1", icon: MessageCircleMore, path: "/admin/chat" },
  { key: "ai", label: "Quản trị AI", icon: Bot, path: "/admin/ai" },
];

function ServiceStat({ label, value, icon: Icon, theme, surface }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/80 p-4 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/70 ${surface}`}>
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/60 blur-2xl" />
      <div className="absolute -bottom-10 left-6 h-20 w-20 rounded-full bg-white/35 blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="text-3xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
        </div>
        <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br ${theme} text-white shadow-lg shadow-slate-900/10`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ServiceInfo({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}

export default function AdminServices() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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

  const stats = useMemo(() => {
    const active = services.filter((item) => item.active !== false).length;
    const hidden = services.length - active;
    const categories = new Set(services.map((item) => item.categoryName || item.category).filter(Boolean)).size;
    return { total: services.length, active, hidden, categories };
  }, [services]);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.18),transparent_30%),linear-gradient(180deg,#fbf8ff_0%,#effcff_48%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-white/70 bg-white/85 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-linear-to-br from-blue-700 via-blue-600 to-cyan-500 p-2 text-white shadow-lg shadow-blue-600/25">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trang quản trị</div>
              <div className="text-xl font-black text-slate-900">Cổng Dịch vụ công</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
            <UserAvatar user={user} size={44} />
            <div>
              <div className="text-sm font-bold text-slate-900">{user?.fullName || "Quản trị viên"}</div>
              <div className="text-xs text-slate-500">{user?.email || "Chưa có email"}</div>
            </div>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">
              <LogOut className="h-4 w-4" />Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full gap-6 px-4 py-6 md:px-6 xl:px-8">
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="sticky top-6 rounded-4xl border border-white/80 bg-white/80 p-3 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Điều hướng</div>
              <div className="mt-1 text-sm font-black text-slate-900">Bảng quản trị</div>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.key === "services";
              return (
                <button key={item.key} type="button" onClick={() => navigate(item.path)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${active ? "bg-linear-to-r from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-600/20" : "bg-white/70 text-slate-700 ring-1 ring-slate-100 hover:bg-blue-50 hover:text-blue-700"}`}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">

        <section className="relative overflow-hidden rounded-4xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-950/5 ring-1 ring-slate-200/70 backdrop-blur">
          <div className="absolute inset-0 bg-linear-to-br from-violet-100/70 via-cyan-50/80 to-emerald-100/60" />
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-teal-300/25 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-violet-600 to-cyan-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-violet-600/20">
                <Sparkles className="h-4 w-4" />
                Admin dịch vụ công
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Quản lý dịch vụ công</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Theo dõi danh mục dịch vụ, cấu hình lệ phí, giấy tờ, thời gian xử lý và trạng thái hiển thị cho người dân.</p>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <button onClick={handleSeed} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md disabled:opacity-50">
                <RefreshCw className="h-4 w-4" />
                Seed mẫu
              </button>
              <Link to="/admin/services/create" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 hover:shadow-xl">
                <Plus className="h-4 w-4" />
                Tạo dịch vụ
              </Link>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-4">
            <ServiceStat label="Tổng dịch vụ" value={stats.total} icon={Layers3} theme="from-violet-600 to-blue-500" surface="bg-linear-to-br from-violet-50 via-white to-blue-50" />
            <ServiceStat label="Đang hoạt động" value={stats.active} icon={Zap} theme="from-emerald-500 to-teal-400" surface="bg-linear-to-br from-emerald-50 via-white to-teal-50" />
            <ServiceStat label="Tạm ẩn" value={stats.hidden} icon={FileText} theme="from-slate-600 to-slate-400" surface="bg-linear-to-br from-slate-50 via-white to-zinc-50" />
            <ServiceStat label="Nhóm dịch vụ" value={stats.categories} icon={Sparkles} theme="from-amber-500 to-fuchsia-500" surface="bg-linear-to-br from-amber-50 via-white to-fuchsia-50" />
          </div>

          <div className="relative mt-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm dịch vụ theo tên, mô tả, nhóm dịch vụ..." className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3.5 pl-12 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </div>
          </div>
        </section>

        {message ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-bold text-amber-800 shadow-sm">{message}</div> : null}
        {loading ? <div className="mt-6 rounded-3xl bg-white/90 p-6 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">Đang tải dịch vụ...</div> : null}

        {!loading && (
          <section className="mt-6 grid gap-4">
            {filtered.map((service) => {
              const id = service.serviceId || service.id;
              const active = service.active !== false;
              return (
                <div key={id} className={`group relative overflow-hidden rounded-4xl border border-white/75 p-5 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${active ? "bg-linear-to-br from-white via-cyan-50/65 to-emerald-50/70" : "bg-linear-to-br from-white via-slate-50 to-zinc-100/70"}`}>
                  <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition group-hover:scale-125 ${active ? "bg-teal-300/25" : "bg-slate-300/25"}`} />
                  <div className={`absolute -left-12 bottom-0 h-28 w-28 rounded-full blur-3xl ${active ? "bg-violet-300/15" : "bg-zinc-300/20"}`} />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="relative min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">{service.categoryName || service.category || "Dịch vụ"}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{active ? "Đang hoạt động" : "Tạm ẩn"}</span>
                      </div>
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{service.name}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{service.description || "Chưa có mô tả"}</p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                        <ServiceInfo label="Lệ phí" value={`${new Intl.NumberFormat("vi-VN").format(service.fee || 0)} VNĐ`} />
                        <ServiceInfo label="Thời gian" value={service.processingTime || "-"} />
                        <ServiceInfo label="Cơ quan" value={service.agency || "-"} />
                        <ServiceInfo label="Giấy tờ" value={Array.isArray(service.documents) ? service.documents.length : 0} />
                      </div>
                    </div>
                    <div className="relative flex shrink-0 flex-wrap gap-2">
                      <Link to={`/admin/services/${id}/edit`} className="inline-flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-2.5 text-sm font-black text-violet-700 ring-1 ring-violet-100 transition hover:-translate-y-0.5 hover:bg-violet-600 hover:text-white hover:shadow-md">
                        <Edit3 className="h-4 w-4" />
                        Sửa
                      </Link>
                      <button disabled={busy} onClick={() => toggleActive(service)} className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md disabled:opacity-50">
                        {active ? "Tạm ẩn" : "Bật lại"}
                      </button>
                      <button disabled={busy} onClick={() => handleDelete(service)} className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-700 ring-1 ring-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-600 hover:text-white hover:shadow-md disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!filtered.length ? <div className="rounded-4xl border border-dashed border-slate-300 bg-white/90 p-10 text-center text-sm font-semibold text-slate-500 shadow-sm">Không có dịch vụ phù hợp.</div> : null}
          </section>
        )}
      </main>
      </div>
    </div>
  );
}
