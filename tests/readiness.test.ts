import test from "node:test";
import assert from "node:assert/strict";
import { catalogReadiness, type ReadinessItem } from "../src/lib/readiness.ts";
import {
  buyingGuide,
  privacySections,
  shippingPolicy,
  retentionPolicy,
} from "../src/lib/shop-policies.ts";
test("M7 content checks flag missing published content, exclude hidden groups and never edit catalog", () => {
  const item: ReadinessItem = {
    id: "1",
    name: "Keyboard",
    category_slug: "keyboard",
    active: true,
    type: "product",
    price_vnd: 500000,
    stock_quantity: 2,
    image_path: "image.webp",
    description: "Keyboard details",
  };
  const items = [
    item,
    { ...item, id: "2", stock_quantity: 0 },
    { ...item, id: "3", active: false },
    { ...item, id: "4", category_slug: "off" },
    { ...item, id: "5", image_path: null, description: "", price_vnd: null },
    { ...item, id: "6", type: "service", stock_quantity: null },
  ];
  const original = JSON.stringify(items),
    r = catalogReadiness(items, ["keyboard"]);
  assert.equal(r.visible, 4);
  assert.equal(r.sellable, 2);
  assert.equal(r.drafts, 1);
  assert.equal(r.missing.length, 1);
  assert.deepEqual(r.missing[0].reasons, [
    "Chưa có ảnh",
    "Chưa có mô tả",
    "Chưa có giá bán hợp lệ",
  ]);
  assert.equal(JSON.stringify(items), original);
});
test("M7 published guidance reflects approved shipping, deposits and provisional retention without promising automatic deletion", () => {
  assert.match(shippingPolicy, /Khách thanh toán toàn bộ/);
  assert.match(shippingPolicy, /COD/);
  assert.match(buyingGuide.find((x) => x.id === "pay")!.text, /20%/);
  assert.match(retentionPolicy, /90 ngày/);
  assert.match(retentionPolicy, /180 ngày/);
  assert.match(retentionPolicy, /24 tháng/);
  assert.match(retentionPolicy, /chưa áp dụng xóa tự động/);
  assert.match(
    privacySections.find((x) => x.id === "browser")!.text,
    /không xóa dữ liệu/,
  );
  assert.equal(new Set(buyingGuide.map((s) => s.id)).size, buyingGuide.length);
});
