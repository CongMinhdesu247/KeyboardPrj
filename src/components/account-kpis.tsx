import type { AccountGrowth } from "@/lib/accounts-contract";

export function AccountKpis({ data }: { data: AccountGrowth }) {
  const rate = data.registered
    ? (data.active30 / data.registered) * 100
    : 0;
  const metrics = [
    ["Tổng tài khoản", data.registered.toLocaleString("vi-VN"), "Tất cả đã đăng ký"],
    ["Hoạt động 30 ngày", data.active30.toLocaleString("vi-VN"), "Có truy cập gần đây"],
    ["Mới tháng này", data.new_month.toLocaleString("vi-VN"), "Từ đầu tháng"],
    [
      "Tỷ lệ hoạt động",
      `${rate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`,
      "Hoạt động / tổng đăng ký",
    ],
  ];
  return (
    <dl className="dashboard-kpis">
      {metrics.map(([label, value, note]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          <p>{note}</p>
        </div>
      ))}
    </dl>
  );
}
