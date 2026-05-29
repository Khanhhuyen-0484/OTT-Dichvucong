import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Banknote,
  Baby,
  Bell,
  BookOpenCheck,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  FolderKanban,
  Handshake,
  Headphones,
  HeartHandshake,
  Landmark,
  MessageCircle,
  Newspaper,
  Radio,
  Search,
  SendHorizonal,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import GovHeader from "../components/GovHeader.jsx";
import HomeChatSection from "../components/HomeChatSection.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getServices } from "../lib/api";

const fallbackServices = [
  {
    id: "demo-ho-tich",
    icon: Baby,
    name: "Đăng ký khai sinh",
    description: "Nộp hồ sơ khai sinh trực tuyến, theo dõi trạng thái và nhận thông báo xử lý.",
    processingTime: "03 ngày làm việc",
    categoryName: "Hộ tịch",
  },
  {
    id: "demo-ket-hon",
    icon: HeartHandshake,
    name: "Đăng ký kết hôn",
    description: "Chuẩn bị biểu mẫu, giấy tờ nhân thân và đặt lịch tiếp nhận hồ sơ.",
    processingTime: "03 ngày làm việc",
    categoryName: "Hộ tịch",
  },
  {
    id: "demo-xay-dung",
    icon: Building2,
    name: "Cấp phép xây dựng",
    description: "Tra cứu điều kiện, tải bản vẽ và nộp hồ sơ cấp phép xây dựng online.",
    processingTime: "07 ngày làm việc",
    categoryName: "Xây dựng",
  },
  {
    id: "demo-dat-dai",
    icon: FolderKanban,
    name: "Đăng ký biến động đất đai",
    description: "Nộp giấy chứng nhận, đơn đăng ký biến động và theo dõi tiến độ xử lý.",
    processingTime: "05 ngày làm việc",
    categoryName: "Đất đai",
  },
  {
    id: "demo-gplx",
    icon: CarFront,
    name: "Đổi giấy phép lái xe",
    description: "Kê khai thông tin, tải giấy phép cũ và nhận mã tra cứu sau khi nộp.",
    processingTime: "04 ngày làm việc",
    categoryName: "Giao thông",
  },
  {
    id: "demo-doanh-nghiep",
    icon: BriefcaseBusiness,
    name: "Đăng ký doanh nghiệp",
    description: "Quản lý biểu mẫu thành lập doanh nghiệp, điều lệ và danh sách thành viên.",
    processingTime: "03-05 ngày làm việc",
    categoryName: "Doanh nghiệp",
  },
];

const stats = [
  { label: "Tổng dịch vụ công", value: "1.240+", icon: ClipboardList, tone: "text-blue-700 bg-blue-50" },
  { label: "Hồ sơ đã xử lý", value: "86.500+", icon: FileCheck2, tone: "text-emerald-700 bg-emerald-50" },
  { label: "Người dân sử dụng", value: "42.000+", icon: UsersRound, tone: "text-cyan-700 bg-cyan-50" },
  { label: "Tỷ lệ hài lòng", value: "96,2%", icon: Handshake, tone: "text-amber-700 bg-amber-50" },
];

const smartSupportItems = [
  { title: "AI hỗ trợ thủ tục", desc: "Giải đáp và hướng dẫn hồ sơ", icon: Bot },
  { title: "Chat trực tiếp cán bộ", desc: "Realtime hỗ trợ xử lý", icon: MessageCircle },
  { title: "Tra cứu hồ sơ realtime", desc: "Cập nhật trạng thái tức thì", icon: FileText },
  { title: "Thanh toán trực tuyến", desc: "VietQR & SePay", icon: WalletCards },
  { title: "Thông báo tự động", desc: "SMS, Email, realtime", icon: Bell },
];

const smartActivities = [
  "Hồ sơ HS-20260525 đã tiếp nhận",
  "Thanh toán xác nhận thành công",
  "AI đang hỗ trợ trực tuyến",
];

const processSteps = [
  { title: "Chọn dịch vụ", desc: "Tìm kiếm thủ tục theo từ khóa, nhóm dịch vụ hoặc cơ quan xử lý.", icon: Search },
  { title: "Nộp hồ sơ trực tuyến", desc: "Điền biểu mẫu, tải giấy tờ và kiểm tra thành phần hồ sơ bắt buộc.", icon: FileText },
  { title: "Thanh toán lệ phí", desc: "Thanh toán qua VietQR hoặc các kênh được hệ thống hỗ trợ.", icon: Banknote },
  { title: "Theo dõi và nhận kết quả", desc: "Nhận mã hồ sơ, tra cứu tiến độ và tải kết quả khi hoàn tất.", icon: ClipboardCheck },
];

