export type ReportQuery = Record<string, string | string[] | undefined>;
export function vietnamDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= "1900-01-01" &&
    s <= "2100-12-31" &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function reportFilters(q: ReportQuery, now = new Date()) {
  const today = vietnamDate(now),
    read = (key: string, fallback: string) => {
      const v = q[key];
      if (Array.isArray(v)) throw new Error("Mỗi bộ lọc chỉ nhận một giá trị.");
      return v ?? fallback;
    };
  const from = read("from", today.slice(0, 7) + "-01"),
    to = read("to", today),
    group = read("group", "day"),
    page = Number(read("page", "1"));
  if (
    !validDate(from) ||
    !validDate(to) ||
    to < from ||
    (Date.parse(to) - Date.parse(from)) / 86400000 > 365
  )
    throw new Error(
      "Chọn khoảng ngày hợp lệ, tối đa 366 ngày, từ năm 1900 đến 2100.",
    );
  if (
    !["day", "month"].includes(group) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000000
  )
    throw new Error("Cách nhóm hoặc số trang không hợp lệ.");
  return { from, to, group, page };
}
export function reportMoney(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}
export function reportUrl(f: {
  from: string;
  to: string;
  group: string;
  page?: number;
}) {
  return `/admin/reports?${new URLSearchParams({ from: f.from, to: f.to, group: f.group, page: String(f.page ?? 1) })}`;
}
export type CashReport = {
  from: string;
  to: string;
  group: "day" | "month";
  page: number;
  pageSize: number;
  generatedAt: string;
  received: string;
  refunded: string;
  net: string;
  transactionCount: number;
  orderCount: number;
  series: {
    bucket: string;
    received: string;
    refunded: string;
    net: string;
    transactions: number;
  }[];
  transactions: {
    id: string;
    orderId: string;
    reference: string;
    keyboard: string;
    kind: "receipt" | "refund";
    amount: string;
    at: string;
    cancelled: boolean;
  }[];
  pending: {
    count: number;
    amount: string;
    readyCount: number;
    readyAmount: string;
    refundCount: number;
    refundAmount: string;
    items: {
      orderId: string;
      reference: string;
      keyboard: string;
      stage: 0 | 1 | 2;
      remaining: string;
    }[];
  };
};
