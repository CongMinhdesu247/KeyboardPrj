import test from "node:test";
import assert from "node:assert/strict";
import { getBannerCrop, parseBannerCrop } from "../src/lib/banner-crop.ts";

test("banner crop: portrait/landscape/zoom and every edge stay within the source at 3:2", () => {
  for (const [width, height] of [[1920, 720], [720, 1920], [1001, 667], [600, 600], [3, 2]]) {
    for (const zoom of [1, 1.01, 1.4, 3]) for (const x of [0, 50, 100]) for (const y of [0, 50, 100]) {
      const crop = getBannerCrop(width, height, zoom, x, y);
      assert.ok(crop.left >= 0 && crop.top >= 0);
      assert.ok(crop.left + crop.width <= width && crop.top + crop.height <= height);
      assert.deepEqual(parseBannerCrop(JSON.stringify(crop)), crop);
    }
  }
  assert.deepEqual(getBannerCrop(1920, 720, 1, 100, 50), { left: 840, top: 0, width: 1080, height: 720 });
  assert.equal(parseBannerCrop(""), undefined); assert.equal(parseBannerCrop(null), undefined);
  for (const invalid of ["not json", "null", "[]", "1", "{}", JSON.stringify({ left: -1, top: 0, width: 300, height: 200 }), JSON.stringify({ left: 0, top: 0, width: 300, height: 100 }), JSON.stringify({ left: 0.1, top: 0, width: 300, height: 200 }), "x".repeat(301), new Blob()]) {
    assert.throws(() => parseBannerCrop(invalid), /Khung cắt/);
  }
});
