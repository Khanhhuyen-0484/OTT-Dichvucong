const fs = require("fs");
const path = require("path");
const {
  create,
  findByCode,
  findByUserId,
  readAll
} = require("../store/serviceApplicationStore");

const servicesPath = path.join(__dirname, "../../data/services.json");

function readServices() {
  try {
    if (!fs.existsSync(servicesPath)) return [];
    const raw = fs.readFileSync(servicesPath, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("readServices error:", err);
    return [];
  }
}

function generateApplicationCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HS-${y}${m}${d}-${rand}`;
}

function validateForm(formData) {
  const errors = {};

  if (!formData?.fullName?.trim()) {
    errors.fullName = "Họ tên là bắt buộc";
  }

  if (!/^\d{10}$/.test(formData?.phone || "")) {
    errors.phone = "Số điện thoại phải đủ 10 số";
  }

  if (formData?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = "Email không đúng định dạng";
  }

  if (!/^\d{9,12}$/.test(formData?.citizenId || "")) {
    errors.citizenId = "CCCD/CMND phải từ 9 đến 12 số";
  }

  if (!formData?.address?.trim()) {
    errors.address = "Địa chỉ là bắt buộc";
  }

  if (!formData?.requestContent?.trim()) {
    errors.requestContent = "Nội dung yêu cầu là bắt buộc";
  }

  return errors;
}

function getRequestUserId(req) {
  return (
    req.user?.id ||
    req.user?._id ||
    req.user?.userId ||
    req.user?.email ||
    req.user?.sub ||
    req.user?.username ||
    null
  );
}

exports.getServices = (req, res) => {
  const services = readServices();
  return res.json({ services });
};

exports.getServiceById = (req, res) => {
  const { serviceId } = req.params;
  const services = readServices();
  const service = services.find((s) => s.id === serviceId);

  if (!service) {
    return res.status(404).json({ message: "Không tìm thấy dịch vụ" });
  }

  return res.json(service);
};

exports.submitApplication = (req, res) => {
  try {
    const { serviceId, formData, paymentMethod, attachments } = req.body;

    if (!serviceId) {
      return res.status(400).json({ message: "Thiếu serviceId" });
    }

    const services = readServices();
    const service = services.find((s) => s.id === serviceId);

    if (!service) {
      return res.status(404).json({ message: "Dịch vụ không tồn tại" });
    }

    const errors = validateForm(formData || {});
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Dữ liệu kê khai chưa hợp lệ",
        errors
      });
    }

    const requiredDocs = service.documents.filter((d) => d.required).map((d) => d.key);
    const uploadedKeys = Array.isArray(attachments)
      ? attachments.map((item) => item.key)
      : [];

    const missingDocs = requiredDocs.filter((key) => !uploadedKeys.includes(key));
    if (missingDocs.length > 0) {
      return res.status(400).json({
        message: "Thiếu giấy tờ bắt buộc",
        missingDocs
      });
    }

    const applicationCode = generateApplicationCode();
    const userId = getRequestUserId(req);

    const newApplication = {
      id: Date.now().toString(),
      userId,
      applicationCode,
      serviceId,
      serviceName: service.name,
      formData,
      paymentMethod: paymentMethod || "VNPay",
      attachments: attachments || [],
      fee: service.fee,
      status: "Chưa thanh toán",
      paymentStatus: "pending",
      paymentAmount: service.fee,
      paymentExpireAt: null,
      paymentCompletedAt: null,
      createdAt: new Date().toISOString()
    };

    create(newApplication);

    return res.status(201).json({
      message: "Nộp hồ sơ thành công. Vui lòng thanh toán phí dịch vụ.",
      applicationCode,
      application: newApplication
    });
  } catch (err) {
    console.error("submitApplication error:", err);
    return res.status(500).json({ message: "Lỗi server khi nộp hồ sơ" });
  }
};

exports.getApplicationByCode = (req, res) => {
  try {
    const { applicationCode } = req.params;
    const application = findByCode(applicationCode);

    if (!application) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    return res.json(application);
  } catch (err) {
    console.error("getApplicationByCode error:", err);
    return res.status(500).json({ message: "Lỗi server khi tra cứu hồ sơ" });
  }
};

exports.getMyApplications = (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const all = readAll().sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (!userId) {
      return res.json({
        applications: all,
        note: "Chưa xác định được user từ token, đang hiển thị toàn bộ hồ sơ để demo."
      });
    }

    const items = all.filter((item) => item.userId === userId);

    if (items.length === 0) {
      return res.json({
        applications: all,
        note: "Chưa có hồ sơ nào gắn userId hiện tại, đang hiển thị toàn bộ hồ sơ để demo."
      });
    }

    return res.json({ applications: items });
  } catch (err) {
    console.error("getMyApplications error:", err);
    return res.status(500).json({ message: "Lỗi server khi lấy lịch sử hồ sơ" });
  }
};