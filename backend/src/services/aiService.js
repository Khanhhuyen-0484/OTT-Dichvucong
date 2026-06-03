const { listServices } = require("../store/serviceCatalogStore");
const { listCategories } = require("../store/serviceCategoryStore");
const { findByUserId } = require("../store/serviceApplicationStore");
const { getAiRules } = require("../store/adminStore");

const AI_ASSISTANT_ID = "AI_ASSISTANT";
const AI_ASSISTANT_NAME = "Trợ lý AI";
const OPEN_STAFF_PHRASES = [
  "toi muon gap can bo",
  "toi can gap can bo",
  "gap can bo",
  "chat voi can bo",
  "can bo ho tro",
  "nhan vien ho tro",
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function wantsStaff(text) {
  const normalized = normalizeText(text);
  return OPEN_STAFF_PHRASES.some((phrase) => normalized.includes(phrase));
}

function compact(value, max = 600) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function buildContext({ userId, message }) {
  const [services, categories, dossiers, rulesText] = await Promise.all([
    listServices().catch(() => []),
    listCategories().catch(() => []),
    userId ? findByUserId(userId).catch(() => []) : Promise.resolve([]),
    getAiRules().catch(() => ""),
  ]);

  const serviceLines = services.slice(0, 12).map((service) => {
    const name = service.name || service.title || service.serviceName || service.id;
    const category = service.categoryName || service.categoryId || "";
    const fee = service.fee != null ? `, lệ phí: ${service.fee}` : "";
    return `- ${compact(name, 120)}${category ? ` (${compact(category, 80)})` : ""}${fee}`;
  });

  const categoryLines = categories.slice(0, 10).map((category) => (
    `- ${compact(category.name || category.title || category.id, 120)}`
  ));

  const dossierLines = dossiers.slice(0, 8).map((dossier) => {
    const code = dossier.applicationCode || dossier.dossierId || dossier.id || "";
    const serviceName = dossier.serviceName || dossier.serviceId || "Hồ sơ";
    const status = dossier.status || dossier.applicationStatus || "Chưa rõ";
    const paymentStatus = dossier.paymentStatus || dossier.payment?.status || "";
    return `- ${compact(serviceName, 120)}${code ? ` (${code})` : ""}: trạng thái ${status}${paymentStatus ? `, thanh toán ${paymentStatus}` : ""}`;
  });

  return {
    rulesText,
    contextText: [
      rulesText ? `Knowledge Base/Admin rules:\n${rulesText}` : "",
      serviceLines.length ? `Dịch vụ công đang có:\n${serviceLines.join("\n")}` : "",
      categoryLines.length ? `Nhóm dịch vụ:\n${categoryLines.join("\n")}` : "",
      dossierLines.length ? `Hồ sơ của người dùng:\n${dossierLines.join("\n")}` : "",
      `Câu hỏi hiện tại: ${compact(message, 1000)}`,
    ].filter(Boolean).join("\n\n"),
  };
}

function buildSystemPrompt(contextText) {
  return `Bạn là trợ lý AI cho hệ thống dịch vụ công trực tuyến.
Nhiệm vụ:
- Hướng dẫn thủ tục hành chính
- Giải thích hồ sơ cần chuẩn bị
- Hướng dẫn thanh toán
- Giải thích trạng thái hồ sơ
- Hướng dẫn người dân sử dụng hệ thống
- Trả lời bằng tiếng Việt lịch sự, ngắn gọn

Ưu tiên dùng dữ liệu dịch vụ công, hồ sơ người dùng và Knowledge Base nếu có.
Nếu không đủ dữ liệu, hãy nói rõ thông tin chỉ mang tính hướng dẫn và đề nghị người dân chat với cán bộ hỗ trợ.

Dữ liệu tham khảo:
${contextText || "Không có dữ liệu tham khảo."}`;
}

const FALLBACK_KB = [
  {
    label: "đăng ký khai sinh",
    keywords: ["khai sinh", "giay khai sinh", "dang ky khai sinh", "tre moi sinh"],
    documents: ["Giấy chứng sinh hoặc giấy tờ thay thế hợp lệ.", "CCCD/căn cước của cha, mẹ hoặc người đi đăng ký.", "Thông tin cư trú và giấy tờ liên quan theo yêu cầu nơi tiếp nhận."],
    steps: ["Chọn thủ tục đăng ký khai sinh.", "Điền thông tin trẻ, cha mẹ và cơ quan tiếp nhận.", "Tải giấy tờ rõ nét rồi gửi hồ sơ.", "Theo dõi trạng thái và bổ sung nếu được yêu cầu."],
    authority: "Thường tiếp nhận tại UBND cấp xã nơi cư trú của cha hoặc mẹ.",
    timeline: "Thời gian xử lý phụ thuộc địa phương và tình trạng hồ sơ.",
    fee: "Một số trường hợp đăng ký đúng hạn có thể được miễn lệ phí; hãy kiểm tra biểu phí tại nơi tiếp nhận.",
    tips: ["Kiểm tra kỹ họ tên, ngày sinh, quê quán.", "Ảnh/scan giấy tờ cần rõ nét, đủ trang."]
  },
  {
    label: "đăng ký kết hôn",
    keywords: ["ket hon", "dang ky ket hon", "giay ket hon"],
    documents: ["CCCD/căn cước hoặc giấy tờ tùy thân của hai bên.", "Thông tin cư trú của hai bên.", "Giấy xác nhận tình trạng hôn nhân nếu thuộc trường hợp phải nộp.", "Giấy tờ bổ sung nếu có yếu tố nước ngoài hoặc đã từng kết hôn."],
    steps: ["Chọn thủ tục đăng ký kết hôn và cơ quan tiếp nhận.", "Khai thông tin hai bên.", "Tải giấy tờ chứng minh tình trạng hôn nhân nếu có.", "Gửi hồ sơ và theo dõi lịch hẹn/xác minh."],
    authority: "Thường tiếp nhận tại UBND cấp xã có thẩm quyền theo nơi cư trú của một trong hai bên.",
    timeline: "Hồ sơ hợp lệ thường xử lý nhanh; trường hợp cần xác minh có thể lâu hơn.",
    fee: "Lệ phí có thể khác nhau theo địa phương và trường hợp cụ thể.",
    tips: ["Thông tin nhân thân phải thống nhất với giấy tờ tùy thân.", "Trường hợp có yếu tố nước ngoài nên kiểm tra yêu cầu dịch thuật/hợp pháp hóa trước."]
  },
  {
    label: "đăng ký tạm trú",
    keywords: ["tam tru", "dang ky tam tru", "luu tru", "cu tru"],
    documents: ["CCCD/căn cước hoặc giấy tờ định danh.", "Thông tin nơi ở tạm trú.", "Giấy tờ chứng minh chỗ ở hợp pháp hoặc xác nhận của chủ chỗ ở nếu được yêu cầu.", "Tờ khai/thông tin cư trú theo mẫu."],
    steps: ["Chọn thủ tục đăng ký tạm trú.", "Khai thông tin cá nhân, địa chỉ tạm trú và chủ chỗ ở.", "Tải giấy tờ chứng minh chỗ ở.", "Gửi hồ sơ và theo dõi trạng thái."],
    authority: "Thường do cơ quan công an hoặc cơ quan quản lý cư trú tại địa phương tiếp nhận.",
    timeline: "Thời gian xử lý phụ thuộc địa phương và độ đầy đủ của hồ sơ.",
    fee: "Lệ phí nếu có sẽ hiển thị ở bước thanh toán hoặc theo biểu phí địa phương.",
    tips: ["Địa chỉ tạm trú cần khai đúng thực tế.", "Chuẩn bị số điện thoại để cơ quan tiếp nhận liên hệ khi cần."]
  },
  {
    label: "cấp phép xây dựng",
    keywords: ["xay dung", "giay phep xay dung", "cap phep xay dung", "sua nha"],
    documents: ["Đơn đề nghị cấp giấy phép xây dựng.", "Giấy tờ về quyền sử dụng đất/quyền sở hữu công trình.", "Bản vẽ thiết kế xây dựng.", "Tài liệu thẩm duyệt/cam kết kỹ thuật nếu thuộc trường hợp phải có."],
    steps: ["Chọn thủ tục cấp phép xây dựng phù hợp.", "Khai thông tin chủ đầu tư, địa điểm và quy mô.", "Tải bản vẽ và giấy tờ pháp lý.", "Theo dõi thẩm định và bổ sung nếu được yêu cầu."],
    authority: "Thường do UBND cấp huyện, Sở Xây dựng hoặc cơ quan được phân cấp tiếp nhận tùy loại công trình.",
    timeline: "Thời gian xử lý phụ thuộc loại công trình và yêu cầu thẩm định.",
    fee: "Lệ phí do địa phương quy định và được thông báo khi tiếp nhận/thanh toán.",
    tips: ["Bản vẽ cần rõ ràng, đúng tỷ lệ.", "Nên kiểm tra quy hoạch trước khi nộp."]
  },
  {
    label: "đăng ký biến động đất đai",
    keywords: ["dat dai", "bien dong dat dai", "sang ten", "so do", "quyen su dung dat"],
    documents: ["Đơn đăng ký biến động đất đai.", "Giấy chứng nhận quyền sử dụng đất/quyền sở hữu tài sản.", "Hợp đồng hoặc văn bản làm căn cứ biến động.", "Giấy tờ tùy thân và chứng từ nghĩa vụ tài chính nếu có."],
    steps: ["Chọn thủ tục biến động đất đai phù hợp.", "Khai thông tin thửa đất, chủ sử dụng và nội dung biến động.", "Tải giấy chứng nhận và giấy tờ pháp lý.", "Theo dõi nghĩa vụ tài chính và nhận kết quả."],
    authority: "Thường do Văn phòng đăng ký đất đai/chi nhánh hoặc bộ phận một cửa có thẩm quyền tiếp nhận.",
    timeline: "Thời gian xử lý phụ thuộc loại biến động, hồ sơ pháp lý và nghĩa vụ tài chính.",
    fee: "Có thể phát sinh phí, lệ phí và nghĩa vụ tài chính theo từng hồ sơ.",
    tips: ["Thông tin thửa đất phải khớp giấy chứng nhận.", "Scan đủ trang hợp đồng/văn bản làm căn cứ biến động."]
  },
  {
    label: "đổi hoặc cấp lại giấy phép lái xe",
    keywords: ["gplx", "lai xe", "giay phep lai xe", "doi bang lai", "cap lai bang lai"],
    documents: ["CCCD/căn cước hoặc giấy tờ tùy thân.", "GPLX cũ hoặc thông tin giấy phép lái xe.", "Ảnh chân dung theo yêu cầu.", "Giấy khám sức khỏe nếu thủ tục yêu cầu."],
    steps: ["Chọn thủ tục đổi/cấp lại GPLX.", "Khai thông tin GPLX và hạng giấy phép.", "Tải ảnh, giấy tờ tùy thân và giấy tờ y tế nếu có.", "Thanh toán lệ phí và theo dõi xử lý."],
    authority: "Thường do cơ quan giao thông vận tải hoặc đơn vị được ủy quyền tiếp nhận.",
    timeline: "Thời gian xử lý tùy loại thủ tục và địa phương.",
    fee: "Lệ phí đổi/cấp lại hiển thị trong bước thanh toán hoặc theo biểu phí cơ quan tiếp nhận.",
    tips: ["Kiểm tra đúng hạng và thời hạn GPLX.", "Ảnh chân dung cần rõ nét, đúng chuẩn."]
  },
  {
    label: "đăng ký doanh nghiệp",
    keywords: ["dang ky doanh nghiep", "thanh lap cong ty", "ho kinh doanh", "doanh nghiep"],
    documents: ["Giấy đề nghị đăng ký doanh nghiệp/hộ kinh doanh.", "Điều lệ công ty nếu thành lập doanh nghiệp.", "Danh sách thành viên/cổ đông nếu loại hình yêu cầu.", "Giấy tờ pháp lý của cá nhân/tổ chức góp vốn hoặc chủ hộ."],
    steps: ["Chọn loại hình đăng ký.", "Khai tên, địa chỉ, ngành nghề, vốn và người đại diện.", "Tải hồ sơ pháp lý và ký/xác nhận theo yêu cầu.", "Theo dõi trạng thái và nhận giấy chứng nhận."],
    authority: "Thường do Phòng Đăng ký kinh doanh hoặc cơ quan đăng ký kinh doanh cấp huyện tiếp nhận tùy loại hình.",
    timeline: "Thời gian xử lý phụ thuộc loại hình và tính hợp lệ của hồ sơ.",
    fee: "Có thể phát sinh lệ phí đăng ký và phí công bố thông tin.",
    tips: ["Kiểm tra tên để tránh trùng/gây nhầm lẫn.", "Ngành nghề cần chọn đúng mã và phạm vi hoạt động."]
  },
  {
    label: "cấp hộ chiếu",
    keywords: ["ho chieu", "passport", "xuat nhap canh"],
    documents: ["CCCD/căn cước hoặc giấy tờ tùy thân.", "Ảnh chân dung đúng chuẩn.", "Hộ chiếu cũ nếu cấp lại/đổi.", "Giấy tờ bổ sung cho trẻ em hoặc trường hợp đặc biệt nếu được yêu cầu."],
    steps: ["Chọn thủ tục cấp mới/cấp lại hộ chiếu.", "Khai thông tin nhân thân và nơi nhận kết quả.", "Tải ảnh và giấy tờ.", "Thanh toán lệ phí, theo dõi lịch hẹn và nhận kết quả."],
    authority: "Thường do cơ quan quản lý xuất nhập cảnh tiếp nhận và xử lý.",
    timeline: "Thời gian xử lý tùy trường hợp và nơi tiếp nhận.",
    fee: "Lệ phí cấp hộ chiếu hiển thị theo thủ tục hoặc thông báo của cơ quan tiếp nhận.",
    tips: ["Ảnh hộ chiếu cần đúng chuẩn.", "Kiểm tra kỹ họ tên, ngày sinh, số giấy tờ."]
  },
  {
    label: "CCCD/căn cước công dân",
    keywords: ["cccd", "can cuoc", "can cuoc cong dan", "cmnd", "chung minh thu"],
    documents: ["Giấy tờ tùy thân hiện có nếu cấp đổi/cấp lại.", "Thông tin cư trú.", "Giấy tờ chứng minh nội dung cần điều chỉnh nếu thay đổi thông tin."],
    steps: ["Xác định làm lần đầu, cấp đổi hay cấp lại.", "Chuẩn bị giấy tờ theo trường hợp.", "Đặt lịch/nộp theo kênh tiếp nhận địa phương.", "Theo dõi lịch hẹn và nhận kết quả."],
    authority: "Thường do cơ quan công an có thẩm quyền tiếp nhận và xử lý.",
    timeline: "Thời gian xử lý phụ thuộc địa phương và tình trạng hồ sơ.",
    fee: "Lệ phí có thể thay đổi theo trường hợp cấp mới, cấp đổi hoặc cấp lại.",
    tips: ["Thông tin cá nhân cần khớp dữ liệu cư trú.", "Nếu thay đổi thông tin, chuẩn bị giấy tờ chứng minh."]
  },
  {
    label: "phiếu lý lịch tư pháp",
    keywords: ["ly lich tu phap", "phieu ly lich tu phap", "tu phap"],
    documents: ["CCCD/căn cước hoặc giấy tờ tùy thân.", "Thông tin cư trú.", "Giấy ủy quyền nếu nộp thay, trừ trường hợp được miễn.", "Tài liệu bổ sung theo yêu cầu của Sở Tư pháp nếu có."],
    steps: ["Chọn thủ tục cấp phiếu lý lịch tư pháp.", "Khai thông tin cá nhân, quá trình cư trú và mục đích cấp phiếu.", "Tải giấy tờ tùy thân/ủy quyền nếu có.", "Thanh toán lệ phí và theo dõi kết quả."],
    authority: "Thường do Sở Tư pháp hoặc cơ quan được phân quyền tiếp nhận.",
    timeline: "Thời gian xử lý phụ thuộc việc xác minh thông tin.",
    fee: "Lệ phí theo biểu phí hiện hành, có thể có trường hợp miễn/giảm.",
    tips: ["Khai rõ quá trình cư trú.", "Nếu nộp thay, kiểm tra yêu cầu giấy ủy quyền."]
  },
];

function detectKbTopic(message) {
  const text = normalizeText(message);
  return FALLBACK_KB.find((topic) => topic.keywords.some((keyword) => text.includes(keyword)));
}

function detectKbIntent(message) {
  const text = normalizeText(message);
  if (/giay to|ho so|chuan bi|can gi|mang gi|file|tai len|dinh kem/.test(text)) return "documents";
  if (/cac buoc|quy trinh|thu tuc|lam the nao|huong dan|nop ho so/.test(text)) return "steps";
  if (/nop o dau|co quan|noi tiep nhan|ubnd|so nao|phong nao/.test(text)) return "authority";
  if (/bao lau|thoi gian|may ngay|han xu ly|khi nao/.test(text)) return "timeline";
  if (/phi|le phi|bao nhieu tien|gia|thanh toan/.test(text)) return "fee";
  if (/luu y|can luu|meo|sai|loi|bi tra/.test(text)) return "tips";
  return "steps";
}

function bullet(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildKbReply(topic, intent) {
  if (!topic) return "";
  if (intent === "documents") return `Hồ sơ ${topic.label} thường cần:\n${bullet(topic.documents)}\n\nBạn nên kiểm tra lại danh mục giấy tờ trên màn hình chi tiết dịch vụ vì từng địa phương có thể yêu cầu bổ sung khác nhau.`;
  if (intent === "tips") return `Một số lưu ý khi làm ${topic.label}:\n${bullet(topic.tips)}`;
  if (intent === "steps") return `Quy trình ${topic.label} có thể thực hiện như sau:\n${bullet(topic.steps)}\n\nBạn có thể hỏi tiếp về giấy tờ cần chuẩn bị, nơi tiếp nhận, thời gian xử lý hoặc lệ phí.`;
  return topic[intent] || "";
}

function mockReply(message, contextText = "") {
  const text = normalizeText(message);
  if (wantsStaff(message)) {
    return "Bạn có thể chat trực tiếp với cán bộ hỗ trợ.";
  }
  const kbTopic = detectKbTopic(message);
  if (kbTopic) {
    const kbReply = buildKbReply(kbTopic, detectKbIntent(message));
    if (kbReply) return kbReply;
  }
  if (/quen mat khau|reset pass|doi mat khau|mat khau/.test(text)) {
    return "Nếu quên mật khẩu, bạn chọn Quên mật khẩu ở màn hình đăng nhập, nhập email đã đăng ký để nhận mã OTP, sau đó nhập OTP cùng mật khẩu mới. Nếu không nhận được email, hãy kiểm tra hộp thư rác hoặc liên hệ cán bộ hỗ trợ.";
  }
  if (/dang nhap|dang ky|tai khoan/.test(text)) {
    return "Bạn cần đăng nhập để nộp hồ sơ, thanh toán, tra cứu hồ sơ cá nhân và dùng hỗ trợ trực tuyến. Nếu chưa có tài khoản, hãy đăng ký bằng họ tên, email/số điện thoại và mật khẩu hợp lệ.";
  }
  if (/luu nhap|ban nhap|draft/.test(text)) {
    return "Khi bấm Lưu nháp, hệ thống lưu lại dữ liệu ở bước hiện tại của hồ sơ. Bạn có thể quay lại mục Hồ sơ đã nộp/Hồ sơ của tôi để tiếp tục hoàn thiện từ bước đã dừng.";
  }
  if (/bo sung|yeu cau bo sung|thieu giay to/.test(text)) {
    return "Nếu hồ sơ ở trạng thái Yêu cầu bổ sung, hãy mở chi tiết hồ sơ để xem ghi chú của cán bộ, tải đúng tài liệu còn thiếu rồi gửi bổ sung. Sau khi gửi, trạng thái sẽ chuyển sang đã bổ sung hoặc chờ tiếp nhận lại tùy quy trình.";
  }
  if (/tra cuu|ma ho so|ho so cua toi|theo doi/.test(text)) {
    return "Bạn có thể tra cứu hồ sơ bằng mã hồ sơ hoặc vào mục Hồ sơ đã nộp/Hồ sơ của tôi sau khi đăng nhập. Trang chi tiết sẽ hiển thị trạng thái xử lý, ghi chú bổ sung, thanh toán và lịch sử cập nhật.";
  }
  if (/upload|tai file|file loi|dinh kem|pdf|anh/.test(text)) {
    return "Khi tải giấy tờ lên, nên dùng file PDF/JPG/PNG rõ nét, đủ trang, dung lượng không quá lớn và tên file dễ nhận biết. Nếu file lỗi, hãy thử đổi định dạng, giảm dung lượng hoặc chụp/scan lại rõ hơn.";
  }
  if (/thanh toan|le phi|phi|qr|chuyen khoan/.test(text)) {
    return "Bạn có thể thanh toán lệ phí trong bước thanh toán của hồ sơ. Hãy kiểm tra mã hồ sơ, số tiền, nội dung chuyển khoản hoặc mã QR trước khi xác nhận. Nếu đã thanh toán nhưng hệ thống chưa cập nhật, bạn nên chờ vài phút hoặc chat với cán bộ hỗ trợ.";
  }
  if (/ho so.*(o dau|dang o dau|trang thai)|trang thai|xu ly/.test(text)) {
    return "Bạn có thể xem trạng thái hồ sơ trong mục hồ sơ của tôi hoặc tra cứu bằng mã hồ sơ. Nếu trạng thái là cần bổ sung, hãy mở chi tiết hồ sơ để xem ghi chú và tải tài liệu bổ sung.";
  }
  if (/giay to|ho so|chuan bi|can gi/.test(text)) {
    return "Bạn cần chọn đúng thủ tục để xem danh sách giấy tờ. Thông thường hồ sơ gồm giấy tờ tùy thân, biểu mẫu theo thủ tục và tài liệu chứng minh liên quan. Nếu bạn cho biết tên thủ tục cụ thể, tôi sẽ hướng dẫn sát hơn.";
  }
  if (/dang ky|nop ho so|thu tuc|dich vu/.test(text)) {
    return "Bạn có thể vào danh sách dịch vụ công, chọn thủ tục cần làm, đọc hướng dẫn, điền thông tin, tải giấy tờ lên và gửi hồ sơ. Sau khi gửi, hãy theo dõi trạng thái xử lý trong mục hồ sơ của tôi.";
  }
  return contextText
    ? "Tôi đã ghi nhận câu hỏi của bạn. Bạn vui lòng nêu rõ tên thủ tục hoặc mã hồ sơ để tôi hướng dẫn chính xác hơn. Nếu cần xử lý trường hợp cụ thể, bạn có thể chat trực tiếp với cán bộ hỗ trợ."
    : "Trợ lý AI hiện đang dùng chế độ mô phỏng vì chưa cấu hình OPENAI_API_KEY. Bạn có thể hỏi về thủ tục, hồ sơ, thanh toán hoặc trạng thái hồ sơ.";
}

async function callOpenAi({ messages, contextText }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: buildSystemPrompt(contextText) },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 300) || `OpenAI HTTP ${response.status}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || "").trim() || null;
}

function buildAiMessage(text, meta = {}) {
  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId: AI_ASSISTANT_ID,
    senderType: "AI",
    senderName: AI_ASSISTANT_NAME,
    messageType: "text",
    text,
    createdAt: nowIso(),
    meta,
  };
}

async function generateAiReply({ userId = "", message = "", messages = [] }) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return {
      reply: "Bạn vui lòng nhập nội dung cần hỗ trợ.",
      mode: "validation",
      action: "",
    };
  }

  if (wantsStaff(trimmed)) {
    return {
      reply: "Bạn có thể chat trực tiếp với cán bộ hỗ trợ.",
      mode: "handoff",
      action: "OPEN_STAFF_CHAT",
    };
  }

  const { contextText } = await buildContext({ userId, message: trimmed });
  const chatMessages = (Array.isArray(messages) ? messages : [])
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .slice(-10)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));

  if (!chatMessages.length || chatMessages[chatMessages.length - 1]?.role !== "user") {
    chatMessages.push({ role: "user", content: trimmed });
  }

  try {
    const openAiReply = await callOpenAi({ messages: chatMessages, contextText });
    if (openAiReply) {
      return { reply: openAiReply, mode: "openai", action: "" };
    }
  } catch (error) {
    console.error("[aiService] OpenAI error:", error.message);
  }

  return {
    reply: mockReply(trimmed, contextText),
    mode: process.env.OPENAI_API_KEY ? "fallback" : "mock",
    action: "",
  };
}

module.exports = {
  AI_ASSISTANT_ID,
  AI_ASSISTANT_NAME,
  buildAiMessage,
  generateAiReply,
  wantsStaff,
};
