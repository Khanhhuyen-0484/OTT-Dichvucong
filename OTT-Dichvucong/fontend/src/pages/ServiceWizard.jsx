import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getApiErrorMessage,
  getServiceById,
  submitServiceApplication,
  presignAttachmentUpload,
  generatePaymentQr,
  verifyPaymentStatus,
  mockPaymentComplete
} from "../lib/api";

// Import QR code images
import momo1 from "../assets/payment-qrs/momo_a1.jpg";
import momo2 from "../assets/payment-qrs/momo_a2.jpg";
import momo3 from "../assets/payment-qrs/momo_a3.jpg";
import zalopay1 from "../assets/payment-qrs/zalopay_b1.jpg";
import zalopay2 from "../assets/payment-qrs/zalopayb2.jpg";
import zalopay3 from "../assets/payment-qrs/zalopay_b3.jpg";

export default function ServiceWizard() {
  const { serviceId } = useParams();

  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitResult, setSubmitResult] = useState(null);
  const [err, setErr] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    citizenId: "",
    address: "",
    ward: "",
    district: "",
    city: "",
    requestContent: ""
  });

  const [errors, setErrors] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("VNPay");
  const [attachments, setAttachments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Payment states
  const [qrCode, setQrCode] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [paymentPolling, setPaymentPolling] = useState(false);
  const pollIntervalRef = useRef(null);

  // Map payment method to QR images
  const getQRImage = useCallback(() => {
    let serviceIndex = 1; // Default to 1
    
    // Try to determine service index from serviceId
    if (serviceId === "1") serviceIndex = 1;
    else if (serviceId === "2") serviceIndex = 2;
    else if (serviceId === "3") serviceIndex = 3;
    // For other IDs, try to extract number or use modulo
    else {
      const match = serviceId.match(/\d+/);
      if (match) {
        serviceIndex = ((parseInt(match[0]) - 1) % 3) + 1;
      }
    }

    // Map payment method to QR code
    if (paymentMethod === "MoMo") {
      if (serviceIndex === 1) return momo1;
      if (serviceIndex === 2) return momo2;
      return momo3; // default to 3
    } else if (paymentMethod === "ZaloPay" || paymentMethod === "ChuyenKhoan") {
      if (serviceIndex === 1) return zalopay1;
      if (serviceIndex === 2) return zalopay2;
      return zalopay3; // default to 3
    } else {
      // Default to zalopay for other methods
      if (serviceIndex === 1) return zalopay1;
      if (serviceIndex === 2) return zalopay2;
      return zalopay3;
    }
  }, [serviceId, paymentMethod]);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await getServiceById(serviceId);
        setService(data);
      } catch (e) {
        setErr(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [serviceId]);

  function validateField(name, value) {
    if (name === "fullName" && !value.trim()) return "Họ tên là bắt buộc";
    if (name === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Email không đúng định dạng";
    }
    if (name === "phone" && !/^\d{10}$/.test(value)) {
      return "Số điện thoại phải đủ 10 số";
    }
    if (name === "citizenId" && !/^\d{9,12}$/.test(value)) {
      return "CCCD/CMND phải từ 9 đến 12 số";
    }
    if (name === "address" && !value.trim()) return "Địa chỉ là bắt buộc";
    if (name === "requestContent" && !value.trim()) return "Nội dung yêu cầu là bắt buộc";
    return "";
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name, value)
    }));
  }

  function validateStep2() {
    const requiredFields = [
      "fullName",
      "phone",
      "citizenId",
      "address",
      "requestContent"
    ];

    const nextErrors = {};
    requiredFields.forEach((key) => {
      const msg = validateField(key, formData[key] || "");
      if (msg) nextErrors[key] = msg;
    });

    if (formData.email) {
      const emailError = validateField("email", formData.email);
      if (emailError) nextErrors.email = emailError;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleFileChange(docKey, file) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);

    setAttachments((prev) => ({
      ...prev,
      [docKey]: {
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl,
        file  // Store the File object for later upload
      }
    }));
  }

  function validateStep3() {
    if (!service) return false;
    const missing = service.documents.filter(
      (doc) => doc.required && !attachments[doc.key]
    );
    if (missing.length > 0) {
      alert("Bạn chưa tải đủ giấy tờ bắt buộc.");
      return false;
    }
    return true;
  }

  async function handleSubmitApplication() {
    try {
      setSubmitting(true);
      // Upload all files to S3 first
      const uploadedAttachments = {};
      
      for (const [docKey, attachmentData] of Object.entries(attachments)) {
        if (!attachmentData.file) continue;
        
        try {
          // Get presigned URL from backend
          const presignRes = await presignAttachmentUpload({
            fileName: attachmentData.name,
            contentType: attachmentData.type,
            applicationId: "new",
            docKey: docKey
          });

          const { uploadUrl, publicUrl } = presignRes.data;

          // Upload file directly to S3
          await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": attachmentData.type },
            body: attachmentData.file
          });

          // Store the public URL instead of blob URL
          uploadedAttachments[docKey] = {
            name: attachmentData.name,
            size: attachmentData.size,
            type: attachmentData.type,
            previewUrl: publicUrl  // Use S3 public URL
          };
        } catch (uploadErr) {
          console.error(`Failed to upload ${docKey}:`, uploadErr);
          alert(`Lỗi upload tệp ${docKey}. Vui lòng thử lại.`);
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        serviceId: service.id,
        formData,
        paymentMethod,
        attachments: Object.entries(uploadedAttachments).map(([key, value]) => ({
          key,
          ...value
        }))
      };

      const { data } = await submitServiceApplication(payload);
      setSubmitResult(data);
      
      // Move to payment step with application code
      await generateQRCode(data.applicationCode);
      setStep(5);
    } catch (e) {
      const message = getApiErrorMessage(e);
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function generateQRCode(applicationCode) {
    try {
      // Use static QR image based on payment method
      const qrImage = getQRImage();
      setQrCode(qrImage);
      setPaymentStatus("pending");

      // Set expiry time to 60 minutes from now
      const expireTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      setPaymentExpireAt(expireTime);

      // Start polling for payment status
      startPaymentPolling(applicationCode);
    } catch (err) {
      console.error("generateQRCode error:", err);
      alert(getApiErrorMessage(err));
    }
  }

  function startPaymentPolling(applicationCode) {
    setPaymentPolling(true);
    
    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await verifyPaymentStatus(applicationCode);
        const { paymentStatus: status } = statusRes.data;

        setPaymentStatus(status);

        if (status === "completed") {
          // Payment successful
          clearInterval(pollIntervalRef.current);
          setPaymentPolling(false);
          setStep(6);
        } else if (status === "expired") {
          // Payment expired
          clearInterval(pollIntervalRef.current);
          setPaymentPolling(false);
          alert("Hết thời gian thanh toán. Vui lòng nộp hồ sơ mới.");
          setStep(1);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  }

  function stopPaymentPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setPaymentPolling(false);
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPaymentPolling();
    };
  }, []);

  function handleMockPaymentComplete() {
    if (!submitResult?.applicationCode) return;
    try {
      mockPaymentComplete(submitResult.applicationCode);
      setPaymentStatus("completed");
      stopPaymentPolling();
      setTimeout(() => {
        setStep(6);
      }, 500);
    } catch (err) {
      alert("Lỗi: " + getApiErrorMessage(err));
    }
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      // Upload all files to S3 first
      const uploadedAttachments = {};
      
      for (const [docKey, attachmentData] of Object.entries(attachments)) {
        if (!attachmentData.file) continue;
        
        try {
          // Get presigned URL from backend
          const presignRes = await presignAttachmentUpload({
            fileName: attachmentData.name,
            contentType: attachmentData.type,
            applicationId: "new",
            docKey: docKey
          });

          const { uploadUrl, publicUrl } = presignRes.data;

          // Upload file directly to S3
          await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": attachmentData.type },
            body: attachmentData.file
          });

          // Store the public URL instead of blob URL
          uploadedAttachments[docKey] = {
            name: attachmentData.name,
            size: attachmentData.size,
            type: attachmentData.type,
            previewUrl: publicUrl  // Use S3 public URL
          };
        } catch (uploadErr) {
          console.error(`Failed to upload ${docKey}:`, uploadErr);
          alert(`Lỗi upload tệp ${docKey}. Vui lòng thử lại.`);
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        serviceId: service.id,
        formData,
        paymentMethod,
        attachments: Object.entries(uploadedAttachments).map(([key, value]) => ({
          key,
          ...value
        }))
      };

      const { data } = await submitServiceApplication(payload);
      setSubmitResult(data);
      setStep(5);
    } catch (e) {
      const message = getApiErrorMessage(e);
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  const feeText = useMemo(() => {
    if (!service) return "";
    return new Intl.NumberFormat("vi-VN").format(service.fee) + " VNĐ";
  }, [service]);

  if (loading) {
    return <div style={styles.page}>Đang tải dữ liệu dịch vụ...</div>;
  }

  if (err) {
    return <div style={styles.page}>Lỗi: {err}</div>;
  }

  if (!service) {
    return <div style={styles.page}>Không có dữ liệu dịch vụ</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <Link to="/" style={styles.link}>Trang chủ</Link>
          <span style={{ color: "#94a3b8" }}> / </span>
          <Link to="/services" style={styles.link}>Dịch vụ</Link>
          <span style={{ color: "#94a3b8" }}> / </span>
          <span>{service.name}</span>
        </div>

        <h1 style={styles.title}>{service.name}</h1>
        <div style={styles.stepText}>Bước {step <= 5 ? step : 5} / 5</div>

        {step === 1 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Bước 1: Chọn dịch vụ & xem điều kiện</h2>
            <p><strong>Thời gian giải quyết:</strong> {service.processingTime}</p>
            <p><strong>Lệ phí:</strong> {feeText}</p>
            <p><strong>Mô tả:</strong> {service.description}</p>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Giấy tờ cần chuẩn bị:</div>
              <ul style={{ paddingLeft: 20 }}>
                {service.documents.map((doc) => (
                  <li key={doc.key} style={{ marginBottom: 6 }}>
                    {doc.label} {doc.required && <span style={{ color: "red" }}>*</span>}
                  </li>
                ))}
              </ul>
            </div>

            <button style={styles.primaryBtn} onClick={() => setStep(2)}>
              Bắt đầu nộp hồ sơ
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Bước 2: Kê khai Form (E-Form)</h2>

            <h3 style={styles.groupTitle}>Thông tin cá nhân</h3>
            <div style={styles.grid2}>
              <InputField label="Họ tên" name="fullName" value={formData.fullName} onChange={handleChange} error={errors.fullName} />
              <InputField label="Email" name="email" value={formData.email} onChange={handleChange} error={errors.email} />
              <InputField label="Số điện thoại" name="phone" value={formData.phone} onChange={handleChange} error={errors.phone} />
              <InputField label="CCCD/CMND" name="citizenId" value={formData.citizenId} onChange={handleChange} error={errors.citizenId} />
            </div>

            <h3 style={styles.groupTitle}>Thông tin cư trú</h3>
            <div style={styles.grid2}>
              <InputField label="Địa chỉ" name="address" value={formData.address} onChange={handleChange} error={errors.address} />
              <InputField label="Phường/Xã" name="ward" value={formData.ward} onChange={handleChange} error={errors.ward} />
              <InputField label="Quận/Huyện" name="district" value={formData.district} onChange={handleChange} error={errors.district} />
              <InputField label="Tỉnh/Thành phố" name="city" value={formData.city} onChange={handleChange} error={errors.city} />
            </div>

            <h3 style={styles.groupTitle}>Nội dung yêu cầu</h3>
            <textarea
              name="requestContent"
              value={formData.requestContent}
              onChange={handleChange}
              rows={4}
              style={{
                ...styles.textarea,
                borderColor: errors.requestContent ? "red" : "#cbd5e1",
                background: errors.requestContent ? "#fef2f2" : "#fff"
              }}
            />
            {errors.requestContent && (
              <div style={styles.errorText}>{errors.requestContent}</div>
            )}

            <div style={styles.btnRow}>
              <button style={styles.secondaryBtn} onClick={() => setStep(1)}>
                Quay lại
              </button>
              <button
                style={styles.primaryBtn}
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
              >
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Bước 3: Đính kèm tài liệu</h2>

            {service.documents.map((doc) => (
              <div key={doc.key} style={styles.uploadBox}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  {doc.label} {doc.required && <span style={{ color: "red" }}>*</span>}
                </div>

                <input
                  type="file"
                  onChange={(e) => handleFileChange(doc.key, e.target.files?.[0])}
                />

                {attachments[doc.key] && (
                  <div style={{ marginTop: 12 }}>
                    <div><strong>Tệp:</strong> {attachments[doc.key].name}</div>
                    <div><strong>Loại:</strong> {attachments[doc.key].type || "Không xác định"}</div>

                    {attachments[doc.key].type?.startsWith("image/") && (
                      <img
                        src={attachments[doc.key].previewUrl}
                        alt="preview"
                        style={styles.previewImage}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            <div style={styles.btnRow}>
              <button style={styles.secondaryBtn} onClick={() => setStep(2)}>
                Quay lại
              </button>
              <button
                style={styles.primaryBtn}
                onClick={() => {
                  if (validateStep3()) setStep(4);
                }}
              >
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Bước 4: Thanh toán & Gửi hồ sơ</h2>

            <p><strong>Tổng tiền:</strong> {feeText}</p>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontWeight: 700 }}>Phương thức thanh toán</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={styles.select}
              >
                <option value="ZaloPay">ZaloPay</option>
                <option value="MoMo">MoMo</option>
                <option value="ChuyenKhoan">Chuyển khoản</option>
                <option value="TienMat">Tiền mặt tại quầy</option>
              </select>
            </div>

            <div style={styles.btnRow}>
              <button style={styles.secondaryBtn} onClick={() => setStep(3)} disabled={submitting}>
                Quay lại
              </button>
              <button style={styles.successBtn} onClick={handleSubmitApplication} disabled={submitting}>
                {submitting ? "Đang xử lý..." : "Tiến hành thanh toán"}
              </button>
            </div>
          </div>
        )}

        {step === 5 && qrCode && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Bước 5: Quét mã QR để thanh toán</h2>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <p style={{ marginBottom: 12, fontSize: 14, color: "#666" }}>
                <strong>Phương thức thanh toán:</strong> {paymentMethod}
              </p>
              <p style={{ marginBottom: 16, fontSize: 16 }}>
                <strong>Quét mã QR bằng ứng dụng thanh toán:</strong>
              </p>
              <img src={qrCode} alt="Payment QR Code" style={{ maxWidth: 300, margin: "0 auto" }} />
              <p style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
                {paymentMethod === "MoMo" && "Sử dụng ứng dụng MoMo để quét mã"}
                {paymentMethod === "ZaloPay" && "Sử dụng ứng dụng ZaloPay để quét mã"}
                {paymentMethod === "ChuyenKhoan" && "Sử dụng ứng dụng ngân hàng để quét mã"}
              </p>

              {paymentExpireAt && (
                <p style={{ marginTop: 12, color: "#d84e31", fontSize: 14 }}>
                  <strong>Hạn thanh toán:</strong> {new Date(paymentExpireAt).toLocaleString("vi-VN")}
                </p>
              )}

              {paymentStatus === "pending" && (
                <p style={{ marginTop: 12, color: "#666", fontSize: 14 }}>
                  ⏳ Đang chờ thanh toán...
                </p>
              )}
            </div>

            <div style={styles.btnRow}>
              <Link 
                to="/" 
                onClick={() => stopPaymentPolling()}
                style={{...styles.secondaryBtn, textDecoration: "none", display: "inline-block", textAlign: "center", borderRadius: 12, border: "none", cursor: "pointer", flex: 1}}
              >
                Quay về trang chủ
              </Link>
              <button 
                style={styles.primaryBtn} 
                onClick={handleMockPaymentComplete}
              >
                Thanh toán
              </button>
            </div>
          </div>
        )}

        {step === 6 && submitResult && (
          <div style={styles.successBox}>
            <h2 style={{ marginBottom: 12 }}>✅ Thanh toán thành công</h2>
            <p>
              <strong>Mã số hồ sơ:</strong> {submitResult.applicationCode}
            </p>
            <p style={{ marginTop: 8 }}>
              Mã này dùng để tra cứu hoặc chat 1v1 với cán bộ sau này.
            </p>
            <p style={{ marginTop: 12, fontSize: 14, color: "#666" }}>
              Hồ sơ của bạn đã được ghi nhận. Cán bộ sẽ xử lý trong thời gian quy định.
            </p>

            <div style={{ marginTop: 16 }}>
              <Link to="/services" style={styles.linkBtn}>
                Quay về danh sách dịch vụ
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({ label, name, value, onChange, error }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        style={{
          ...styles.input,
          borderColor: error ? "red" : "#cbd5e1",
          background: error ? "#fef2f2" : "#fff"
        }}
      />
      {error && <div style={styles.errorText}>{error}</div>}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px 16px"
  },
  container: {
    maxWidth: 1000,
    margin: "0 auto"
  },
  topBar: {
    marginBottom: 16,
    color: "#475569"
  },
  link: {
    color: "#1d4ed8",
    textDecoration: "none"
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    marginBottom: 8
  },
  stepText: {
    color: "#475569",
    marginBottom: 20
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    border: "1px solid #e2e8f0"
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 16
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 20,
    marginBottom: 12
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: 6
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    outline: "none",
    boxSizing: "border-box"
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    outline: "none",
    boxSizing: "border-box"
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginTop: 6
  },
  btnRow: {
    display: "flex",
    gap: 12,
    marginTop: 24
  },
  primaryBtn: {
    padding: "12px 18px",
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700
  },
  secondaryBtn: {
    padding: "12px 18px",
    background: "#cbd5e1",
    color: "#0f172a",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700
  },
  successBtn: {
    padding: "12px 18px",
    background: "#15803d",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700
  },
  uploadBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  previewImage: {
    marginTop: 12,
    width: 160,
    height: 120,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid #cbd5e1"
  },
  select: {
    width: "100%",
    maxWidth: 320,
    marginTop: 8,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1"
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    padding: 24
  },
  linkBtn: {
    display: "inline-block",
    background: "#1d4ed8",
    color: "#fff",
    textDecoration: "none",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 700
  }
};