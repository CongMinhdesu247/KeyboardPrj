import Link from "next/link";
import { requireCustomerAccount } from "@/lib/customer-account";
import { AccountShell } from "@/components/account-shell";
import { money,orderStages } from "@/lib/order-contract";
import { formatDate } from "@/lib/tracking";
export const dynamic = "force-dynamic";
export const metadata={title:"Đơn mua",robots:{index:false,follow:false}};
type MyOrder={code:string;keyboard:string;total_vnd:number;stage:0|1|2;cancelled_at:string|null;created_at:string};
export default async function AccountPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const {client,account}=await requireCustomerAccount(),params=await searchParams;
  const page=/^\d{1,5}$/.test(params.page??"")?Math.max(1,Number(params.page)):1;
  const result=await client.rpc("my_orders",{p_offset:(page-1)*20});
  if(result.error)throw new Error("Chưa tải được đơn hàng. Hãy thử lại.");
  const data=result.data as unknown as {total:number;orders:MyOrder[]};
  return <AccountShell account={account} selected="orders"><section className="profile-panel"><h1>Đơn mua của bạn</h1><p className="muted">{data.total} đơn hàng</p>{!data.orders.length?<div className="store-empty"><p>Chưa có đơn hàng gắn với tài khoản này.</p><p>Đơn trước khi đăng ký vẫn tra cứu bằng mã riêng; không tự ghép theo tên hoặc số điện thoại.</p><Link className="button button-primary" href="/shop">Mua sắm</Link></div>:<div className="customer-orders">{data.orders.map(order=><Link key={order.code} href={`/track/${order.code}`} className="customer-order"><strong>{order.keyboard}</strong><span>{order.cancelled_at?"Đã hủy":orderStages[order.stage]}</span><strong>{money(order.total_vnd)}</strong><time>{formatDate(order.created_at)}</time><span>Xem tiến độ & thanh toán →</span></Link>)}</div>}<nav className="account-pagination" aria-label="Trang đơn hàng">{page>1&&<Link href={`/account/orders?page=${page-1}`}>← Trang trước</Link>}<span>Trang {page}</span>{page*20<data.total&&<Link href={`/account/orders?page=${page+1}`}>Trang sau →</Link>}</nav></section></AccountShell>;
}
