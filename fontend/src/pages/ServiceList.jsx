import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage, getServices } from "../lib/api";
import { Search, SlidersHorizontal, FileText, Clock3, CircleDollarSign } from "lucide-react";

export default function ServiceList() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await getServices({ q: query, category: category === "all" ? "" : category });
        setServices(data.services || []);
      } catch (e) {
        setErr(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [query, category]);

  const categories = useMemo(() => {
    const list = services.map((s) => s.categoryName || s.category || "Khác").filter(Boolean);
    return ["all", ...new Set(list)];
  }, [services]);

  if (loading) return <div style={styles.page}>Đang tải danh sách dịch vụ...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroBadge}>Trang dịch vụ công</div>
          <h1 style={styles.title}>Danh sách dịch vụ công</h1>
          <p style={styles.desc}>Tìm kiếm, lọc và mở chi tiết từng dịch vụ để xem quy trình, giấy tờ và nộp hồ sơ online.</p>

          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={18} color="#64748b" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên dịch vụ, mô tả..." style={styles.searchInput} />
            </div>
            <div style={styles.filterBox}>
              <SlidersHorizontal size={18} color="#64748b" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.select}>
                {categories.map((c) => <option key={c} value={c}>{c === "all" ? "Tất cả danh mục" : c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {err ? <div style={styles.note}>Đang hiển thị dữ liệu từ backend thật.</div> : null}

        {services.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText size={36} color="#94a3b8" />
            <div style={{ marginTop: 12, fontWeight: 700 }}>Không tìm thấy dịch vụ phù hợp</div>
          </div>
        ) : (
          <div style={styles.grid}>
            {services.map((service) => {
              const id = service.serviceId || service.id;
              return (
                <Link key={id} to={`/services/${id}`} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.cardTag}>{service.categoryName || service.category || "Dịch vụ"}</div>
                    <div style={styles.cardMeta}>
                      <span style={styles.metaItem}><Clock3 size={14} /> {service.processingTime || "Đang cập nhật"}</span>
                      <span style={styles.metaItem}><CircleDollarSign size={14} /> {new Intl.NumberFormat("vi-VN").format(service.fee || 0)} VNĐ</span>
                    </div>
                  </div>
                  <h3 style={styles.cardTitle}>{service.name}</h3>
                  <p style={styles.cardText}>{service.description || "Chưa có mô tả"}</p>
                  <div style={styles.actionRow}><span style={styles.actionText}>Xem chi tiết & nộp hồ sơ</span><span style={styles.actionBtn}>Mở dịch vụ</span></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = { page:{minHeight:"100vh",background:"linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)",padding:"32px 16px"}, container:{maxWidth:1200,margin:"0 auto"}, hero:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:24,padding:24,boxShadow:"0 10px 30px rgba(15, 23, 42, 0.05)",marginBottom:20}, heroBadge:{display:"inline-flex",alignItems:"center",borderRadius:999,padding:"6px 12px",background:"#eff6ff",color:"#1d4ed8",fontSize:12,fontWeight:800,marginBottom:12}, title:{fontSize:32,fontWeight:900,marginBottom:8,color:"#0f172a"}, desc:{color:"#475569",marginBottom:20,maxWidth:760,lineHeight:1.6}, toolbar:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:12}, searchBox:{display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:16,padding:"0 14px"}, filterBox:{display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:16,padding:"0 14px"}, searchInput:{width:"100%",height:52,border:"none",outline:"none",background:"transparent",fontSize:14}, select:{width:"100%",height:52,border:"none",outline:"none",background:"transparent",fontSize:14,color:"#0f172a"}, grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:16}, card:{background:"#fff",borderRadius:20,padding:20,border:"1px solid #e2e8f0",textDecoration:"none",color:"#0f172a",boxShadow:"0 8px 24px rgba(15, 23, 42, 0.04)"}, cardTop:{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:14,flexWrap:"wrap"}, cardTag:{display:"inline-flex",padding:"6px 10px",borderRadius:999,background:"#eff6ff",color:"#1d4ed8",fontSize:12,fontWeight:800}, cardMeta:{display:"flex",flexDirection:"column",gap:6,color:"#64748b",fontSize:12}, metaItem:{display:"inline-flex",alignItems:"center",gap:6}, cardTitle:{fontSize:20,fontWeight:800,marginBottom:10,color:"#0f172a"}, cardText:{marginBottom:16,lineHeight:1.6,color:"#475569"}, actionRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,borderTop:"1px solid #e2e8f0",paddingTop:14}, actionText:{fontSize:13,color:"#64748b",fontWeight:600}, actionBtn:{fontSize:13,fontWeight:800,color:"#1d4ed8"}, emptyState:{background:"#fff",border:"1px dashed #cbd5e1",borderRadius:20,padding:40,textAlign:"center",color:"#0f172a"}, note:{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",padding:14,borderRadius:16,marginBottom:16,fontWeight:700} };
