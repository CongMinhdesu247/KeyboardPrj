// Shop's receiving account supplied by the owner. This is public payment information.
export const receivingBank = Object.freeze({
  bankName: "Agribank",
  bankBin: "970405",
  accountNumber: "1500200768268",
  accountName: "NGUYEN CONG MINH",
  branch: "Chi nhánh TP Hà Nội",
});
export type TransferState = {
  available?: boolean;
  plan: "deposit_cod" | "transfer_full";
  total: number;
  deposit: number;
  received: number;
  reference: string;
  cancelled: boolean;
};
export type BankPayment = {
  status:
    | "confirmation_required"
    | "awaiting_transfer"
    | "deposit_received"
    | "paid"
    | "cancelled";
  amount: number;
  remaining: number;
  reference: string;
  plan: TransferState["plan"];
  qrDataUrl?: string;
};

export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function tlv(id: string, value: string) {
  const size = new TextEncoder().encode(value).length;
  if (size > 99) throw new Error("QR field too long");
  return id + String(size).padStart(2, "0") + value;
}
export function createVietQrPayload({
  bankBin,
  accountNumber,
  amount,
  reference,
}: {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  reference?: string;
}) {
  if (!/^\d{6}$/.test(bankBin) || !/^\d{6,19}$/.test(accountNumber))
    throw new Error("Invalid receiving account");
  if (
    amount !== undefined &&
    (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000000)
  )
    throw new Error("Invalid transfer amount");
  if (reference !== undefined && !/^[A-Za-z0-9 ]{1,25}$/.test(reference))
    throw new Error("Invalid transfer reference");
  const beneficiary = tlv("00", bankBin) + tlv("01", accountNumber);
  const merchant =
    tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const content =
    tlv("00", "01") +
    tlv("01", amount === undefined ? "11" : "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (amount === undefined ? "" : tlv("54", String(amount))) +
    tlv("58", "VN") +
    (reference ? tlv("62", tlv("08", reference)) : "") +
    "6304";
  return content + crc16(content);
}
export function bankPaymentIntent(s: TransferState): BankPayment {
  if (
    ![s.total, s.deposit, s.received].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    ) ||
    s.total < 1 ||
    s.total > 1000000000000 ||
    s.deposit !== Math.ceil(s.total / 5) ||
    s.received > s.total ||
    !/^TK\d{10}$/.test(s.reference) ||
    !["deposit_cod", "transfer_full"].includes(s.plan)
  )
    throw new Error("Invalid order payment state");
  const status = s.cancelled
    ? "cancelled"
    : s.received >= s.total
      ? "paid"
      : s.received > 0
        ? "deposit_received"
        : s.available === false
          ? "confirmation_required"
          : "awaiting_transfer";
  return {
    status,
    amount:
      status === "awaiting_transfer"
        ? s.plan === "deposit_cod"
          ? s.deposit
          : s.total
        : 0,
    remaining: s.total - s.received,
    reference: s.reference,
    plan: s.plan,
  };
}
