import Link from "next/link";
import { shop } from "@/lib/brand";
export function PolicyPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: readonly { id: string; title: string; text: string }[];
}) {
  return (
    <main id="main" className="container page-container policy-page">
      <Link href="/shop" className="back-link">
        ← Cửa hàng
      </Link>
      <h1>{title}</h1>
      <p className="policy-intro">{description}</p>
      <div className="policy-layout">
        <nav aria-label="Mục lục" className="policy-toc">
          <strong>Trong trang này</strong>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>
        <div className="policy-content">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </section>
          ))}
          <section className="policy-contact">
            <h2>Cần shop hỗ trợ?</h2>
            <p>
              Tư vấn 08:00–22:00, giờ Việt Nam. Ngoài giờ, shop phản hồi khi mở
              cửa.
            </p>
            <a
              className="button button-primary"
              href={shop.zalo}
              target="_blank"
              rel="noreferrer"
            >
              Liên hệ TRUMP Keys qua Zalo
            </a>
            <div className="policy-links">
              <Link href="/guide">Hướng dẫn mua hàng</Link>
              <Link href="/privacy">Thông tin riêng tư</Link>
              <Link href="/preorder">Đặt tìm mẫu</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
