import "server-only";
import QRCode from "qrcode";
import {
  receivingBank,
  bankPaymentIntent,
  createVietQrPayload,
  type TransferState,
} from "./bank-transfer";
export async function renderBankPayment(state: TransferState) {
  const payment = bankPaymentIntent(state);
  if (payment.status === "awaiting_transfer")
    payment.qrDataUrl = await QRCode.toDataURL(
      createVietQrPayload({
        ...receivingBank,
        amount: payment.amount,
        reference: payment.reference,
      }),
      { width: 320, margin: 4, errorCorrectionLevel: "M" },
    );
  return payment;
}
