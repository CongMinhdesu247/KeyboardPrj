import type { Metadata } from "next";
import Link from "next/link";
import { FindRequestForm } from "@/components/find-request-form";
import { issueRequestToken } from "@/lib/request-token";
import { readAuthConfig } from "@/lib/auth-config";
import { shop } from "@/lib/brand";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Đặt tìm keycap & stab",
  robots: { index: false, follow: false },
};
export default function PreorderPage() {
  const ready = readAuthConfig(process.env) && process.env.SUPABASE_SECRET_KEY;
  return (
    <main id="main" className="container page-container buyer-request-page">
      <header className="buyer-request-intro">
      <Link href="/#services" className="back-link">
        ← Về bảng dịch vụ
      </Link>
      <span className="badge">Không cần cọc</span>
      <h1>Tìm mẫu bạn đang nghĩ đến.</h1>
      <p className="page-lead">
        Gửi ảnh hoặc link keycap/stabilizer. Shop kiểm tra mẫu, giá và khả năng
        tìm hàng rồi liên hệ với bạn.
      </p>
      </header>
      <section className="info-panel">
        {ready ? (
          <FindRequestForm
            token={issueRequestToken(process.env.SUPABASE_SECRET_KEY!)}
          />
        ) : (
          <>
            <h2>Chưa mở gửi yêu cầu trên web</h2>
            <p>Bạn có thể trao đổi trực tiếp qua Zalo của shop.</p>
            <a
              className="button button-primary"
              href={shop.zalo}
              target="_blank"
              rel="noreferrer"
            >
              Liên hệ Zalo
            </a>
          </>
        )}
      </section>
      <p className="m4-privacy">
        Ảnh, SĐT và ghi chú chỉ phục vụ tư vấn/đặt tìm, không tự công khai trên
        website. Chưa thu tiền hay giữ hàng khi gửi yêu cầu. Giờ tư vấn
        08:00–22:00.
      </p>
    </main>
  );
}
