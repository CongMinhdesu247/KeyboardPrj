export const inboxLabels: Record<string, string> = {
  order_created: "Có đơn hàng mới",
  order_stage: "Đơn đã chuyển bước",
  order_cancel: "Đơn đã hủy",
  order_receipt: "Đã ghi nhận tiền",
  order_refund: "Đã ghi nhận hoàn tiền",
  request_created: "Có yêu cầu đặt tìm",
  chat_handoff: "Khách cần tư vấn qua Zalo",
};
export type InboxItem = {
  id: string;
  event_type: string;
  entity_id: string;
  created_at: string;
  read_at: string | null;
};
export type AdminInbox = {
  unread: number;
  total: number;
  snapshot_at: string;
  items: InboxItem[];
};
export function inboxHref(item: InboxItem) {
  if (item.event_type.startsWith("order_")) return `/admin/orders/${item.entity_id}`;
  if (item.event_type === "request_created") return `/admin/requests#request-${item.entity_id}`;
  return `/admin/chat/${item.entity_id}`;
}
