export const orderStages = ["Đang chờ", "Đang xử lý", "Hoàn thành"] as const;
export type OrderLine = {
  item_id: string;
  name: string;
  type: string;
  unit: string;
  quantity: number;
  price_vnd: number;
  cost_vnd: number;
};
export type OrderEvent = {
  id: string;
  kind: string;
  stage: number;
  note: string;
  path: string | null;
  video_url: string | null;
  created_at: string;
};
export type AdminOrder = {
  customer_user_id?: string|null;
  payment_available?: boolean;
  source?: "admin" | "web";
  shipping_address?: string;
  customer_note?: string;
  delivery_method?: "ship" | "pickup";
  payment_reference: string;
  id: string;
  code: string;
  customer_name: string;
  phone: string;
  keyboard: string;
  internal_note: string;
  shipping_note: string;
  plan: "deposit_cod" | "transfer_full";
  total_vnd: number;
  deposit_vnd: number;
  stage: number;
  stock_committed: boolean;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderLine[];
  events: OrderEvent[];
  payments: {
    id: string;
    kind: string;
    amount_vnd: number;
    method: string;
    reference: string;
    created_at: string;
  }[];
};
export type OrderFormState = { message?: string; ok?: boolean };
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export function netReceived(order: Pick<AdminOrder, "payments">) {
  return order.payments.reduce(
    (sum, p) => sum + (p.kind === "receipt" ? p.amount_vnd : -p.amount_vnd),
    0,
  );
}
export function validVideoUrl(input: string) {
  if (!input) return true;
  try {
    const u = new URL(input);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      [
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "tiktok.com",
        "www.tiktok.com",
      ].includes(u.hostname) &&
      u.pathname.length > 1 &&
      input.length <= 500
    );
  } catch {
    return false;
  }
}
export const orderErrors: Record<string, string> = {
  insufficient_stock:
    "Không đủ tồn kho. Chưa ghi nhận tiền và chưa trừ bất kỳ linh kiện nào.",
  catalog_changed:
    "Bảng giá hoặc tồn kho đã thay đổi. Hãy tải lại trang để lấy dữ liệu mới.",
  deposit_required: "Cần ghi nhận đã nhận cọc trước khi bắt đầu xử lý.",
  payment_rule:
    "Lần đầu nhận đúng 20% chuyển khoản hoặc 100% theo phương án đã chọn. COD còn lại chỉ ghi nhận sau hoàn thành và khi shop thực nhận.",
  stage_conflict: "Tiến độ đã thay đổi. Hãy tải lại trang.",
  request_conflict:
    "Yêu cầu này đã được dùng cho dữ liệu khác. Hãy tải lại trang.",
  refund_rule: "Chỉ hoàn tiền đơn đã hủy, tối đa phần thực nhận vượt cọc 20%.",
  cancel_rule: "Chỉ hủy đơn chưa hoàn thành và chưa bị hủy.",
  invalid_returns:
    "Chỉ nhập số linh kiện của shop đã thu hồi, không vượt số đã trừ.",
  cancelled: "Đơn đã hủy, không thể tiếp tục xử lý.",
  already_paid: "Đơn đã thu đủ tiền.",
};
