import type { AccountGrowth } from "@/lib/accounts-contract";

export function AccountKpis({data}:{data:AccountGrowth}) {
 const metrics = [
  ["Tổng tài khoản đăng ký",data.registered.toLocaleString("vi-VN"),"Gồm tài khoản bị cấm và đã xóa quyền"],
  ["Tài khoản hoạt động",data.active30.toLocaleString("vi-VN"),"Được phép sử dụng, truy cập trong 30 ngày"],
  ["Đăng ký mới tháng này",data.new_month.toLocaleString("vi-VN"),"Từ đầu tháng theo giờ Việt Nam"],
  ["Tỷ lệ hoạt động",`${(data.registered?data.active30/data.registered*100:0).toLocaleString("vi-VN",{maximumFractionDigits:1})}%`,"Hoạt động 30 ngày / tổng đăng ký"],
 ];
 return <dl className="dashboard-kpis">{metrics.map(([label,value,note])=><div key={label}><dt>{label}</dt><dd>{value}</dd><p>{note}</p></div>)}</dl>;
}
