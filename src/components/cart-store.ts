"use client";
import { useSyncExternalStore } from "react";
import { CART_KEY, parseCart, type CartLine } from "@/lib/cart";
const event = "trumpkeys-cart-change";
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(event, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(event, fn);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(CART_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
export function useCart() {
  return parseCart(useSyncExternalStore(subscribe, snapshot, () => "[]"));
}
export function useCartReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
export function writeCart(lines: CartLine[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
    window.dispatchEvent(new Event(event));
    return true;
  } catch {
    return false;
  }
}
export function addCart(line: CartLine) {
  const rows = parseCart(snapshot()),
    old = rows.find((r) => r.itemId === line.itemId);
  if (!old && rows.length >= 30) return false;
  return writeCart(
    old
      ? rows.map((r) =>
          r.itemId === line.itemId
            ? { ...line, quantity: Math.min(99, r.quantity + line.quantity) }
            : r,
        )
      : [...rows, line],
  );
}
export function removeSubmitted(lines: CartLine[]) {
  writeCart(
    parseCart(snapshot()).flatMap((r) => {
      const sent = lines.find((i) => i.itemId === r.itemId);
      const q = r.quantity - (sent?.quantity ?? 0);
      return q > 0 ? [{ ...r, quantity: q }] : [];
    }),
  );
}
