import type { CatalogItem, EstimateLine } from "./domain.ts";

export function serviceCatalog(catalog: CatalogItem[]) {
  return catalog.filter((item) => item.type === "service");
}

export const modCategorySlugs = ["lube", "stab", "keycap", "sound_mod", "cleaning"];

export const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export function calculateEstimate(
  lines: EstimateLine[],
  catalog: CatalogItem[],
) {
  const seen = new Set<string>();
  const details = lines.map((line) => {
    const item = catalog.find((entry) => entry.id === line.itemId);
    if (!item || seen.has(line.itemId))
      throw new Error("Món đã chọn không hợp lệ hoặc bị trùng.");
    seen.add(item.id);
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 999
    )
      throw new Error("Số lượng phải là số nguyên từ 1 đến 999.");
    if (
      !Number.isSafeInteger(item.price) ||
      item.price < 0 ||
      item.price > 1_000_000_000
    )
      throw new Error("Giá sản phẩm không hợp lệ.");
    if (
      item.type === "product" &&
      (item.stock === null ||
        !Number.isSafeInteger(item.stock) ||
        item.stock < line.quantity)
    )
      throw new Error("Số lượng vượt tồn kho hiện có.");
    return { ...line, item, subtotal: item.price * line.quantity };
  });
  const total = details.reduce((sum, line) => sum + line.subtotal, 0);
  if (!Number.isSafeInteger(total))
    throw new Error("Tổng tiền vượt giới hạn xử lý.");
  return { details, total };
}
export function estimateText(lines: EstimateLine[], catalog: CatalogItem[]) {
  const { details, total } = calculateEstimate(lines, catalog);
  return [
    "Mình muốn tư vấn cấu hình mod:",
    ...details.map(
      ({ item, quantity, subtotal }) =>
        `- ${item.name} × ${quantity} ${item.unit}: ${formatVnd(subtotal)}`,
    ),
    `Tổng dự kiến: ${formatVnd(total)}`,
    "Giá gồm công và vật liệu, chưa gồm phí vận chuyển.",
    "Nhờ shop kiểm tra độ tương thích và xác nhận báo giá.",
  ].join("\n");
}
