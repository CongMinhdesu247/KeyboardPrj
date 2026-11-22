"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem, CategorySlug } from "@/lib/domain";
import { normalizeOrderCode } from "@/lib/tracking";
import { shop } from "@/lib/brand";
import { PortfolioGallery } from "./portfolio-gallery";
import type { PublicPortfolio } from "@/lib/m4-contract";
import { Storefront } from "./storefront";
import { ShopIcon } from "./shop-icon";
import {HomeBanners} from "./home-banners";
import type {PublicBanner} from "@/lib/banner-contract";
import { modCategorySlugs } from "@/lib/estimate";
type Category = {
  slug: CategorySlug;
  title: string;
  description: string;
  mark: string;
};

export function Workshop({
  catalog,
  categories,
  demo = false,
  portfolio = [],
  banners = [],
}: {
  catalog: CatalogItem[];
  categories: Category[];
  demo?: boolean;
  portfolio?: PublicPortfolio[];
  banners?:PublicBanner[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [ledPaused, setLedPaused] = useState(false);
  return (
    <main id="main" className="buyer-home">
      {banners.length?<HomeBanners banners={banners}/>:<section className="buyer-hero container" aria-labelledby="buyer-hero-title">
        <div className="buyer-hero-copy">
          <p className="hero-brand-line">TRUMP Keys <span aria-hidden="true">/</span> Bàn phím & dịch vụ mod</p>
          <h1 id="buyer-hero-title">Bàn phím & linh kiện.<br />Tinh chỉnh theo bạn.</h1>
          <p>Chọn bàn phím, switch, keycap hoặc đặt dịch vụ mod cho bộ phím bạn đang dùng.</p>
          <div className="form-actions">
            <Link href="/shop" className="button button-primary">Mua sắm ngay <ShopIcon name="arrow" size={18}/></Link>
            <a href="#services" className="buyer-text-link">Dịch vụ mod</a>
          </div>
        </div>
        <figure className="buyer-hero-visual">
          <span className="hero-key-detail" aria-hidden="true">Chọn phím.<br/>Chọn chất riêng.</span>
          <Image src="/keyboard.svg" width={760} height={480} alt="Minh họa bàn phím custom với keycap xám, trắng và vàng" priority />
          <figcaption>Minh họa bàn phím custom</figcaption>
        </figure>
      </section>}
      <div className="buyer-assurances container">
        <div><ShopIcon name="shield" size={24}/><p><strong>Thanh toán linh hoạt</strong><span>Cọc 20% + COD hoặc chuyển khoản 100%</span></p></div>
        <div><ShopIcon name="box" size={24}/><p><strong>Dịch vụ theo cấu hình</strong><span>Lube switch, cân stab và tinh chỉnh chất âm</span></p></div>
        <div><ShopIcon name="search" size={24}/><p><strong>Theo dõi từng bước</strong><span>Tiến độ và ảnh cập nhật bằng mã đơn</span></p></div>
      </div>

      <div className="home-band home-band-services">
      <section id="services" className="section container home-services">
        <div className="section-heading">
          <div>
            <h2>Dịch vụ mod bàn phím</h2>
          </div>
          <p>
            Chọn nhóm để xem bảng giá và ước tính chi phí.
            <br />
            <span className="muted">
              {demo
                ? "Giá & tồn kho đang là dữ liệu mẫu."
                : "Giá gồm công và vật liệu, chưa gồm phí vận chuyển."}
            </span>
          </p>
        </div>
        <div className="service-grid">
          {categories.filter((entry) => modCategorySlugs.includes(entry.slug)).map((entry) => (
            <Link
              key={entry.slug}
              className="service-card"
              aria-label={`Xem bảng giá ${entry.title}`}
              href={`/estimate?category=${entry.slug}`}
            >
              <h3>{entry.title}</h3>
              <p>{entry.description}</p>
              <span className="card-link">
                Xem bảng giá <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
        <div
          className="preorder-strip preorder-spotlight"
          data-led-paused={ledPaused ? "true" : undefined}
        >
          <div className="preorder-spotlight-inner">
            <div className="preorder-spotlight-copy">
              <strong>Chưa tìm thấy mẫu bạn cần?</strong>
              <p>
                Gửi ảnh mẫu bàn phím, keycap, switch hoặc ý tưởng build riêng để shop tìm giúp và tư vấn cấu hình đúng gu. Không cần cọc trước.
              </p>
              <ul className="preorder-spotlight-highlights" aria-label="Ưu điểm đặt tìm mẫu và custom">
                <li>Tìm mẫu theo ảnh</li>
                <li>Tư vấn cấu hình &amp; chất âm riêng</li>
                <li>Báo giá rõ · Không cần cọc</li>
              </ul>
            </div>
            <div className="preorder-spotlight-action">
              <Link href="/preorder" className="button button-primary preorder-cta">
                Đặt tìm mẫu &amp; custom <ShopIcon name="arrow" size={18} />
              </Link>
              <button
                type="button"
                className="preorder-led-toggle"
                aria-pressed={ledPaused}
                onClick={() => setLedPaused((prev) => !prev)}
              >
                {ledPaused ? "Bật hiệu ứng viền" : "Dừng hiệu ứng viền"}
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>
      <div className="container home-shopping">
        <nav className="home-category-links" aria-label="Mua theo nhóm sản phẩm">
          <span>Bạn đang tìm gì?</span>
          <Link href="/shop?category=keyboard">Bàn phím <ShopIcon name="arrow" size={16}/></Link>
          <Link href="/shop?category=switch">Switch <ShopIcon name="arrow" size={16}/></Link>
          <Link href="/shop?category=keycap">Keycap <ShopIcon name="arrow" size={16}/></Link>
          <Link href="/shop?category=accessory">Phụ kiện <ShopIcon name="arrow" size={16}/></Link>
        </nav>
        <Storefront items={catalog} categories={categories} demo={demo} compact />
      </div>
      <section id="portfolio" className="section container portfolio">
        <div>
          <h2>Bàn phím đã thực hiện & sound test</h2>
          <p>Sound test giúp bạn so sánh cấu hình trong cùng điều kiện thu.</p>
        </div>
        <PortfolioGallery items={portfolio} />
        <Link href="/portfolio" className="button button-outline">
          Xem portfolio & sound test
        </Link>
      </section>
      <section id="tracking" className="home-tracking container" aria-label="Tra cứu đơn hàng">
          <form
            className="tracking-form"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeOrderCode(code);
              if (!normalized) {
                setTrackingError(
                  "Nhập đầy đủ mã TK- cùng 32 ký tự trong tin nhắn của shop. Có thể thử KB-DEMO2026.",
                );
                return;
              }
              setTrackingError("");
              router.push(`/track/${normalized}`);
            }}
          >
            <label htmlFor="order-code">
              Theo dõi đơn của bạn
            </label>
            <div className="tracking-input">
              <input
                id="order-code"
                name="order-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Nhập mã đơn hàng"
                required
                maxLength={35}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!trackingError}
                aria-describedby={
                  trackingError ? "tracking-error" : "tracking-hint"
                }
              />
              <button className="button button-primary" type="submit">
                Tra cứu
              </button>
            </div>
            {trackingError ? (
              <p className="field-error" id="tracking-error" role="alert">
                {trackingError}
              </p>
            ) : (
              <p id="tracking-hint">
                Mã đơn nằm trong tin nhắn của shop.{" "}
                {demo && <Link href="/track/KB-DEMO2026">Xem đơn minh họa</Link>}
              </p>
            )}
          </form>
      </section>
      <section id="contact" className="section container contact-section">
        <div>
          <h2>Cần tư vấn cấu hình?</h2>
          <p>Hỏi trợ lý tư vấn hoặc trao đổi trực tiếp với shop.</p>
          <Link className="button button-outline" href="/chat">Mở tư vấn trên web</Link>
          <a
            className="button button-primary"
            href={shop.zalo}
            target="_blank"
            rel="noopener noreferrer"
          >
            Tư vấn qua Zalo · 08:00–22:00
          </a>
        </div>
      </section>
    </main>
  );
}
