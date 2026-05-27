import React, { useState } from "react";
import { trackApplication, getApplicationByCode, getApiErrorMessage } from "../lib/api";
import { Search, FileClock, BadgeCheck, BellRing, Clock3 } from "lucide-react";

export default function TrackApplication() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onTrack = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await trackApplication(code.trim());
      setResult(res.data);
    } catch (e1) {
      try {
        const res = await getApplicationByCode(code.trim());
        setResult(res.data);
      } catch (e2) {
        setError(getApiErrorMessage(e2));
        setResult(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.badge}><FileClock size={14} /> Tra cứu hồ sơ</div>
          <h1 style={styles.title}>Theo dõi hồ sơ theo mã thật</h1>
          <p style={styles.desc}>Nhập mã hồ sơ để xem trạng thái xử lý, thanh toán và lịch sử cập nhật.</p>
          <form onSubmit={onTrack} style={styles.form}>
            <div style={styles.searchBox}>
              <Search size={18} color="#64748b" />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: HS-20260508-ABC123" style={styles.input} />
            </div>
            <button type="submit" disabled={loading} style={styles.button}>{loading ? "Đang tra cứu..." : "Tra cứu"}</button>
          </form>
          {error ? <div style={styles.error}>{error}</div> : null}
        </div>

        {result ? (
          <div style={styles.resultGrid}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Thông tin hồ sơ</h2>
              <InfoRow label="Mã hồ sơ" value={result.application?.applicationCode || code} />
              <InfoRow label="Dịch vụ" value={result.application?.serviceName || result.application?.serviceId || "-"} />
              <InfoRow label="Trạng thái" value={result.application?.status || "-"} />
              <InfoRow label="Thanh toán" value={result.application?.paymentStatus || "-"} />
              <InfoRow label="Phí" value={new Intl.NumberFormat("vi-VN").format(result.application?.fee || 0) + " VNĐ"} />
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Tiến trình xử lý</h2>
              {(result.timeline || []).length ? (result.timeline || []).map((item, idx) => (
                <div key={idx} style={styles.timelineItem}>
                  <div style={styles.timelineDot}>{idx + 1}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.status || item.note || "Cập nhật"}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{item.at ? new Date(item.at).toLocaleString("vi-VN") : ""}</div>
                  </div>
                </div>
              )) : <div style={{ color: "#64748b" }}>Chưa có tiến trình.</div>}
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Thanh toán / Thông báo</h2>
              <div style={styles.stack}>
                {(result.payments || []).map((p) => (
                  <div key={p.paymentId || p.transactionId} style={styles.subCard}>
                    <div style={{ fontWeight: 800 }}>{p.paymentMethod || "-"}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{p.transactionId || p.paymentId}</div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>{new Intl.NumberFormat("vi-VN").format(p.amount || 0)} VNĐ</div>
                  </div>
                ))}
                {(result.notifications || []).map((n) => (
                  <div key={n.notificationId} style={styles.subCard}>
                    <div style={{ fontWeight: 800 }}>{n.title || "Thông báo"}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{n.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return <div style={styles.infoRow}><span style={styles.infoLabel}>{label}</span><span style={styles.infoValue}>{value}</span></div>;
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%)", padding: 24 },
  container: { maxWidth: 1100, margin: "0 auto" },
  hero: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 30px rgba(15,23,42,.05)", marginBottom: 16 },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 },
  title: { margin: "12px 0 8px", fontSize: 32, fontWeight: 900, color: "#0f172a" },
  desc: { margin: 0, color: "#475569" },
  form: { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginTop: 16 },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: "0 14px" },
  input: { width: "100%", height: 52, border: "none", outline: "none", background: "transparent", fontSize: 14 },
  button: { border: "none", borderRadius: 16, padding: "0 18px", background: "#1d4ed8", color: "#fff", fontWeight: 800, cursor: "pointer" },
  error: { marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12, borderRadius: 14, fontWeight: 700 },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 20, boxShadow: "0 8px 24px rgba(15,23,42,.04)" },
  cardTitle: { marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 900, color: "#0f172a" },
  infoRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #eef2f7" },
  infoLabel: { color: "#64748b", fontWeight: 700 },
  infoValue: { color: "#0f172a", fontWeight: 800, textAlign: "right" },
  timelineItem: { display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  timelineDot: { width: 26, height: 26, borderRadius: 999, background: "#1d4ed8", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stack: { display: "grid", gap: 12 },
  subCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14 }
};
