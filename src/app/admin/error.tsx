"use client";
import Link from "next/link";
export default function AdminError({retry}:{retry:()=>void}) {
 return <main id="main" className="container page-container"><section className="admin-panel" role="alert"><h1>Chưa tải được dữ liệu quản trị</h1><p>Kiểm tra kết nối rồi thử lại. Nếu phiên đã hết hạn, hãy đăng nhập lại.</p><div className="form-actions"><button className="button button-primary" onClick={()=>retry()}>Thử lại</button><Link className="button button-outline" href="/admin/login">Đăng nhập lại</Link></div></section></main>;
}