const supportItems = [
  { title: "Chat với AI", desc: "Giải đáp thủ tục phổ biến 24/7.", icon: Bot, path: "/chat" },
  { title: "Chat với cán bộ", desc: "Kết nối trực tiếp với bộ phận hỗ trợ.", icon: Headphones, path: "/chat?tab=staff" },
  { title: "Hướng dẫn nộp hồ sơ", desc: "Xem quy trình, giấy tờ và lưu ý trước khi nộp.", icon: ShieldCheck, path: "/services" },
  { title: "Câu hỏi thường gặp", desc: "Tra cứu nhanh các vướng mắc thường gặp.", icon: CircleHelp, path: "/chat" },
];

const announcements = [
  { title: "Hệ thống hỗ trợ thanh toán VietQR", date: "28/05/2026", icon: Banknote },
  { title: "Dịch vụ công hoạt động 24/7", date: "27/05/2026", icon: Clock3 },
  { title: "Hỗ trợ AI giải đáp thủ tục hành chính", date: "26/05/2026", icon: Sparkles },
];

const iconPool = [Baby, HeartHandshake, Building2, FolderKanban, CarFront, BriefcaseBusiness, Landmark, FileText];

const newsItems = [
  {
    title: "Đẩy mạnh chuyển đổi số trong dịch vụ công trực tuyến",
    category: "Chuyển đổi số",
    date: "26/05/2026",
    description: "Nâng cao trải nghiệm người dân và minh bạch hóa quy trình xử lý hồ sơ hành chính.",
    icon: Sparkles,
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Triển khai thanh toán lệ phí qua VietQR và SePay",
    category: "Thông báo",
    date: "25/05/2026",
    description: "Người dân có thể thanh toán trực tuyến nhanh chóng và tự động xác nhận giao dịch.",
    icon: WalletCards,
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Hệ thống AI hỗ trợ tra cứu thủ tục hành chính",
    category: "AI hỗ trợ",
    date: "24/05/2026",
    description: "Chatbot AI giúp giải đáp và hướng dẫn người dân thực hiện hồ sơ.",
    icon: Bot,
    imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Cải cách hành chính hướng tới phục vụ người dân tốt hơn",
    category: "Cải cách hành chính",
    date: "23/05/2026",
    description: "Rút ngắn thời gian xử lý, chuẩn hóa biểu mẫu và tăng khả năng theo dõi hồ sơ.",
    icon: Landmark,
    imageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Hướng dẫn người dân sử dụng dịch vụ công trực tuyến",
    category: "Hướng dẫn",
    date: "22/05/2026",
    description: "Các bước chuẩn bị tài khoản, giấy tờ, thanh toán và nhận kết quả trực tuyến.",
    icon: BookOpenCheck,
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Chính phủ điện tử tăng cường kết nối dữ liệu liên thông",
    category: "Chính phủ điện tử",
    date: "21/05/2026",
    description: "Dữ liệu hồ sơ được đồng bộ giữa các bộ phận để giảm yêu cầu kê khai lặp lại.",
    icon: Radio,
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
  },
];

const systemNotices = [
  { title: "Hệ thống bảo trì", desc: "Các lịch bảo trì được thông báo trước để người dân chủ động thời gian nộp hồ sơ.", icon: ServerCog },
  { title: "Hỗ trợ trực tuyến 24/7", desc: "Kênh AI luôn sẵn sàng hướng dẫn thủ tục và chuyển tiếp khi cần cán bộ hỗ trợ.", icon: Headphones },
  { title: "Tra cứu hồ sơ realtime", desc: "Mã hồ sơ giúp theo dõi trạng thái tiếp nhận, xử lý, bổ sung và trả kết quả.", icon: Radio },
  { title: "Thanh toán online ổn định", desc: "VietQR và chuyển khoản tự động hỗ trợ xác nhận giao dịch nhanh chóng.", icon: WalletCards },
];

const guideDocs = [
  { title: "PDF hướng dẫn sử dụng cổng dịch vụ công", meta: "Tài liệu PDF giả lập", icon: FileText },
  { title: "Hướng dẫn nộp hồ sơ trực tuyến", meta: "Chuẩn bị giấy tờ và biểu mẫu", icon: ClipboardCheck },
  { title: "Quy trình xử lý hồ sơ hành chính", meta: "Tiếp nhận, kiểm tra, phê duyệt, trả kết quả", icon: BadgeCheck },
  { title: "Hướng dẫn thanh toán lệ phí online", meta: "VietQR, SePay và tra cứu trạng thái thanh toán", icon: WalletCards },
];

