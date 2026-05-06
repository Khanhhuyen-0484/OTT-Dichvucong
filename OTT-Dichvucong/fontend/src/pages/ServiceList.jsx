import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage, getServices } from "../lib/api";

export default function ServiceList() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await getServices();
        setServices(data.services || []);
      } catch (e) {
        setErr(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div style={styles.page}>Đang tải danh sách dịch vụ...</div>;
  }

  if (err) {
    return <div style={styles.page}>Lỗi: {err}</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Danh sách dịch vụ công</h1>
        <p style={styles.desc}>
          Chọn một dịch vụ để xem điều kiện và nộp hồ sơ trực tuyến.
        </p>

        <div style={styles.grid}>
          {services.map((service) => (
            <Link
              key={service.id}
              to={`/services/${service.id}`}
              style={styles.card}
            >
              <h3 style={styles.cardTitle}>{service.name}</h3>
              <p style={styles.cardText}>
                <strong>Thời gian giải quyết:</strong> {service.processingTime}
              </p>
              <p style={styles.cardText}>
                <strong>Lệ phí:</strong>{" "}
                {new Intl.NumberFormat("vi-VN").format(service.fee)} VNĐ
              </p>
              <p style={styles.cardText}>{service.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "32px 16px"
  },
  container: {
    maxWidth: 1000,
    margin: "0 auto"
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    marginBottom: 8
  },
  desc: {
    color: "#475569",
    marginBottom: 24
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e2e8f0",
    textDecoration: "none",
    color: "#0f172a"
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12
  },
  cardText: {
    marginBottom: 8,
    lineHeight: 1.5
  }
};