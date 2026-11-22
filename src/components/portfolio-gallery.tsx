"use client";
import { useState } from "react";
import type { PublicPortfolio } from "@/lib/m4-contract";
import { youtubeId } from "@/lib/m4-contract";
import { ShopImage } from "./shop-image";
export function SoundTest({ url, title }: { url: string; title: string }) {
  const [opened, setOpened] = useState(false),
    id = youtubeId(url);
  if (!url) return null;
  if (!id)
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="button button-outline"
      >
        Xem sound test ↗
      </a>
    );
  return opened ? (
    <iframe
      className="sound-test"
      src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
      title={`Sound test: ${title}`}
      allow="encrypted-media; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  ) : (
    <button
      className="button button-outline"
      type="button"
      onClick={() => setOpened(true)}
    >
      Mở sound test
    </button>
  );
}
export function PortfolioGallery({ items }: { items: PublicPortfolio[] }) {
  const [search, setSearch] = useState("");
  const filtered = items.filter((i) =>
    `${i.title} ${i.keyboard} ${i.mods}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <div className="portfolio-content">
      {items.length > 6 && (
        <label className="portfolio-search">
          Tìm cấu hình / hạng mục mod
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      {!items.length ? (
        <div className="portfolio-empty">
          <h3>Đang chuẩn bị những bản mod đầu tiên</h3>
          <p>Shop sẽ bổ sung ảnh và sound test đã được chọn để công khai.</p>
        </div>
      ) : !filtered.length ? (
        <p>Không có cấu hình phù hợp. Thử từ khóa khác.</p>
      ) : (
        <div className="portfolio-grid">
          {filtered.map((i) => (
            <article className="portfolio-card" key={i.id}>
              <div className="portfolio-photo"><ShopImage src={i.imageUrl} alt={i.title} width={800} height={600} /></div>
              <div className="portfolio-card-body">
                <h3>{i.title}</h3>
                <p className="portfolio-keyboard">{i.keyboard}</p>
                {i.mods && <p className="portfolio-mods">{i.mods}</p>}
                {i.description && <p className="portfolio-description">{i.description}</p>}
                {i.videoUrl && (
                  <div className="portfolio-card-actions">
                    <SoundTest url={i.videoUrl} title={i.title} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
