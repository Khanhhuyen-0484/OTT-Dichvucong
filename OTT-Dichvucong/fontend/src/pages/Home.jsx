import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "../components/GovHeader.jsx";
import HomeChatSection from "../components/HomeChatSection.jsx";
import {
  Building2,
  CarFront,
  ClipboardList,
  FileText,
  FolderKanban,
  Landmark,
  MessageCircle,
  Search,
  SendHorizonal
} from "lucide-react";

function ServiceCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-[#003366]/5 p-2.5 ring-1 ring-[#003366]/10">
          <Icon className="h-6 w-6 text-[#003366]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{desc}</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const services = useMemo(
    () => [
      {
        icon: FileText,
        title: "Hộ tịch",
        desc: "Khai sinh, kết hôn, trích lục bản sao theo quy trình điện tử."
      },
      {
        icon: FolderKanban,
        title: "Đất đai",
        desc: "Đăng ký biến động đất đai, cấp đổi giấy chứng nhận quyền sử dụng."
      },
      {
        icon: Building2,
        title: "Xây dựng",
        desc: "Xin cấp phép xây dựng, điều chỉnh hồ sơ và theo dõi tiến độ."
      },
      {
        icon: Landmark,
        title: "Hộ chiếu",
        desc: "Nộp hồ sơ cấp/đổi hộ chiếu và nhận thông báo xử lý trực tuyến."
      },
      {
        icon: CarFront,
        title: "Giao thông",
        desc: "Đổi giấy phép lái xe, đăng ký phương tiện và tra cứu vi phạm."
      },
      {
        icon: ClipboardList,
        title: "Doanh nghiệp",
        desc: "Đăng ký kinh doanh, thay đổi thông tin và dịch vụ chuyên ngành."
      }
    ],
    []
  );

  const onSubmit = (e) => {
    e.preventDefault();
    alert(
      q.trim()
        ? `Tìm kiếm: ${q.trim()} (demo UI)`
        : "Vui lòng nhập từ khóa tìm kiếm."
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <GovHeader />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-[#003366] via-[#0a3f74] to-[#003366] text-white">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="mx-auto max-w-7xl px-4 py-14 md:py-18">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#7a1f1f]" />
                  Cổng tiếp nhận hồ sơ trực tuyến cấp quốc gia
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Tra cứu thủ tục hành chính
                  <span className="block text-sky-100">Nhanh hơn. Rõ ràng hơn. Minh bạch hơn.</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
                  Nộp hồ sơ, thanh toán lệ phí, theo dõi trạng thái và nhận hỗ trợ tức thời từ trợ lý ảo
                  hoặc cán bộ chuyên trách, tất cả trong một nền tảng thống nhất.
                </p>

                <form onSubmit={onSubmit} className="mt-6">
                  <div className="rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <label className="sr-only" htmlFor="search">
                        Tìm kiếm thủ tục hành chính
                      </label>
                      <div className="flex flex-1 items-center rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input
                          id="search"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Ví dụ: Đăng ký khai sinh, đổi GPLX, cấp phép xây dựng..."
                          className="h-12 w-full bg-transparent px-2 text-sm text-slate-800 outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-xl bg-[#003366] px-6 py-3 text-sm font-bold text-white hover:bg-[#052b53]"
                      >
                        Tra cứu ngay
                      </button>
                    </div>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#003366] shadow-sm hover:bg-slate-100">
                    <SendHorizonal className="h-4 w-4" />
                    Nộp hồ sơ
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-transparent px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">
                    <FileText className="h-4 w-4" />
                    Tra cứu kết quả
                  </button>
                  <button
                    onClick={() => navigate("/chat")}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#052b53]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Chat đa năng
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm">
                  <div className="text-sm font-bold uppercase tracking-wide text-sky-100">Thông báo hệ thống</div>
                  <ul className="mt-3 space-y-3 text-sm text-white/90">
                    <li className="rounded-xl bg-white/10 p-3">Tỷ lệ hồ sơ xử lý đúng hạn: <strong>96.2%</strong></li>
                    <li className="rounded-xl bg-white/10 p-3">Hỗ trợ trực tuyến từ <strong>07:30 - 17:00</strong> mỗi ngày làm việc.</li>
                    <li className="rounded-xl bg-white/10 p-3">Kênh AI hoạt động <strong>24/7</strong> cho tra cứu thủ tục phổ biến.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HomeChatSection />

        <section id="dichvu" className="mx-auto max-w-7xl px-4 pb-14 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Danh mục dịch vụ trọng điểm</h2>
              <p className="mt-1 text-sm text-slate-600">
                Chọn nhóm dịch vụ để bắt đầu nộp hồ sơ điện tử hoặc xem yêu cầu biểu mẫu chi tiết.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center">
          <div className="font-semibold">
            © {new Date().getFullYear()} Cổng Dịch vụ công
          </div>
          <div>Thiết kế UI mới: Portal công dân + hỗ trợ AI + chat cán bộ 1v1.</div>
        </div>
      </footer>
    </div>
  );
}

