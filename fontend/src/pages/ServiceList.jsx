import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronDown, CircleDollarSign, Clock3, FileText, LayoutGrid, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import BackToDashboardButton from "../components/BackToDashboardButton.jsx";
import GovHeader from "../components/GovHeader.jsx";
import { getApiErrorMessage, getServices } from "../lib/api";

const currency = new Intl.NumberFormat("vi-VN");

export default function ServiceList() {
  const [services, setServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryMenuRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const { data } = await getServices();
        if (active) setAllServices(data.services || []);
      } catch {
        if (active) setAllServices([]);
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setErr("");
      try {
        const { data } = await getServices({ q: query, category: category === "all" ? "" : category });
        if (active) setServices(data.services || []);
      } catch (e) {
        if (active) setErr(getApiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [query, category]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!categoryMenuRef.current?.contains(event.target)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const categories = useMemo(() => {
    const source = allServices.length ? allServices : services;
    const list = source.map((s) => s.categoryName || s.category || "Khác").filter(Boolean);
    return ["all", ...new Set(list)];
  }, [allServices, services]);

  const stats = useMemo(() => {
    const categoriesCount = new Set(services.map((s) => s.categoryName || s.category || "Khác")).size;
    const free = services.filter((s) => Number(s.fee || 0) === 0).length;
    return [
      { label: "Tổng dịch vụ", value: services.length, icon: LayoutGrid },
      { label: "Nhóm danh mục", value: categoriesCount, icon: BadgeCheck },
      { label: "Dịch vụ miễn phí", value: free, icon: Sparkles },
    ];
  }, [services]);

  const categoryLabel = category === "all" ? "Tất cả danh mục" : category;

  return (
    <div className="min-h-screen bg-slate-50">
      <GovHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <BackToDashboardButton variant="soft" className="mb-5 self-start" />

        <section className="relative z-20 rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-950/8">
          <div className="rounded-t-3xl bg-linear-to-r from-[#003366] via-[#075b99] to-[#0f766e] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/85 ring-1 ring-white/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  Trang dịch vụ công
                </div>
                <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">Tìm dịch vụ nhanh hơn, rõ ràng hơn</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-blue-50">
                  Tra cứu dịch vụ theo từ khóa, nhóm thủ tục và mức phí trên mọi thiết bị.
                </p>
              </div>
              <div className="rounded-3xl bg-white/12 p-4 text-sm font-semibold leading-relaxed text-white ring-1 ring-white/20 lg:max-w-xs">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <span>Thiết kế tập trung vào tra cứu nhanh và thao tác ít bước.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="flex min-h-13 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 shadow-sm transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên dịch vụ, mô tả..."
                  className="h-13 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300 hover:text-slate-700"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div ref={categoryMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryOpen((open) => !open)}
                  className={`flex min-h-13 w-full items-center gap-3 rounded-2xl border bg-slate-50 px-4 text-left shadow-sm transition ${
                    categoryOpen
                      ? "border-blue-300 bg-white ring-4 ring-blue-100"
                      : "border-slate-200 hover:border-blue-200 hover:bg-white"
                  }`}
                >
                  <SlidersHorizontal className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{categoryLabel}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${categoryOpen ? "rotate-180" : ""}`} />
                </button>
                {categoryOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-blue-100 bg-white p-1.5 shadow-2xl shadow-blue-950/12">
                    <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
                      {categories.filter((c) => c !== category).map((c) => {
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setCategory(c);
                              setCategoryOpen(false);
                            }}
                            className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-(--gov-navy)"
                          >
                            <span>{c === "all" ? "Tất cả danh mục" : c}</span>
                            <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <ServiceStat key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </section>

        {err ? (
          <div className="mt-6 rounded-3xl bg-red-50 p-5 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            Không tải được dữ liệu. {err}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />)}
          </div>
        ) : services.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-(--gov-navy)">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-950">Không tìm thấy dịch vụ phù hợp</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác để xem thêm kết quả.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const id = service.serviceId || service.id;
              return (
                <ServiceCard key={id} service={service} id={id} />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ServiceStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-(--gov-navy) ring-1 ring-blue-100">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-black leading-none text-slate-950">{value}</div>
          <div className="mt-1 text-xs font-bold text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service, id }) {
  const fee = Number(service.fee || 0);
  const isFree = fee === 0;

  return (
    <Link
      to={`/services/${id}`}
      className="group flex min-h-72 flex-col rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-950/8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-(--gov-navy) ring-1 ring-blue-100">
          {service.categoryName || service.category || "Dịch vụ"}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1 ${isFree ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
          <CircleDollarSign className="h-3.5 w-3.5" />
          {isFree ? "Miễn phí" : `${currency.format(fee)} VNĐ`}
        </span>
      </div>

      <h3 className="mt-5 text-xl font-black leading-snug text-slate-950 transition group-hover:text-(--gov-navy)">
        {service.name}
      </h3>
      <p className="mt-3 line-clamp-3 flex-1 text-sm font-semibold leading-relaxed text-slate-500">
        {service.description || "Chưa có mô tả"}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
          <Clock3 className="h-3.5 w-3.5" />
          {service.processingTime || "Đang cập nhật"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
          <BadgeCheck className="h-3.5 w-3.5" />
          Nộp online
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-xs font-semibold leading-relaxed text-slate-500">Xem quy trình, hồ sơ và nộp trực tuyến</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-(--gov-navy) transition group-hover:bg-(--gov-navy) group-hover:text-white">
          Mở dịch vụ
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
