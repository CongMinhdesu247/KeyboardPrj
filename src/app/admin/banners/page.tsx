import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
import {readAuthConfig} from "@/lib/auth-config";
import {BannerEditor} from "@/components/banner-editor";
import type {Banner} from "@/lib/banner-contract";
export default async function BannersPage() {
 const {client}=await requireAdmin();
 const [banners,products]=await Promise.all([
  client.from("home_banners").select("slot,title,subtitle,image_path,product_id,active,version").order("slot"),
  client.from("products_services").select("id,name,service_categories!inner(active)").eq("active",true).eq("service_categories.active",true).is("archived_at",null).not("price_vnd","is",null).order("name"),
 ]);
 if(banners.error||products.error)throw new Error("Chưa tải được banner hoặc sản phẩm. Hãy thử lại.");
 return <main id="main" className="container page-container banners-admin"><div className="tracking-heading"><div><h1>Banner trang chủ</h1><p>Tối đa 5 banner, hiển thị theo thứ tự 1–5. Mở từng vị trí để chỉnh ảnh và sản phẩm nổi bật.</p></div><Link href="/" target="_blank" className="button button-outline">Xem trang chủ</Link></div><p className="readiness-notice">Chỉ banner công khai có ảnh, tiêu đề và sản phẩm đang bán mới hiển thị. Nếu sản phẩm bị ẩn hoặc lưu trữ, banner sẽ tự ẩn khỏi trang khách. Khi chưa có banner, trang chủ giữ phần giới thiệu hiện tại.</p><div className="banner-editors">{banners.data.map(b=><BannerEditor key={b.slot} banner={b as Banner} baseUrl={readAuthConfig(process.env)!.url} products={products.data.map(p=>({id:String(p.id),name:p.name}))}/>)}</div></main>;
}
