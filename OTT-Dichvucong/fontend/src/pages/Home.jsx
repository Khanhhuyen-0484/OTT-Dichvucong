import React, { useMemo, useState } from "react";
import GovHeader from "../components/GovHeader.jsx";
import HomeChatSection from "../components/HomeChatSection.jsx";
import {
  Building2,
  CarFront,
  ClipboardList,
  FileText,
  IdCard,
  Landmark
} from "lucide-react";

function ServiceCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 hover:ring-slate-300 transition">
      <div className="flex items-start gap-4">
        <div className="rounded-xl p-2.5 bg-slate-50 ring-1 ring-slate-200">
          <Icon className="h-6 w-6 text-[var(--gov-navy)]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold">{title}</div>
          <div className="text-sm text-slate-600 mt-1">{desc}</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [q, setQ] = useState("");

  const services = useMemo(
    () => [
      {
        icon: IdCard,
        title: "Cư trú",
        desc: "Đăng ký tạm trú/tạm vắng, xác nhận thông tin cư trú."
      },
      {
        icon: Landmark,
        title: "Hộ chiếu",
        desc: "Hướng dẫn và nộp hồ sơ cấp/đổi hộ chiếu."
      },
      {
        icon: CarFront,
        title: "Giấy phép lái xe",
        desc: "Đổi GPLX, tra cứu tiến độ xử lý hồ sơ."
      },
      {
        icon: FileText,
        title: "Hộ tịch",
        desc: "Đăng ký khai sinh, kết hôn, trích lục."
      },
      {
        icon: ClipboardList,
        title: "Thủ tục hành chính",
        desc: "Tra cứu thủ tục, biểu mẫu và yêu cầu hồ sơ."
      },
      {
        icon: Building2,
        title: "Doanh nghiệp",
        desc: "Đăng ký, thay đổi thông tin và dịch vụ liên quan."
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
    <div className="min-h-screen">
      <GovHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-[var(--gov-red)]" />
                Cổng thông tin chính thức
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                Tra cứu và thực hiện{" "}
                <span className="text-[var(--gov-navy)]">
                  thủ tục hành chính
                </span>{" "}
                trực tuyến
              </h1>
              <p className="mt-3 text-slate-600 max-w-prose">
                Giao diện chuyên nghiệp theo phong cách cơ quan nhà nước, tối ưu
                cho thiết bị di động và hỗ trợ truy cập (accessibility).
              </p>

              <form onSubmit={onSubmit} className="mt-6">
                <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="sr-only" htmlFor="search">
                      Tìm kiếm thủ tục hành chính
                    </label>
                    <input
                      id="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Tìm kiếm thủ tục hành chính…"
                      className="flex-1 rounded-xl bg-slate-50 px-3 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)]"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[var(--gov-navy)] px-4 py-3 text-sm font-bold text-white hover:bg-[#19306f]"
                    >
                      Tra cứu
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Gợi ý: “đổi giấy phép lái xe”, “đăng ký tạm trú”, “cấp hộ
                    chiếu”.
                  </div>
                </div>
              </form>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <div className="font-extrabold text-slate-900">
                  Thông tin nổi bật
                </div>
                <ul className="mt-3 space-y-3 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span
                      className="mt-2 h-2 w-2 rounded-full bg-[var(--gov-navy)]"
                      aria-hidden="true"
                    />
                    Tiếp nhận hồ sơ trực tuyến, theo dõi tiến độ minh bạch.
                  </li>
                  <li className="flex gap-2">
                    <span
                      className="mt-2 h-2 w-2 rounded-full bg-[var(--gov-navy)]"
                      aria-hidden="true"
                    />
                    Xác thực email bằng OTP, bảo vệ an toàn thông tin.
                  </li>
                  <li className="flex gap-2">
                    <span
                      className="mt-2 h-2 w-2 rounded-full bg-[var(--gov-red)]"
                      aria-hidden="true"
                    />
                    Hỗ trợ 24/7 (demo) và chuẩn responsive.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <HomeChatSection />

        <section id="dichvu" className="mx-auto max-w-6xl px-4 pb-12">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Dịch vụ phổ biến
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Danh mục minh họa (3×2), có thể mở rộng theo nhu cầu.
              </p>
            </div>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="font-semibold">
            © {new Date().getFullYear()} Cổng Dịch vụ công
          </div>
          <div>Demo UI — tích hợp OTP/Email ở trang Đăng nhập/Đăng ký.</div>
        </div>
      </footer>
    </div>
  );
}

