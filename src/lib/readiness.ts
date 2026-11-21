export type ReadinessItem = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  price_vnd: number | null;
  stock_quantity: number | null;
  image_path: string | null;
  description: string;
  category_slug: string;
};
export function catalogReadiness(
  items: ReadinessItem[],
  activeCategories: string[],
) {
  const visible = items.filter(
    (i) => i.active && activeCategories.includes(i.category_slug),
  );
  const missing = visible.filter(
    (i) =>
      !i.image_path ||
      !i.description.trim() ||
      i.price_vnd === null ||
      i.price_vnd <= 0,
  );
  const sellable = visible.filter(
    (i) =>
      i.price_vnd !== null &&
      i.price_vnd > 0 &&
      (i.type === "service" || (i.stock_quantity ?? 0) > 0),
  );
  return {
    visible: visible.length,
    sellable: sellable.length,
    missing: missing.map((i) => ({
      id: i.id,
      name: i.name,
      reasons: [
        ...(!i.image_path ? ["Chưa có ảnh"] : []),
        ...(!i.description.trim() ? ["Chưa có mô tả"] : []),
        ...(i.price_vnd === null || i.price_vnd <= 0
          ? ["Chưa có giá bán hợp lệ"]
          : []),
      ],
    })),
    drafts: items.filter((i) => !i.active).length,
  };
}
