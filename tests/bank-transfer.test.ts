import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import {
  crc16,
  createVietQrPayload,
  receivingBank,
  bankPaymentIntent,
} from "../src/lib/bank-transfer.ts";

test("VietQR: supplied Agribank QR and official sample match byte for byte including CRC", () => {
  assert.equal(crc16("123456789"), "29B1");
  assert.equal(
    createVietQrPayload(receivingBank),
    "00020101021138570010A00000072701270006970405011315002007682680208QRIBFTTA53037045802VN6304F344",
  );
  // Exact published VietQR vector, preserving its original letter case.
  const official =
    "00020101021238560010A0000007270126000697041501121133666688880208QRIBFTTA53037045405790005802VN62220818Ung Ho Quy Vac Xin63043ACF";
  assert.equal(crc16(official.slice(0, -4)), "3ACF");
  assert.equal(
    createVietQrPayload({
      bankBin: "970415",
      accountNumber: "113366668888",
      amount: 79000,
      reference: "Ung Ho Quy Vac Xin",
    }),
    official,
  );
});
test("VietQR PNG can be decoded independently; bank/amount/memo are in the payload", async () => {
  const payload = createVietQrPayload({
    ...receivingBank,
    amount: 24001,
    reference: "TK0000000001",
  });
  const png = await QRCode.toBuffer(payload, {
    width: 320,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.equal(decoded?.data, payload);
  assert.ok(payload.includes("540524001"));
  assert.ok(payload.includes("0812TK0000000001"));
  for (const amount of [-1, 0, 1.5, NaN, Infinity, 1000000000001])
    assert.throws(() => createVietQrPayload({ ...receivingBank, amount }));
  for (const reference of ["TK-SECRET", "nội dung", "A".repeat(26)])
    assert.throws(() =>
      createVietQrPayload({ ...receivingBank, amount: 100, reference }),
    );
});
test("Only unpaid active orders offer bank QR; deposit/full/paid/cancelled states", () => {
  const base = {
    plan: "deposit_cod" as const,
    total: 120003,
    deposit: 24001,
    received: 0,
    reference: "TK0000000001",
    cancelled: false,
  };
  assert.equal(bankPaymentIntent(base).amount, 24001);
  assert.equal(
    bankPaymentIntent({ ...base, plan: "transfer_full" }).amount,
    120003,
  );
  assert.equal(
    bankPaymentIntent({ ...base, received: 24001 }).status,
    "deposit_received",
  );
  assert.equal(bankPaymentIntent({ ...base, received: 120003 }).status, "paid");
  assert.equal(
    bankPaymentIntent({ ...base, cancelled: true }).status,
    "cancelled",
  );
  for (const received of [24001, 120003])
    assert.equal(bankPaymentIntent({ ...base, received }).amount, 0);
  assert.throws(() => bankPaymentIntent({ ...base, deposit: 24000 }));
});
