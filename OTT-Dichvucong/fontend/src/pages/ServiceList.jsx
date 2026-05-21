import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, FileText, Clock3, CircleDollarSign, ArrowRight, Sparkles, BadgeCheck, LayoutGrid, X } from "lucide-react";
import GovHeader from "../components/GovHeader.jsx";
import { getApiErrorMessage, getServices } from "../lib/api";

const currency = new Intl.NumberFormat("vi-VN");

export default function ServiceList() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setErr("");

      try {
        const { data } = await getServices({ q: query, category: category === "all" ? "" : category });
        if (!active) return;
        setServices(data.services || []);
      } catch (e) {
        if (!active) return;
        setErr(getApiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [query, category]);

  const categories = useMemo(() => {
    const list = services.map((s) => s.categoryName || s.category || "Khác").filter(Boolean);
    return ["all", ...new Set(list)];
  }, [services]);

  const stats = useMemo(() => {
    const total = services.length;
    const categoriesCount = new Set(services.map((s) => s.categoryName || s.category || "Khác")).size;
    const free = services.filter((s) => Number(s.fee || 0) === 0).length;
    return [
      { label: "Tổng dịch vụ", value: total, icon: LayoutGrid },
      { label: "Nhóm danh mục", value: categoriesCount, icon: BadgeCheck },
      { label: "Dịch vụ miễn phí", value: free, icon: Sparkles },
    ];
  }, [services]);

  return (
    <div style={styles.page}>
      <GovHeader />
      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroHeader}>
            <div>
              <div style={styles.heroBadge}>Trang dịch vụ công</div>
              <h1 style={styles.title}>Tìm dịch vụ nhanh hơn, rõ ràng hơn</h1>
              <p style={styles.desc}>
                Giao diện mới giúp người dân tra cứu dịch vụ theo từ khóa, nhóm thủ tục và mức phí một cách gọn gàng, dễ đọc trên mọi thiết bị.
              </p>
            </div>

            <div style={styles.heroHighlight}>
              <Sparkles size={18} color="#2563eb" />
              <span>Thiết kế tập trung vào tra cứu nhanh và thao tác ít bước</span>
            </div>
          </div>

          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={18} color="#64748b" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên dịch vụ, mô tả..."
                style={styles.searchInput}
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} style={styles.clearBtn} aria-label="Xóa tìm kiếm">
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div style={styles.filterBox}>
              <SlidersHorizontal size={18} color="#64748b" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.select}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "Tất cả danh mục" : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.statsGrid}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} style={styles.statCard}>
                  <div style={styles.statIcon}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={styles.statValue}>{stat.value}</div>
                    <div style={styles.statLabel}>{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {err ? <div style={styles.errorState}>Không tải được dữ liệu. {err}</div> : null}

        {loading ? (
          <div style={styles.grid}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} style={styles.skeletonCard}>
                <div style={styles.skeletonTag} />
                <div style={styles.skeletonTitle} />
                <div style={styles.skeletonText} />
                <div style={styles.skeletonTextShort} />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText size={40} color="#94a3b8" />
            <h3 style={styles.emptyTitle}>Không tìm thấy dịch vụ phù hợp</h3>
            <p style={styles.emptyDesc}>Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác để xem thêm kết quả.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {services.map((service) => {
              const id = service.serviceId || service.id;
              return (
                <Link key={id} to={`/services/${id}`} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.cardTag}>{service.categoryName || service.category || "Dịch vụ"}</div>
                    <div style={styles.pricePill}>
                      <CircleDollarSign size={14} />
                      <span>{currency.format(service.fee || 0)} VNĐ</span>
                    </div>
                  </div>

                  <h3 style={styles.cardTitle}>{service.name}</h3>
                  <p style={styles.cardText}>{service.description || "Chưa có mô tả"}</p>

                  <div style={styles.metaRow}>
                    <span style={styles.metaItem}>
                      <Clock3 size={14} />
                      {service.processingTime || "Đang cập nhật"}
                    </span>
                    <span style={styles.metaItem}>
                      <BadgeCheck size={14} />
                      Xem chi tiết thủ tục
                    </span>
                  </div>

                  <div style={styles.actionRow}>
                    <span style={styles.actionText}>Mở dịch vụ để xem hồ sơ, quy trình và nộp online</span>
                    <span style={styles.actionBtn}>
                      Mở dịch vụ
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)",
  },
  container: { maxWidth: 1200, margin: "0 auto", padding: "32px 16px 48px" },
  hero: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
    marginBottom: 20,
  },
  heroHeader: {
    display: "grid",
    gridTemplateColumns: "1.8fr 1fr",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 12,
  },
  title: { fontSize: 32, lineHeight: 1.15, fontWeight: 900, marginBottom: 10, color: "#0f172a" },
  desc: { color: "#475569", maxWidth: 760, lineHeight: 1.6, margin: 0 },
  heroHighlight: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    color: "#334155",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "0 14px",
    minHeight: 56,
  },
  filterBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "0 14px",
    minHeight: 56,
  },
  searchInput: {
    width: "100%",
    height: 52,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
  },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "none",
    background: "#e2e8f0",
    color: "#475569",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  select: {
    width: "100%",
    height: 52,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    color: "#0f172a",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "#eff6ff",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statValue: { fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 },
  statLabel: { color: "#64748b", fontSize: 13, marginTop: 2 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: 20,
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    color: "#0f172a",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" },
  cardTag: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  pricePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 12,
    fontWeight: 700,
  },
  cardTitle: { fontSize: 20, fontWeight: 800, marginBottom: 10, color: "#0f172a", lineHeight: 1.35 },
  cardText: { marginBottom: 14, lineHeight: 1.7, color: "#475569" },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  metaItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 600,
  },
  actionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: "1px solid #e2e8f0", paddingTop: 14 },
  actionText: { fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.5 },
  actionBtn: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#1d4ed8" },
  emptyState: {
    background: "#fff",
    border: "1px dashed #cbd5e1",
    borderRadius: 24,
    padding: 44,
    textAlign: "center",
    color: "#0f172a",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  },
  emptyTitle: { margin: "14px 0 8px", fontSize: 20 },
  emptyDesc: { margin: 0, color: "#64748b", lineHeight: 1.7 },
  errorState: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    fontWeight: 700,
  },
  skeletonCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 20,
    border: "1px solid #e2e8f0",
  },
  skeletonTag: { width: 92, height: 24, borderRadius: 999, background: "#e2e8f0", marginBottom: 18 },
  skeletonTitle: { width: "85%", height: 22, borderRadius: 8, background: "#e2e8f0", marginBottom: 12 },
  skeletonText: { width: "100%", height: 14, borderRadius: 8, background: "#e2e8f0", marginBottom: 8 },
  skeletonTextShort: { width: "72%", height: 14, borderRadius: 8, background: "#e2e8f0" },
};
