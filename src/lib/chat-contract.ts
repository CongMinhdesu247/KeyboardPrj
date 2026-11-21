import { createHash, randomBytes } from "node:crypto";
export type ChatTurn = {
  id: string;
  customer: string;
  assistant: string | null;
  mode: "ai" | "fallback" | null;
  status: "pending" | "done";
  createdAt: string;
};
export function newChatToken() {
  return randomBytes(32).toString("hex");
}
export function chatHash(token: string) {
  return /^[a-f0-9]{64}$/.test(token)
    ? createHash("sha256").update(`chat-v1:${token}`).digest("hex")
    : null;
}
export function consultationOpen(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 8 && hour < 22;
}
export const fallbackReply =
  "Mình chưa có đủ thông tin để tư vấn chính xác lúc này. Bạn xem giá đang công khai ở Cửa hàng hoặc liên hệ Zalo để shop kiểm tra cấu hình, giá và thời gian thực hiện. Đây chưa phải xác nhận đơn hay thanh toán.";
export function redactForAI(text: string) {
  return text
    .replace(/TK-[A-F0-9]{32}/gi, "[mã đơn đã ẩn]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email đã ẩn]")
    .replace(/(?:\+?\d[\s().-]*){9,16}/g, "[số liên hệ đã ẩn]");
}
