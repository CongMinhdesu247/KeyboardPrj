import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { AccountGrowth, AccountReport } from "@/lib/accounts-contract";
import { AccountControls } from "@/components/account-controls";
import { AccountKpis } from "@/components/account-kpis";
import { formatDate } from "@/lib/tracking";

export default async function CustomersPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}) {
 const {client}=await requireAdmin(), params=await searchParams;
 const q=(params.q??"").slice(0,120);
 const status=["active","banned","deleted","customer","admin"].includes(params.status??"")?params.status!:"all";
 const page=/^\d{1,5}$/.test(params.page??"")?Math.max(1,Number(params.page)):1;
 const [result,growth]=await Promise.all([
  client.rpc("account_report",{p_query:q,p_status:status,p_offset:(page-1)*20}),
  client.rpc("account_growth"),
 ]);
 if(result.error) throw new Error("Chưa tải được tài khoản. Hãy thử lại.");
 const data=result.data as unknown as AccountReport, pages=Math.max(1,Math.ceil(data.matched/20));
 const url=(p:number)=>`/admin/customers?${new URLSearchParams({q,status,page:String(p)})}`;
 return <main id="main" className="container page-container accounts-admin">
  <div className="tracking-heading"><div><h1>Tài khoản người dùng</h1><p>Tìm khách hàng, kiểm tra quyền truy cập và quản lý tài khoản.</p></div><Link href="/admin/team" className="button button-outline">Quản trị viên & mã mời</Link></div>
  {!growth.error&&growth.data&&<AccountKpis data={growth.data as unknown as AccountGrowth}/>}
  {growth.error&&<p role="alert">Chưa tải được chỉ số tài khoản. Danh sách bên dưới vẫn sử dụng được.</p>}
  <section className="admin-panel accounts-panel" aria-labelledby="accounts-title">
   <div className="admin-panel-heading"><h2 id="accounts-title">Danh sách tài khoản</h2><span className="admin-muted">{data.customers} khách hàng · {data.admins} quản trị viên</span></div>
   <form method="get" className="account-filters"><label>Tìm tên hoặc email<input type="search" name="q" defaultValue={q} maxLength={120} placeholder="Nhập tên hoặc email…"/></label><label>Loại / trạng thái<select name="status" defaultValue={status}>{[["all","Tất cả hiện có"],["customer","Khách hàng"],["admin","Quản trị viên"],["active","Được phép sử dụng"],["banned","Bị cấm"],["deleted","Đã xóa quyền truy cập"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button button-primary">Lọc tài khoản</button></form>
   <p className="admin-muted">{data.matched.toLocaleString("vi-VN")} tài khoản phù hợp · Trang {page} / {pages}. “Được phép sử dụng” là quyền truy cập, không phải đang online.</p>
   {!data.accounts.length?<div className="admin-empty"><h3>{q||status!=="all"?"Không có tài khoản phù hợp":"Chưa có tài khoản"}</h3><p>{q||status!=="all"?"Thử từ khóa khác hoặc bỏ bộ lọc để xem thêm tài khoản.":"Tài khoản sẽ xuất hiện khi người dùng đăng ký qua Google."}</p>{(q||status!=="all")&&<Link href="/admin/customers">Xóa bộ lọc</Link>}{page>1&&<p><Link href={url(1)}>Về trang đầu</Link></p>}</div>:
    <div className="accounts-table-scroll" tabIndex={0} role="region" aria-label="Bảng tài khoản, cuộn ngang để xem thêm"><table className="accounts-table"><caption className="sr-only">Tài khoản theo ngày đăng ký mới nhất</caption><thead><tr><th scope="col">Người dùng</th><th scope="col">Quyền / trạng thái</th><th scope="col">Đăng ký / truy cập gần nhất</th><th scope="col">Đơn hàng</th><th scope="col">Thao tác</th></tr></thead><tbody>{data.accounts.map(a=><tr key={a.id} className="managed-account">
     <td><strong>{a.name||(a.role==="admin"?"Quản trị viên":"Khách hàng")}</strong><span className="account-email">{a.email}</span>{a.reason&&<details><summary>Lý do gần nhất</summary><p>{a.reason}</p></details>}</td>
     <td><span className={`account-status account-status-${a.status}`}>{a.status==="active"?"Được phép sử dụng":a.status==="banned"?"Bị cấm":"Đã xóa quyền truy cập"}</span><span className="account-role">{a.role==="admin"?"Quản trị viên":"Khách hàng"}</span></td>
     <td><span>{formatDate(a.registered_at)}</span><span className="account-last-seen">{a.last_seen_at?formatDate(a.last_seen_at):"Chưa ghi nhận truy cập"}</span></td>
     <td><Link href={`/admin/orders?customer=${a.id}`}>Xem {a.order_count} đơn của tài khoản</Link></td>
     <td>{a.role==="admin"?<Link href="/admin/team">Quản lý quyền</Link>:a.status==="deleted"?<span className="admin-muted">Đã khóa vĩnh viễn</span>:<AccountControls account={a}/>}</td>
    </tr>)}</tbody></table></div>}
   <nav className="account-pagination" aria-label="Trang tài khoản">{page>1?<Link className="button button-outline" href={url(page-1)}>← Trang trước</Link>:<span className="admin-muted">Trang đầu</span>}<span aria-current="page">Trang {page} / {pages}</span>{page*20<data.matched?<Link className="button button-outline" href={url(page+1)}>Trang sau →</Link>:<span className="admin-muted">Hết danh sách</span>}</nav>
  </section>
 </main>;
}
