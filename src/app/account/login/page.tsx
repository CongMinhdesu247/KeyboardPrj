import Link from "next/link";
import { customerGoogleLogin } from "../actions";
import { readAuthConfig } from "@/lib/auth-config";
export const metadata={title:"Đăng nhập khách hàng",robots:{index:false,follow:false}};
export default async function CustomerLogin({searchParams}:{searchParams:Promise<{status?:string;checkout?:string;item?:string;quantity?:string}>}) {
  const {status,checkout,item,quantity}=await searchParams;
  const messages:Record<string,string>={session:"Đăng nhập Google để tiếp tục.",setup:"Shop chưa cấu hình đăng nhập.",oauth_failed:"Chưa đăng nhập được. Hãy thử lại.",banned:"Tài khoản đã bị cấm. Liên hệ shop nếu cần hỗ trợ.",deleted:"Tài khoản đã bị xóa quyền truy cập. Liên hệ shop để được hỗ trợ.",restricted:"Tài khoản hiện không được phép truy cập. Liên hệ shop để được hỗ trợ."};
  return <main id="main" className="container page-container auth-page"><Link href="/shop" className="back-link">← Về cửa hàng</Link><h1>Tài khoản khách hàng</h1><p className="page-lead">Đăng nhập để đặt hàng và xem các đơn của bạn.</p><section className="info-panel"><h2>Đăng nhập hoặc đăng ký</h2><p>Lần đầu dùng Google, tài khoản khách sẽ được tạo tự động.</p>{status && messages[status] && <p role="alert" className="auth-feedback">{messages[status]}</p>}<form action={customerGoogleLogin}><input type="hidden" name="checkout" value={checkout==="1"?"on":"off"}/><input type="hidden" name="item" value={item??""}/><input type="hidden" name="quantity" value={quantity??"1"}/><button className="button button-primary full-width" disabled={!readAuthConfig(process.env)}>Tiếp tục với Google</button></form><p>Đăng nhập không cấp quyền quản trị. Xem <Link href="/privacy">thông tin riêng tư</Link>.</p></section></main>;
}
