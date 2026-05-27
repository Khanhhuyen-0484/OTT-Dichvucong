import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteService, getApiErrorMessage, getServices, seedServices } from "../lib/api";
import { BadgeCheck, Filter, PencilLine, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function StatusPill({ active }) {
  return <span style={active ? styles.statusPublished : styles.statusDraft}>{active ? "Đã xuất bản" : "Lưu nháp"}</span>;
}

function Th({ children }) {
  return <th style={styles.th}>{children}</th>;
}

function Td({ children, strong }) {
  return <td style={strong ? { ...styles.td, fontWeight: 800, color: "#0f172a" } : styles.td}>{children}</td>;
}

export default function AdminServices() {
  const navigate = useNavigate();
  const location = useLocation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [message, setMessage] = useState(location.state?.message || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getServices({ q: query });
      setServices(data.services || []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [query]);

  const filteredServices = useMemo(() => {
    if (statusFilter === "PUBLISHED") return services.filter((s) => s.active !== false);
    if (statusFilter === "DRAFT") return services.filter((s) => s.active === false);
    return services;
  }, [services, statusFilter]);

  const stats = useMemo(() => ({
    total: services.length,
    published: services.filter((s) => s.active !== false).length,
    draft: services.filter((s) => s.active === false).length,
    categories: new Set(services.map((s) => s.categoryName || s.category || "Khác")).size,
  }), [services]);

  const onDelete = async (serviceId) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa dịch vụ này?")) return;
    setBusy(true);
    try {
      await deleteService(serviceId);
      setMessage("Đã xóa dịch vụ");
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    setBusy(true);
    try {
      const res = await seedServices();
      setMessage(res.data?.message || "Đã seed dữ liệu");
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div>
            <div style={styles.badge}><Sparkles size={12} /> Admin dịch vụ công</div>
            <h1 style={styles.title}>Quản lý dịch vụ công</h1>
            <p style={styles.desc}>
              Trang quản lý danh sách dịch vụ, thống kê nhanh và bộ lọc tiện dụng.
              Tạo mới đã được tách sang trang riêng để thao tác tập trung hơn.
            </p>
          </div>
          <div style={styles.topActions}>
            <button type="button" onClick={load} style={styles.secondaryBtn}>
              <RotateCcw size={16} /> Làm mới
            </button>
            <button type="button" onClick={handleSeed} disabled={busy} style={styles.secondaryBtn}>
              <BadgeCheck size={16} /> Seed dữ liệu
            </button>
            <button type="button" onClick={() => navigate("/admin/services/create")} style={styles.primaryBtn}>
              <Plus size={16} /> Tạo mới
            </button>
          </div>
        </div>

        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.statsGrid}>
          <Stat label="Tổng dịch vụ" value={stats.total} />
          <Stat label="Đã xuất bản" value={stats.published} />
          <Stat label="Lưu nháp" value={stats.draft} />
          <Stat label="Danh mục" value={stats.categories} />
        </div>

        <div style={styles.filterBar}>
          <div style={styles.searchBox}>
            <Search size={18} color="#64748b" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, mô tả, danh mục..."
              style={styles.searchInput}
            />
          </div>
          <div style={styles.filterBox}>
            <Filter size={16} color="#64748b" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.select}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PUBLISHED">Đã xuất bản</option>
              <option value="DRAFT">Lưu nháp</option>
            </select>
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <div>
              <div style={styles.tableTitle}>Danh sách dịch vụ</div>
              <div style={styles.tableSub}>Mã, tên, danh mục, thời gian xử lý và trạng thái.</div>
            </div>
            <div style={styles.tableHint}><ShieldCheck size={14} /> Dữ liệu dịch vụ công</div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Đang tải dữ liệu...</div>
          ) : filteredServices.length === 0 ? (
            <div style={styles.emptyState}>Không có dịch vụ phù hợp.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <Th>Tên dịch vụ</Th>
                    <Th>Danh mục</Th>
                    <Th>Ngày tạo</Th>
                    <Th>Trạng thái</Th>
                    <Th>Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const id = service.serviceId || service.id;
                    return (
                      <tr key={id}>
                        <Td strong>{service.name}</Td>
                        <Td>{service.categoryName || service.category || "Khác"}</Td>
                        <Td>{service.createdAt ? new Date(service.createdAt).toLocaleDateString("vi-VN") : "-"}</Td>
                        <Td><StatusPill active={service.active !== false} /></Td>
                        <Td>
                          <div style={styles.actions}>
                            <button type="button" onClick={() => navigate("/admin/services/create", { state: { service } })} style={styles.editBtn}>
                              <PencilLine size={14} /> Sửa
                            </button>
                            <button type="button" onClick={() => onDelete(id)} disabled={busy} style={styles.deleteBtn}>
                              <Trash2 size={14} /> Xóa
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)", padding: 24 },
  container: { maxWidth: 1600, margin: "0 auto" },
  topBar: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, marginBottom: 16, boxShadow: "0 10px 30px rgba(15,23,42,.05)" },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  title: { margin: "12px 0 8px", fontSize: 34, fontWeight: 900, color: "#0f172a" },
  desc: { margin: 0, color: "#475569", maxWidth: 900, lineHeight: 1.7 },
  topActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  success: { display: "inline-flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: 12, borderRadius: 14, fontWeight: 700, marginBottom: 16 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12, borderRadius: 14, fontWeight: 700, marginBottom: 16 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 },
  statCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16 },
  statValue: { fontSize: 26, fontWeight: 900, color: "#0f172a" },
  statLabel: { fontSize: 13, color: "#64748b", marginTop: 4 },
  filterBar: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  searchBox: { flex: 1, minWidth: 360, display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "0 14px" },
  searchInput: { width: "100%", height: 52, border: "none", outline: "none", background: "transparent", fontSize: 14 },
  filterBox: { minWidth: 260, display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "0 14px" },
  select: { width: "100%", height: 52, border: "none", outline: "none", background: "transparent", fontSize: 14 },
  tableCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20, boxShadow: "0 10px 30px rgba(15,23,42,.04)" },
  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  tableTitle: { fontSize: 20, fontWeight: 900, color: "#0f172a" },
  tableSub: { marginTop: 4, color: "#64748b", fontSize: 13 },
  tableHint: { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", padding: "8px 12px", fontSize: 12, fontWeight: 800 },
  emptyState: { padding: 24, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 18, border: "1px dashed #cbd5e1" },
  tableWrap: { overflow: "auto", borderRadius: 18, border: "1px solid #e2e8f0" },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff" },
  th: { textAlign: "left", padding: 14, fontSize: 13, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" },
  td: { padding: 14, borderBottom: "1px solid #eef2f7", verticalAlign: "top" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  editBtn: { border: "none", borderRadius: 12, padding: "8px 12px", background: "#dbeafe", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  deleteBtn: { border: "none", borderRadius: 12, padding: "8px 12px", background: "#fee2e2", color: "#b91c1c", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 800 },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 14, padding: "12px 16px", background: "#e2e8f0", color: "#0f172a", cursor: "pointer", fontWeight: 800 },
  statusPublished: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 800 },
  statusDraft: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 800 },
};
