"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CatalogItem, CategorySlug, EstimateLine } from "@/lib/domain";
import { calculateEstimate, estimateText, formatVnd, serviceCatalog, modCategorySlugs } from "@/lib/estimate";
import { shop } from "@/lib/brand";
import { lubePackages } from "@/lib/catalog-input";
type Category = {
  slug: CategorySlug;
  title: string;
  description: string;
  mark: string;
};


export function ServiceEstimator({catalog:allItems,categories:allCategories,demo=false,initialCategory=""}:{catalog:CatalogItem[];categories:Category[];demo?:boolean;initialCategory?:string}) {
  const catalog = serviceCatalog(allItems);
  const categories = allCategories.filter((entry) => modCategorySlugs.includes(entry.slug));
  const dialog = useRef<HTMLDialogElement>(null);
  const [category,setCategory] = useState<Category|null>(()=>categories.find(c=>c.slug===initialCategory)??null);
  const [lines,setLines] = useState<EstimateLine[]>([]);
  const [notice,setNotice] = useState("");
  const estimate = calculateEstimate(lines,catalog);
  useEffect(()=>{if(initialCategory && categories.some(c=>c.slug===initialCategory) && !dialog.current?.open) dialog.current?.showModal();},[initialCategory,categories]);
  function openCategory(selected: Category) {
    setCategory(selected);
    dialog.current?.showModal();
  }
  function add(item: CatalogItem) {
    if (lines.some((line) => line.itemId === item.id)) {
      setNotice(
        `${item.name} đã có trong ước tính. Bạn có thể sửa số lượng bên dưới.`,
      );
      return;
    }
    setLines((previous) => [...previous, { itemId: item.id, quantity: 1 }]);
    setNotice(`Đã chọn ${item.name}.`);
  }
  function update(item: CatalogItem, quantity: number) {
    try {
      const next = lines.map((line) =>
        line.itemId === item.id ? { ...line, quantity } : line,
      );
      calculateEstimate(next, catalog);
      setLines(next);
      setNotice("");
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Chưa cập nhật được số lượng.",
      );
      return false;
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(estimateText(lines, catalog));
      setNotice(
        demo
          ? "Đã sao chép cấu hình minh họa, chưa phải báo giá chính thức."
          : "Đã sao chép cấu hình. Mở Zalo bên dưới và dán để shop xác nhận.",
      );
    } catch {
      setNotice(
        "Trình duyệt chưa cho phép sao chép. Bạn có thể chọn đoạn cấu hình bên dưới để copy thủ công.",
      );
    }
  }


  return <main id="main" className="buyer-home estimate-page">
    <header className="container estimate-page-heading"><h1>Ước tính chi phí</h1><p>Chọn dịch vụ, điều chỉnh số lượng và gửi cấu hình cho shop xác nhận.</p></header>
    <section className="container estimate-categories" aria-label="Chọn nhóm dịch vụ">
      <div className="service-grid">{categories.map(entry=><button key={entry.slug} className="service-card" onClick={()=>openCategory(entry)} aria-label={`Xem bảng giá ${entry.title}`}><h2>{entry.title}</h2><p>{entry.description}</p><span className="card-link">Xem bảng giá ↗</span></button>)}</div>
    </section>
      <div className="home-band home-band-estimate">
      <section id="estimate" className="section container estimate-section">
        <div className="estimate-intro">
          <h2>Ước tính chi phí mod</h2>
          <p>
            Chọn dịch vụ và số lượng để hình dung chi phí. Shop sẽ kiểm tra độ
            tương thích và xác nhận báo giá trước khi làm.
          </p>
          <span className="badge">
            {demo ? "VND · Giá minh họa" : "VND · Chưa gồm phí ship"}
          </span>
        </div>
        <div className="estimate-panel">
          <div className="panel-heading">
            <h3>Ước tính của bạn</h3>
            <span>{lines.length} hạng mục</span>
          </div>
          {estimate.details.length === 0 ? (
            <div className="estimate-empty">
              <span aria-hidden="true">＋</span>
              <h4>Bắt đầu với điều bạn muốn cải thiện</h4>
              <p>Thêm lube, stab, keycap hoặc tiêu âm từ bảng giá.</p>
              <button
                className="text-button"
                disabled={!categories.length}
                onClick={() => categories[0] && openCategory(categories[0])}
              >
                Khám phá dịch vụ ↗
              </button>
            </div>
          ) : (
            <ul className="estimate-lines">
              {estimate.details.map(({ item, quantity, subtotal }) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {formatVnd(item.price)} / {item.unit}
                    </small>
                    <button
                      className="remove-button"
                      aria-label={`Bỏ ${item.name}`}
                      onClick={() => {
                        setLines((previous) =>
                          previous.filter((line) => line.itemId !== item.id),
                        );
                        setNotice(`Đã bỏ ${item.name}.`);
                      }}
                    >
                      Bỏ chọn
                    </button>
                  </div>
                  <label className="quantity-label">
                    Số lượng
                    <input
                      aria-label={`Số lượng ${item.name}`}
                      type="number"
                      min="1"
                      max={item.stock ?? 999}
                      step="1"
                      defaultValue={quantity}
                      onBlur={(event) => {
                        if (!update(item, Number(event.target.value))) {
                          event.target.value = String(quantity);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </label>
                  <strong className="line-price">{formatVnd(subtotal)}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="estimate-total">
            <span>Tổng dự kiến</span>
            <strong>{formatVnd(estimate.total)}</strong>
          </div>
          <button
            className="button button-primary full-width"
            disabled={!lines.length}
            onClick={copy}
          >
            Sao chép cấu hình
          </button>
          <p className="estimate-note">
            Sao chép cấu hình rồi dán vào Zalo. Giá cuối cùng được xác nhận
            trước khi làm.
          </p>
          <a
            className="button button-outline full-width"
            href={shop.zalo}
            target="_blank"
            rel="noopener noreferrer"
          >
            Nhắn Zalo TRUMP Keys ↗
          </a>
          <div className="notice" role="status" aria-live="polite">
            {notice}
          </div>
          {!!lines.length && (
            <details className="copy-fallback">
              <summary>Xem cấu hình dạng văn bản</summary>
              <textarea
                aria-label="Cấu hình để sao chép thủ công"
                readOnly
                rows={6}
                value={estimateText(lines, catalog)}
              />
            </details>
          )}
        </div>
      </section>
      </div>
      <dialog
        ref={dialog}
        className="service-dialog"
        aria-labelledby="dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-handle" aria-hidden="true" />
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">
              {demo ? "Bảng giá minh họa" : "Bảng giá TRUMP Keys"}
            </span>
            <h2 id="dialog-title">{category?.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Đóng bảng giá"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p className="muted">
          {demo ? "Giá và tồn kho mẫu. " : ""}Giá gồm công và vật liệu, chưa gồm
          phí vận chuyển. Kiểm tra độ tương thích với shop trước khi chốt.
        </p>
        <ul className="catalog-list">
          {!catalog.some((item) => item.category === category?.slug) && (
            <li>
              <div>
                <h3>Shop đang cập nhật bảng giá</h3>
                <p>
                  Chưa có mục công khai trong nhóm này. Nhắn Zalo để được tư
                  vấn.
                </p>
                <a
                  className="button button-outline"
                  href={shop.zalo}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Hỏi giá qua Zalo ↗
                </a>
              </div>
            </li>
          )}
          {catalog
            .filter((item) => item.category === category?.slug)
            .map((item) => {
              const selected = lines.some((line) => line.itemId === item.id);
              return (
                <li key={item.id}>
                  <div>
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={96}
                        height={96}
                        unoptimized
                        className="catalog-item-image"
                      />
                    )}
                    <h3>{item.name}</h3>
                    {item.lubePackage && (
                      <span className="badge">
                        {
                          lubePackages.find((p) => p.value === item.lubePackage)
                            ?.label
                        }
                      </span>
                    )}
                    <p>{item.description}</p>
                    <small>
                      {item.stock !== null
                        ? `Còn ${item.stock} ${item.unit}${demo ? " (mẫu)" : ""}`
                        : "Dịch vụ"}
                    </small>
                  </div>
                  <div className="catalog-price">
                    <strong>
                      {formatVnd(item.price)}
                      <small> / {item.unit}</small>
                    </strong>
                    <button
                      className="button button-outline"
                      disabled={selected || item.stock === 0}
                      onClick={() => add(item)}
                    >
                      {selected ? "✓ Đã chọn" : "+ Chọn"}
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
        <p role="status" className="dialog-notice">
          {notice}
        </p>
        <button
          className="button button-primary full-width"
          onClick={() => {
            dialog.current?.close();
            document
              .getElementById("estimate")
              ?.scrollIntoView({ behavior: "instant" });
          }}
        >
          Xem ước tính · {formatVnd(estimate.total)}
        </button>
      </dialog>

  </main>;
}
