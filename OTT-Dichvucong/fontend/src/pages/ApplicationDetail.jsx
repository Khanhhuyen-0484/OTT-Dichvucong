import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import { 
  getApiErrorMessage, 
  getApplicationDetail,
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

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN");
}

export default function ApplicationDetail() {
  const { applicationCode } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentExpireAt, setPaymentExpireAt] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data } = await getApplicationDetail(applicationCode);
        setItem(data);
      } catch (e) {
        setErr(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [applicationCode]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPaymentPolling();
    };
  }, []);

  // Get QR image based on payment method and service
  const getQRImage = useCallback(() => {
    let serviceIndex = 1; // Default to 1
    
    if (!item) return zalopay1;

    // Try to determine service index from service data
    // Assuming service 1 = Đổi giấy phép lái xe, service 2 = Đk tạm trú, service 3 = Cấp lại giấy khai sinh
    // Or based on service name patterns
    const serviceName = (item.serviceName || "").toLowerCase();
    if (serviceName.includes("đổi") || serviceName.includes("lái xe")) {
      serviceIndex = 1;
    } else if (serviceName.includes("tạm trú") || serviceName.includes("đk")) {
      serviceIndex = 2;
    } else if (serviceName.includes("khai sinh")) {
      serviceIndex = 3;
    }

    // Map payment method to QR code
    const paymentMethod = item.paymentMethod || "VNPay";
    
    if (paymentMethod === "MoMo") {
      if (serviceIndex === 2) return momo2;
      if (serviceIndex === 3) return momo3;
      return momo1; // default to 1
    } else if (paymentMethod === "ZaloPay" || paymentMethod === "ChuyenKhoan") {
      if (serviceIndex === 2) return zalopay2;
      if (serviceIndex === 3) return zalopay3;
      return zalopay1; // default to 1
    } else {
      // Default to zalopay for other methods
      if (serviceIndex === 2) return zalopay2;
      if (serviceIndex === 3) return zalopay3;
      return zalopay1;
    }
  }, [item]);

  async function handlePaymentClick() {
    setShowPaymentModal(true);
    setGeneratingQr(true);
    try {
      // Use static QR image based on payment method
      const qrImage = getQRImage();
      setQrCode(qrImage);
      setPaymentStatus("pending");

      // Set expiry time to 60 minutes from now if not already set
      if (!item.paymentExpireAt) {
        const expireTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        setPaymentExpireAt(expireTime);
      } else {
        setPaymentExpireAt(item.paymentExpireAt);
      }

      // Start polling for payment status
      startPaymentPolling();
    } catch (err) {
      alert(getApiErrorMessage(err));
    } finally {
      setGeneratingQr(false);
    }
  }

  function startPaymentPolling() {
    setPaymentLoading(true);
    
    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await verifyPaymentStatus(applicationCode);
        const { paymentStatus: status } = statusRes.data;

        setPaymentStatus(status);

        if (status === "completed") {
          // Payment successful
          clearInterval(pollIntervalRef.current);
          setPaymentLoading(false);
          // Reload application data
          const { data } = await getApplicationDetail(applicationCode);
          setItem(data);
          setTimeout(() => {
            setShowPaymentModal(false);
          }, 1000);
        } else if (status === "expired") {
          // Payment expired
          clearInterval(pollIntervalRef.current);
          setPaymentLoading(false);
          alert("Hết thời gian thanh toán (60 phút). Vui lòng nộp hồ sơ mới.");
          setShowPaymentModal(false);
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
      setPaymentLoading(false);
    }
  }

  function handleClosePaymentModal() {
    stopPaymentPolling();
    setShowPaymentModal(false);
    setQrCode(null);
  }

  function handleMockPaymentComplete() {
    mockPaymentComplete(applicationCode);
    setPaymentStatus("completed");
    stopPaymentPolling();
    // Reload data
    getApplicationDetail(applicationCode).then(({ data }) => {
      setItem(data);
      setTimeout(() => {
        setShowPaymentModal(false);
      }, 1000);
    });
  }

  return (
    <div className="min-h-screen">
      <GovHeader />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/my-applications"
            className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--gov-navy)] ring-1 ring-slate-200 hover:ring-slate-300"
          >
            ← Quay lại danh sách
          </Link>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            Đang tải chi tiết hồ sơ...
          </div>
        )}

        {!loading && err && (
          <div className="mt-6 rounded-2xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}

        {!loading && !err && item && (
          <>
            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h1 className="text-2xl font-black text-slate-900">
                Chi tiết hồ sơ
              </h1>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <strong>Mã hồ sơ:</strong> {item.applicationCode}
                </div>
                <div>
                  <strong>Dịch vụ:</strong> {item.serviceName}
                </div>
                <div>
                  <strong>Trạng thái:</strong> {item.status}
                </div>
                <div>
                  <strong>Ngày nộp:</strong> {formatDate(item.createdAt)}
                </div>
                <div>
                  <strong>Lệ phí:</strong>{" "}
                  {new Intl.NumberFormat("vi-VN").format(item.fee || 0)} VNĐ
                </div>
                <div>
                  <strong>Phương thức thanh toán:</strong>{" "}
                  {item.paymentMethod || "—"}
                </div>
              </div>

              {item.paymentStatus === "pending" && (
                <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    ⚠️ <strong>Hồ sơ chưa thanh toán.</strong> Vui lòng hoàn tất thanh toán để tiếp tục xử lý.
                  </p>
                  <button
                    onClick={handlePaymentClick}
                    className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                  >
                    💳 Thanh toán ngay
                  </button>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">
                Thông tin kê khai
              </h2>

              <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <strong>Họ tên:</strong> {item.formData?.fullName || "—"}
                </div>
                <div>
                  <strong>Email:</strong> {item.formData?.email || "—"}
                </div>
                <div>
                  <strong>Số điện thoại:</strong> {item.formData?.phone || "—"}
                </div>
                <div>
                  <strong>CCCD/CMND:</strong> {item.formData?.citizenId || "—"}
                </div>
                <div className="sm:col-span-2">
                  <strong>Địa chỉ:</strong> {item.formData?.address || "—"}
                </div>
                <div>
                  <strong>Phường/Xã:</strong> {item.formData?.ward || "—"}
                </div>
                <div>
                  <strong>Quận/Huyện:</strong> {item.formData?.district || "—"}
                </div>
                <div>
                  <strong>Tỉnh/Thành phố:</strong> {item.formData?.city || "—"}
                </div>
                <div className="sm:col-span-2">
                  <strong>Nội dung yêu cầu:</strong>{" "}
                  {item.formData?.requestContent || "—"}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-slate-900">
                Tài liệu đính kèm
              </h2>

              {!item.attachments || item.attachments.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">
                  Chưa có tài liệu đính kèm.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {item.attachments.map((file, idx) => (
                    <div
                      key={`${file.key}-${idx}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="font-bold text-slate-900">
                        {file.key || "Tài liệu"}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        <div>
                          <strong>Tên tệp:</strong> {file.name || "—"}
                        </div>
                        <div>
                          <strong>Loại:</strong> {file.type || "—"}
                        </div>
                        <div>
                          <strong>Kích thước:</strong>{" "}
                          {file.size ? `${Math.round(file.size / 1024)} KB` : "—"}
                        </div>
                      </div>

                      {file.previewUrl && file.type?.startsWith("image/") && (
                        <div className="mt-3">
                          <img
                            src={file.previewUrl}
                            alt={file.name || "preview"}
                            className="h-36 w-full rounded-lg border object-cover"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              console.error("Lỗi load ảnh:", file.previewUrl);
                              e.target.alt = "Không thể tải ảnh";
                            }}
                          />
                        </div>
                      )}
                      
                      {file.previewUrl && !file.type?.startsWith("image/") && (
                        <div className="mt-3">
                          <a
                            href={file.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100"
                          >
                            Tải tệp
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-black text-slate-900 mb-4">Thanh toán hồ sơ</h2>

            {generatingQr ? (
              <div className="text-center py-8">
                <p className="text-slate-600">Đang tạo mã QR...</p>
              </div>
            ) : qrCode ? (
              <div>
                <div className="bg-slate-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-slate-600 mb-3 text-center">
                    <strong>Quét mã QR để thanh toán</strong>
                  </p>
                  <img src={qrCode} alt="Payment QR Code" className="w-full" />
                  {paymentExpireAt && (
                    <p className="text-xs text-red-600 mt-3 text-center">
                      Hết hạn: {new Date(paymentExpireAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>

                <p className="text-sm text-slate-600 text-center mb-4">
                  {paymentStatus === "pending" && "⏳ Đang chờ thanh toán..."}
                  {paymentStatus === "completed" && "✅ Thanh toán thành công!"}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleClosePaymentModal}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-900 font-semibold hover:bg-slate-300"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={handleMockPaymentComplete}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 text-sm"
                  >
                    Thanh toán
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-red-600 mb-4">Không thể tạo mã QR</p>
                <button
                  onClick={handleClosePaymentModal}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-900 font-semibold"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}