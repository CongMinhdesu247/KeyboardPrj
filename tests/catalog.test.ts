import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalogInput, integerInput } from "../src/lib/catalog-input.ts";
import { modCategorySlugs } from "../src/lib/estimate.ts";
test("catalog: nháp chưa có giá; không publish thiếu giá hoặc gán gói sai loại", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Lube layout 75",
    category: "lube",
    type: "service",
    unit: "gói",
    lubePackage: "layout_75",
    price: "",
    cost: "0",
  }))
    form.set(key, value);
  assert.equal(parseCatalogInput(form).price, null);
  form.set("active", "on");
  assert.throws(() => parseCatalogInput(form), /Nhập giá bán/);
  form.set("price", "200000");
  assert.equal(parseCatalogInput(form).price, 200000);
  form.set("type", "product");
  assert.throws(() => parseCatalogInput(form), /Gói lube/);
  for (const value of ["1.5", "-1", "1e3", "abc", "1000000001"])
    assert.throws(() => integerInput(value, 0, 1000000000, "Giá"));
});

test("catalog: công khai dịch vụ vệ sinh phím và không cho gán gói lube", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Vệ sinh phím",
    category: "cleaning",
    type: "service",
    unit: "gói",
    price: "150000",
    active: "on",
  }))
    form.set(key, value);
  const input = parseCatalogInput(form);
  assert.equal(input.category, "cleaning");
  assert.equal(input.type, "service");
  assert.equal(input.unit, "gói");
  assert.equal(input.price, 150000);
  assert.equal(input.active, true);
  form.set("lubePackage", "layout_75");
  assert.throws(() => parseCatalogInput(form), /Gói lube/);
});

test("estimate: nhóm dịch vụ mod chứa vệ sinh phím", () => {
  assert.ok(modCategorySlugs.includes("cleaning"));
});
