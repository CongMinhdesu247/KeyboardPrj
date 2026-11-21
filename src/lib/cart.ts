import type { CatalogItem } from "./domain.ts";
export type CartLine = {
  itemId: string;
  quantity: number;
  expectedPrice: number;
};
export const CART_KEY = "trumpkeys-cart-v1";
export function parseCart(value: string): CartLine[] {
  try {
    const rows = JSON.parse(value);
    if (!Array.isArray(rows) || rows.length > 30) return [];
    const ids = new Set<string>();
    return rows
      .filter((r: CartLine) => {
        if (
          !r ||
          typeof r.itemId !== "string" ||
          !/^\d{1,16}$/.test(r.itemId) ||
          !Number.isInteger(r.quantity) ||
          r.quantity < 1 ||
          r.quantity > 99 ||
          !Number.isInteger(r.expectedPrice) ||
          r.expectedPrice < 0 ||
          r.expectedPrice > 1e9 ||
          ids.has(r.itemId)
        )
          return false;
        ids.add(r.itemId);
        return true;
      })
      .map((r: CartLine) => ({
        itemId: r.itemId,
        quantity: r.quantity,
        expectedPrice: r.expectedPrice,
      }));
  } catch {
    return [];
  }
}
export function resolveCart(lines: CartLine[], catalog: CatalogItem[]) {
  return lines.map((line) => ({
    line,
    item: catalog.find((i) => i.id === line.itemId),
  }));
}