function normalizeService(service, index) {
  return {
    id: service.serviceId || service.id || fallbackServices[index]?.id || `service-${index}`,
    icon: iconPool[index % iconPool.length],
    name: service.name || fallbackServices[index]?.name || "Dịch vụ công",
    description: service.description || fallbackServices[index]?.description || "Thông tin thủ tục đang được cập nhật.",
    processingTime: service.processingTime || fallbackServices[index]?.processingTime || "Đang cập nhật",
    categoryName: service.categoryName || service.category || fallbackServices[index]?.categoryName || "Dịch vụ",
  };
}

function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${stat.tone}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-2xl font-black text-slate-950">{stat.value}</div>
          <div className="mt-1 text-sm font-semibold text-slate-500">{stat.label}</div>
        </div>
      </div>
    </div>
  );
}

function PopularServiceCard({ service, onClick }) {
  const Icon = service.icon || FileText;
  return (
    <article className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/10">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#0b4b86] ring-1 ring-blue-100">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{service.categoryName}</span>
      </div>
      <h3 className="mt-5 text-lg font-black leading-snug text-slate-950">{service.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
        <Clock3 className="h-4 w-4 text-blue-700" />
        {service.processingTime}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003366] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#052b53]"
      >
        Xem chi tiết
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function NewsThumb({ item, large = false }) {
  return (
    <div className={`group/thumb relative overflow-hidden rounded-[22px] bg-blue-50 shadow-sm ${large ? "aspect-video" : "h-[90px] w-full sm:w-[120px]"}`}>
      <img
        src={item.imageUrl}
        alt={item.title}
        loading={large ? "eager" : "lazy"}
        className="h-full w-full object-cover transition duration-700 group-hover/thumb:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/10 to-transparent" />
    </div>
  );
}

function NewsMeta({ category, date }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-100">{category}</span>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        {date}
      </span>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [apiServices, setApiServices] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadServices() {
      try {
        const { data } = await getServices();
        const list = Array.isArray(data?.services) ? data.services : [];
        if (active) setApiServices(list.slice(0, 6));
      } catch {
        if (active) setApiServices([]);
      }
    }
    loadServices();
    return () => {
      active = false;
    };
  }, []);

  const popularServices = useMemo(() => {
    if (!apiServices.length) return fallbackServices;
    const normalized = apiServices.map(normalizeService);
    return normalized.length >= 6 ? normalized : [...normalized, ...fallbackServices].slice(0, 6);
  }, [apiServices]);

  const onSubmit = (e) => {
    e.preventDefault();
    const query = q.trim();
    navigate(query ? `/services?q=${encodeURIComponent(query)}` : "/services");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f8fc] text-slate-900">
      <GovHeader />
      <style>{`
        @keyframes smart-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes smart-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-[#001f45] via-[#06477f] to-[#1280bd] pb-16 text-white lg:pb-20">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-300/10 blur-3xl" />
          </div>
          <div className="relative mx-auto flex max-w-7xl items-center px-4 py-10 sm:py-12 lg:min-h-[560px] lg:py-0">
            <div className="grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-bold text-sky-50 ring-1 ring-white/20 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Cổng tiếp nhận hồ sơ trực tuyến
                </div>
                <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  Dịch vụ công trực tuyến
                  <span className="mt-1 block text-sky-100">Nhanh chóng - Minh bạch - Thuận tiện</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/86 sm:text-base">
                  Nộp hồ sơ, thanh toán lệ phí, theo dõi tiến độ và nhận hỗ trợ trực tuyến trên một nền tảng thống nhất.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/services")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#003366] shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-sky-50"
                  >
                    <SendHorizonal className="h-4 w-4" />
                    Nộp hồ sơ ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/track")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/18"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Tra cứu hồ sơ
                  </button>
                </div>

                <form onSubmit={onSubmit} className="mt-6 max-w-[620px]">
                  <div className="rounded-[26px] bg-white p-2.5 shadow-xl shadow-blue-950/18 ring-1 ring-white/30">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-slate-50 px-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500">
                        <Search className="h-5 w-5 shrink-0 text-slate-500" />
                        <input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Tìm dịch vụ: khai sinh, đất đai, giấy phép xây dựng..."
                          className="h-12 w-full min-w-0 bg-transparent px-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                        />
                      </div>
                      <button type="submit" className="rounded-2xl bg-[#003366] px-5 py-3 text-sm font-black text-white transition hover:bg-[#052b53]">
                        Tìm kiếm
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="min-w-0 lg:col-span-5">
                <div className="group relative mx-auto w-full max-w-[430px] transition duration-500 hover:-translate-y-1">
                  <div className="absolute -inset-2 rounded-[38px] bg-cyan-300/20 blur-2xl transition duration-500 group-hover:bg-cyan-300/30 sm:-inset-4" />
                  <div className="relative rounded-[32px] border border-white/25 bg-white/12 p-4 shadow-2xl shadow-blue-950/25 backdrop-blur-xl [animation:smart-float_6s_ease-in-out_infinite]">
                  <div className="rounded-[26px] border border-white/45 bg-white/88 p-5 text-slate-900 shadow-xl backdrop-blur [animation:smart-fade_.55s_ease-out_both]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-black text-[#003366]">Trung tâm hỗ trợ thông minh</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">Hỗ trợ người dân mọi lúc, mọi nơi</div>
                      </div>
                      <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-[#003366] text-white shadow-lg shadow-blue-900/25">
                        <Bot className="h-6 w-6" />
                        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
                      </div>
                    </div>

                    <div className="mt-5 space-y-2.5">
                      {smartSupportItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-slate-100 transition hover:bg-white">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#003366]">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-black text-slate-900">{item.title}</div>
                              <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">{item.desc}</div>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Online
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 rounded-3xl bg-slate-950 p-4 text-white shadow-inner">
                      <div className="mb-3 text-xs font-black uppercase text-white/55">Hoạt động mới</div>
                      <div className="space-y-2">
                        {smartActivities.map((activity) => (
                          <div key={activity} className="flex items-center gap-2 text-xs font-semibold text-white/85">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                            <span>{activity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#003366] px-4 py-2 text-xs font-black text-white shadow-sm">
                      <Clock3 className="h-4 w-4" />
                      Hoạt động 24/7
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:-mt-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
          </div>
        </section>

        <section id="dichvu" className="mx-auto max-w-7xl px-4 py-14">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                Dịch vụ phổ biến
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Thủ tục được sử dụng nhiều</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Ưu tiên các nghiệp vụ người dân và doanh nghiệp thường cần nộp trực tuyến.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/services")}
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Xem tất cả dịch vụ
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popularServices.map((service) => (
              <PopularServiceCard key={service.id} service={service} onClick={() => navigate(`/services/${service.id}`)} />
            ))}
          </div>
        </section>

        <section className="bg-[#f6f9fc] px-4 py-14">
          <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                <Newspaper className="h-3.5 w-3.5" />
                Tin tức & thông báo
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0f2f57]">Cập nhật thông tin dịch vụ công</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Tin mới về chuyển đổi số, chính phủ điện tử, hướng dẫn sử dụng dịch vụ công và thông báo vận hành hệ thống.
              </p>
            </div>
            <button type="button" className="inline-flex w-fit items-center gap-2 rounded-2xl border border-[#e5edf5] bg-white px-4 py-3 text-sm font-black text-[#0f2f57] shadow-sm transition hover:bg-blue-50">
              Xem tất cả
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
            <article className="group rounded-[24px] border border-[#e5edf5] bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10">
              <NewsThumb item={newsItems[0]} large />
              <div className="p-2 pt-5">
                <NewsMeta category={newsItems[0].category} date={newsItems[0].date} />
                <h3 className="mt-4 text-2xl font-black leading-tight text-[#0f2f57]">{newsItems[0].title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{newsItems[0].description}</p>
                <button type="button" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#003366] px-4 py-3 text-sm font-black text-white transition hover:bg-[#052b53]">
                  Xem chi tiết
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </article>

            <div className="grid gap-4">
              {newsItems.slice(1, 5).map((item) => (
                <article key={item.title} className="group flex flex-col gap-4 rounded-[22px] border border-[#e5edf5] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row">
                  <div className="shrink-0 overflow-hidden rounded-[18px]">
                    <NewsThumb item={item} />
                  </div>
                  <div className="min-w-0">
                    <NewsMeta category={item.category} date={item.date} />
                    <h3 className="mt-2 line-clamp-2 text-base font-black leading-snug text-[#0f2f57]">{item.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-12">
            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-950">Thông báo từ hệ thống</h3>
                  <p className="mt-1 text-sm text-slate-500">Các trạng thái vận hành cần người dân lưu ý</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {systemNotices.map((notice) => {
                  const Icon = notice.icon;
                  return (
                    <div key={notice.title} className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#003366] shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-black text-slate-900">{notice.title}</div>
                          <div className="mt-1 text-sm leading-6 text-slate-600">{notice.desc}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-950">Văn bản & Hướng dẫn</h3>
                  <p className="mt-1 text-sm text-slate-500">Tài liệu tham khảo cho người dân và doanh nghiệp</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {guideDocs.map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <button key={doc.title} type="button" className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-100 transition hover:bg-blue-50 hover:ring-blue-100">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#003366] shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-slate-900">{doc.title}</div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">{doc.meta}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight text-slate-950">Quy trình thực hiện</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Bốn bước rõ ràng giúp người dân chuẩn bị hồ sơ, thanh toán và nhận kết quả thuận tiện.</p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#003366] text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-3xl font-black text-blue-100">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-black text-slate-950">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="text-3xl font-black tracking-tight text-slate-950">Hỗ trợ trực tuyến</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Kết nối nhanh đến AI, cán bộ hỗ trợ, hướng dẫn nghiệp vụ và câu hỏi thường gặp.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {supportItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate(item.path.startsWith("/chat") && !user ? "/auth" : item.path)}
                    className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-4 text-lg font-black text-slate-950">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                  <Newspaper className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Thông báo / Tin mới</h2>
                  <p className="mt-1 text-sm text-slate-500">Cập nhật vận hành hệ thống</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {announcements.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#003366]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">{item.title}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{item.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => navigate(user ? "/my-applications" : "/auth")}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#003366] px-4 py-3 text-sm font-black text-white transition hover:bg-[#052b53]"
              >
                <UserRoundCheck className="h-4 w-4" />
                {user ? "Xem hồ sơ đã nộp" : "Đăng nhập để quản lý hồ sơ"}
              </button>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[34px] bg-gradient-to-br from-[#003366] via-[#0b4b86] to-[#1280bd] p-8 text-white shadow-2xl shadow-blue-950/15 md:p-10">
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-black ring-1 ring-white/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  Sẵn sàng phục vụ người dân và doanh nghiệp
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Bắt đầu sử dụng dịch vụ công trực tuyến ngay hôm nay</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">
                  Chọn thủ tục cần thực hiện, nộp hồ sơ trực tuyến, thanh toán lệ phí và nhận hỗ trợ khi cần trên cùng một nền tảng.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <button type="button" onClick={() => navigate("/services")} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#003366] transition hover:bg-sky-50">
                  <SendHorizonal className="h-4 w-4" />
                  Nộp hồ sơ
                </button>
                <button type="button" onClick={() => navigate("/track")} className="inline-flex items-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/18">
                  <ClipboardList className="h-4 w-4" />
                  Tra cứu hồ sơ
                </button>
                <button type="button" onClick={() => navigate(user ? "/chat" : "/auth")} className="inline-flex items-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/18">
                  <MessageCircle className="h-4 w-4" />
                  Chat hỗ trợ
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#031f3d] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="text-lg font-black">Cổng Dịch vụ công trực tuyến</div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
              Cơ quan chủ quản: Trung tâm điều hành dịch vụ công và chính phủ điện tử. Hệ thống phục vụ tra cứu, nộp hồ sơ, thanh toán lệ phí và theo dõi kết quả trực tuyến.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-white/75">
              <span className="rounded-full bg-white/10 px-3 py-1">Dịch vụ công trực tuyến</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Chính phủ điện tử</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Hỗ trợ người dân</span>
            </div>
          </div>
          <div>
            <div className="font-black">Liên hệ hỗ trợ</div>
            <div className="mt-3 space-y-2 text-sm text-white/70">
              <div>Email: hotro@dichvucong.vn</div>
              <div>Hotline: 1900 0000</div>
              <div>Thời gian hỗ trợ: 07:30 - 17:00</div>
              <div>Kênh AI: hoạt động 24/7</div>
            </div>
          </div>
          <div>
            <div className="font-black">Chính sách & pháp lý</div>
            <div className="mt-3 space-y-2 text-sm text-white/70">
              <div>Chính sách bảo mật</div>
              <div>Điều khoản sử dụng</div>
              <div>Quy chế tiếp nhận hồ sơ</div>
              <div>Copyright © {new Date().getFullYear()} Cổng Dịch vụ công</div>
            </div>
          </div>
        </div>
      </footer>

      {user ? <HomeChatSection /> : null}
    </div>
  );
}
