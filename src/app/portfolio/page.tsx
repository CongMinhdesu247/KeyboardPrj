import type { Metadata } from "next";
import Link from "next/link";
import { readPublicPortfolio } from "@/lib/portfolio-data";
import { PortfolioGallery } from "@/components/portfolio-gallery";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio & sound test" };
export default async function PortfolioPage() {
  const items = await readPublicPortfolio();
  return (
    <main id="main" className="container portfolio-page">
      <Link href="/" className="back-link">
        ← Trang chủ
      </Link>
      <h1>Bàn phím từ xưởng TRUMP Keys</h1>
      <p className="page-lead">
        Cấu hình, hạng mục mod và sound test đã được shop chọn để chia sẻ.
      </p>
      <PortfolioGallery items={items} />
      <p className="m4-privacy">
        Ảnh được cấp quyền xem ngắn hạn. Tải lại trang nếu ảnh hết hạn.
      </p>
    </main>
  );
}
