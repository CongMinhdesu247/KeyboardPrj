import test from "node:test";
import assert from "node:assert/strict";
import {
  caretPositionForDigitIndex,
  formatVndDigits,
  normalizeVndDigits,
} from "../src/lib/number-format.ts";

test("number-format: tách hàng nghìn, hàng triệu bằng dấu chấm", () => {
  assert.equal(formatVndDigits("90000"), "90.000");
  assert.equal(formatVndDigits(90000), "90.000");
  assert.equal(formatVndDigits("1500000"), "1.500.000");
  assert.equal(formatVndDigits("1000000000"), "1.000.000.000");
  assert.equal(formatVndDigits("999"), "999");
  assert.equal(formatVndDigits("1000"), "1.000");
});

test("number-format: chuẩn hóa số 0 đầu, ký tự thừa và giá trị rỗng", () => {
  assert.equal(normalizeVndDigits(""), "");
  assert.equal(normalizeVndDigits("0"), "0");
  assert.equal(normalizeVndDigits("000"), "0");
  assert.equal(normalizeVndDigits("090000"), "90000");
  assert.equal(normalizeVndDigits("90.000 VND"), "90000");
  assert.equal(normalizeVndDigits("abc"), "");
  assert.equal(formatVndDigits(""), "");
  assert.equal(formatVndDigits(null), "");
  assert.equal(formatVndDigits(undefined), "");
  assert.equal(formatVndDigits("0"), "0");
  assert.equal(formatVndDigits("090.000"), "90.000");
});

test("number-format: tính đúng vị trí con trỏ theo chỉ số chữ số", () => {
  assert.equal(caretPositionForDigitIndex("90.000", 0), 0);
  assert.equal(caretPositionForDigitIndex("90.000", 2), 2);
  assert.equal(caretPositionForDigitIndex("90.000", 3), 4);
  assert.equal(caretPositionForDigitIndex("90.000", 5), 6);
  assert.equal(caretPositionForDigitIndex("1.500.000", 4), 5);
  assert.equal(caretPositionForDigitIndex("9", 2), 1);
});
