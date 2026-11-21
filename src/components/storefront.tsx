"use client";
import Link from "next/link";
import { useState } from "react";
import type { CatalogItem } from "@/lib/domain";
import { ProductCard } from "./product-card";
export function Storefront({
  items,
  categories,
  demo = false,
  compact = false,
  initialSearch = "",
  initialCategory = "",
}: {
  items: CatalogItem[];
  categories: { slug: string; title: string }[];
  demo?: boolean;
  compact?: boolean;
  initialSearch?: string;
  initialCategory?: string;
}) {
  const [search, setSearch] = useState(initialSearch),
    [category, setCategory] = useState(
      categories.some((c) => c.slug === initialCategory) ? initialCategory : "",
    ),
    [sort, setSort] = useState("featured"),
    [type, setType] = useState("all");
  const visible = items
    .filter(
      (i) =>
        (!category || i.category === category) &&
        (type === "all" || i.type === type) &&
        `${i.name} ${i.description}`
          .toLocaleLowerCase("vi")
          .includes(search.trim().toLocaleLowerCase("vi")),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : Number(b.id) - Number(a.id),
    );
  const filtered = !!search || !!category || type !== "all" || sort !== "featured";
  function clearFilters() {
    setSearch("");
    setCategory("");
    setType("all");
    setSort("featured");
  }
  return (
    <section
      className={`storefront ${compact ? "storefront-home" : ""}`}
      aria-label="Cửa hàng bàn phím"
    >
      <div className="storefront-heading">
        <div>
          {compact ? <h2>Sản phẩm & dịch vụ</h2> : <h1>Cửa hàng bàn phím</h1>}
          <p>Giá gồm công và vật liệu, chưa gồm phí ship.</p>
        </div>
        {compact && <Link href="/shop" className="buyer-text-link">Xem tất cả</Link>}
      </div>
      {demo && <p className="demo-label">Dữ liệu minh họa · Chưa mở đặt mua</p>}
      <div className={compact ? "buyer-catalog-compact" : "buyer-catalog-layout"}>
        {!compact && (
          <aside className="buyer-catalog-sidebar" aria-label="Bộ lọc cửa hàng">
            <label className="store-search">
              Tìm sản phẩm hoặc dịch vụ
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bàn phím, switch, keycap…"
              />
            </label>
            <div className="store-category-tabs" aria-label="Nhóm sản phẩm">
              <h2>Danh mục</h2>
              <button onClick={() => setCategory("")} aria-pressed={!category}>
                Tất cả
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setCategory(c.slug)}
                  aria-pressed={category === c.slug}
                >
                  {c.title}
                </button>
              ))}
            </div>
            <p>Chưa có mẫu bạn cần? <Link href="/preorder">Gửi yêu cầu đặt tìm</Link></p>
          </aside>
        )}
        <div className="buyer-catalog-results">
          {!compact && (
          <div className="store-sort">
            <span role="status">{visible.length} mục đang bán</span>
            {filtered && <button type="button" className="buyer-clear-filters" onClick={clearFilters}>Xóa bộ lọc</button>}
            <label>
              Loại
              <select
                aria-label="Loại hàng"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="all">Tất cả</option>
                <option value="product">Sản phẩm</option>
                <option value="service">Dịch vụ</option>
              </select>
            </label>
            <label>
              Sắp xếp
              <select
                aria-label="Sắp xếp"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="featured">Mới nhất</option>
                <option value="low">Giá tăng dần</option>
                <option value="high">Giá giảm dần</option>
              </select>
            </label>
          </div>
          )}
          {!visible.length ? (
            <div className="store-empty">
              <h2>Chưa có mặt hàng phù hợp</h2>
              <p>Thử nhóm khác hoặc liên hệ shop để đặt tìm mẫu.</p>
              {filtered && <button type="button" className="button button-primary" onClick={clearFilters}>Xem tất cả mặt hàng</button>}
              <Link href="/preorder" className="button button-outline">
                Đặt tìm mẫu
              </Link>
            </div>
          ) : (
            <div className="product-grid">
              {visible.slice(0, compact ? 8 : visible.length).map((i) => (
                <ProductCard key={i.id} item={i} demo={demo} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
