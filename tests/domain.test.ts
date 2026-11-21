import test from "node:test";
import assert from "node:assert/strict";
import { calculateEstimate, estimateText, serviceCatalog, modCategorySlugs } from "../src/lib/estimate.ts";
import { catalog } from "../src/lib/catalog.ts";
import { normalizeOrderCode } from "../src/lib/tracking.ts";
import { isAllowedHost } from "../src/lib/host-policy.ts";

test("bảng ước tính chỉ nhận dịch vụ kể cả linh kiện được gán cùng nhóm lube", () => {
  const service = { ...catalog[0], id: "service", category: "lube" as const, type: "service" as const };
  const product = { ...service, id: "switch-product", type: "product" as const, stock: 1 };
  const source = [product, service];
  assert.deepEqual(serviceCatalog(source), [service]);
  assert.deepEqual(source, [product, service]);
  assert.deepEqual(modCategorySlugs, ["lube", "stab", "keycap", "sound_mod"]);
});

test("host public chính xác, health loopback và từ chối host/proxy lạ", () => {
  const origin = "https://trumpkeys.publice.io.vn";
  assert.equal(isAllowedHost("trumpkeys.publice.io.vn", "/admin", origin), true);
  assert.equal(isAllowedHost("evil.example", "/admin", origin), false);
  assert.equal(
    isAllowedHost("trumpkeys.publice.io.vn.evil.example", "/", origin),
    false,
  );
  assert.equal(isAllowedHost("127.0.0.1:3000", "/api/health", origin), true);
  assert.equal(isAllowedHost("127.0.0.1:8094", "/api/health", origin), true);
  assert.equal(
    isAllowedHost("127.0.0.1.evil.example:8094", "/api/health", origin),
    false,
  );
  assert.equal(isAllowedHost("127.0.0.1:3000", "/admin", origin), false);
  assert.equal(isAllowedHost(null, "/", origin), false);
  assert.equal(isAllowedHost("trumpkeys.publice.io.vn", "/", "invalid"), false);
  assert.equal(
    isAllowedHost("localhost:3000", "/", "http://localhost:3000"),
    true,
  );
});

test("ước tính theo phím và theo bộ bằng số nguyên VND", () => {
  const lines = [
    { itemId: "lube-switch", quantity: 82 },
    { itemId: "stab-tune", quantity: 1 },
  ];
  assert.equal(calculateEstimate(lines, catalog).total, 366000);
  assert.match(estimateText(lines, catalog), /Lube switch × 82 phím/);
  assert.equal(calculateEstimate([], catalog).total, 0);
});
test("từ chối số lượng sai, món trùng/không tồn tại và vượt tồn kho", () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 1000])
    assert.throws(() =>
      calculateEstimate([{ itemId: "lube-switch", quantity }], catalog),
    );
  assert.throws(() =>
    calculateEstimate([{ itemId: "missing", quantity: 1 }], catalog),
  );
  assert.throws(() =>
    calculateEstimate([{ itemId: "reaper", quantity: 91 }], catalog),
  );
  assert.equal(
    calculateEstimate([{ itemId: "reaper", quantity: 90 }], catalog).total,
    405000,
  );
  assert.throws(() =>
    calculateEstimate(
      [
        { itemId: "foam", quantity: 1 },
        { itemId: "foam", quantity: 1 },
      ],
      catalog,
    ),
  );
  assert.throws(() =>
    calculateEstimate(
      [{ itemId: "foam", quantity: 1 }],
      catalog.map((item) => ({ ...item, price: -1 })),
    ),
  );
});
test("chuẩn hóa mã, chặn path và dữ liệu ngoài định dạng", () => {
  assert.equal(normalizeOrderCode(" kb-demo2026 "), "KB-DEMO2026");
  for (const value of [
    "",
    "KB-1",
    "../admin",
    "KB-202601?x=1",
    "KB-" + "A".repeat(33),
  ])
    assert.equal(normalizeOrderCode(value), null);
});
