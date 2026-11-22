"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountGrowth } from "@/lib/accounts-contract";

const ranges = [
  [7, "7 ngày"],
  [30, "30 ngày"],
  [90, "3 tháng"],
  [365, "1 năm"],
] as const;

const dateLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(parsed);
};

export function AccountGrowthChart({ data }: { data: AccountGrowth }) {
  const [days, setDays] = useState(30);
  const [periodic, setPeriodic] = useState(false);
  const points = data.daily.slice(-days);
  const registeredKey = periodic ? "new_registered" : "registered";
  const activeKey = periodic ? "active" : "active30";

  return (
    <section className="admin-panel growth-panel" aria-labelledby="growth-title">
      <div className="growth-heading">
        <div>
          <h3 id="growth-title">Tăng trưởng tài khoản</h3>
          <p className="admin-muted">Theo ngày giờ Việt Nam</p>
        </div>
        <div className="growth-ranges" role="group" aria-label="Khoảng thời gian">
          {ranges.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="growth-toolbar">
        <div className="growth-legend">
          <span>
            <i className="legend-registered" />
            {periodic ? "Đăng ký mới" : "Tổng đăng ký"}
          </span>
          <span>
            <i className="legend-active" />
            {periodic ? "Hoạt động trong ngày" : "Hoạt động 30 ngày"}
          </span>
        </div>
        <div className="growth-mode">
          <label htmlFor="growth-mode">Cách xem</label>
          <select
            id="growth-mode"
            value={periodic ? "daily" : "total"}
            onChange={(e) => setPeriodic(e.target.value === "daily")}
          >
            <option value="total">Tổng đăng ký / hoạt động 30 ngày</option>
            <option value="daily">Đăng ký mới / hoạt động mỗi ngày</option>
          </select>
        </div>
      </div>

      {data.registered === 0 && (
        <p className="admin-empty">Chưa có tài khoản đăng ký.</p>
      )}

      <div
        className="growth-chart"
        role="region"
        aria-label={`Biểu đồ hai đường ${days} ngày. ${periodic ? "Đăng ký mới và tài khoản truy cập mỗi ngày" : "Tổng đăng ký lũy kế và tài khoản hoạt động trong 30 ngày"}. Bảng số liệu có bên dưới.`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 800, height: 260 }}
        >
          <LineChart
            data={points}
            accessibilityLayer
            margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => dateLabel(String(date)).slice(0, 5)}
              minTickGap={38}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              width={40}
              domain={[0, "auto"]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              labelFormatter={(date) => dateLabel(String(date))}
              formatter={(value, name) => [
                Number(value).toLocaleString("vi-VN"),
                name,
              ]}
              filterNull
              contentStyle={{
                borderRadius: 10,
                borderColor: "#e6e8ec",
                boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              }}
            />
            <Line
              type="linear"
              dataKey={registeredKey}
              name={periodic ? "Đăng ký mới" : "Tổng đăng ký"}
              stroke="#b58100"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey={activeKey}
              name={periodic ? "Hoạt động trong ngày" : "Hoạt động 30 ngày"}
              stroke="#0284c7"
              strokeDasharray="6 3"
              strokeWidth={2.25}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="growth-data">
        <summary>Xem số liệu theo ngày</summary>
        <p className="growth-note">
          Lịch sử bắt đầu {dateLabel(data.coverage_start)}. Dấu — là chưa có dữ liệu.
        </p>
        <div className="account-chart-data">
          <table>
            <caption>
              Số liệu {days} ngày,{" "}
              {periodic ? "theo ngày" : "lũy kế và hoạt động 30 ngày"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                <th scope="col">{periodic ? "Đăng ký mới" : "Tổng đăng ký"}</th>
                <th scope="col">
                  {periodic ? "Hoạt động trong ngày" : "Hoạt động 30 ngày"}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <th scope="row">{dateLabel(p.date)}</th>
                  <td>{p[registeredKey].toLocaleString("vi-VN")}</td>
                  <td>{p[activeKey]?.toLocaleString("vi-VN") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
