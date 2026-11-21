"use client";
import {useActionState,useState} from "react";
import {BannerCrop} from "./banner-crop";
import {saveBanner} from "@/app/admin/banners/actions";
import type {Banner,BannerState} from "@/lib/banner-contract";
import {ShopImage} from "./shop-image";
import {FormError} from "./form-error";
export function BannerEditor({banner,products,baseUrl}:{banner:Banner;products:{id:string;name:string}[];baseUrl:string}) {
 const [expanded,setExpanded]=useState(!!banner.title);
 const [draft,setDraft]=useState({title:banner.title,subtitle:banner.subtitle,product:String(banner.product_id??""),active:banner.active});
 const [state,action,pending]=useActionState(async(previous:BannerState,form:FormData):Promise<BannerState>=>{
  try{const result=await saveBanner(previous,form);if(result.ok&&result.banner)setDraft({title:result.banner.title,subtitle:result.banner.subtitle,product:String(result.banner.product_id??""),active:result.banner.active});return result;}
  catch{return {message:"Mất kết nối. Nội dung đang nhập vẫn được giữ; kiểm tra banner rồi thử lại.",version:previous.version,banner:previous.banner};}
 },{});
 const current=state.banner&&state.banner.version>=banner.version?state.banner:banner;
 return <details className="banner-editor" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary><span>Banner {banner.slot}</span><span>{current.title||"Chưa thiết lập"}</span><span>{current.active?"Công khai":"Đang ẩn"}</span></summary><form action={action} onReset={e=>e.preventDefault()}>
  <input type="hidden" name="slot" value={banner.slot}/><input type="hidden" name="version" value={current.version}/>
  <fieldset disabled={pending} className="banner-fields"><legend className="visually-hidden">Chỉnh sửa banner {banner.slot}</legend>
   <div className="banner-admin-preview">{current.image_path?<ShopImage src={`${baseUrl}/storage/v1/object/public/home-banners/${encodeURIComponent(current.image_path)}`} alt={current.title||`Ảnh banner ${banner.slot}`} width={1280} height={480}/>:<p>Chưa có ảnh banner</p>}</div>
   <label>Tiêu đề banner<input aria-label="Tiêu đề banner" name="title" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} maxLength={120} placeholder="Tên sản phẩm hoặc bộ sưu tập…"/></label>
   <label>Mô tả ngắn<textarea aria-label="Mô tả ngắn" name="subtitle" value={draft.subtitle} onChange={e=>setDraft({...draft,subtitle:e.target.value})} maxLength={240} rows={2}/></label>
   <BannerCrop key={current.version} existing={current.image_path?`${baseUrl}/storage/v1/object/public/home-banners/${encodeURIComponent(current.image_path)}`:undefined}/>
   <label>Sản phẩm liên kết<select aria-label="Sản phẩm liên kết" name="product" value={draft.product} onChange={e=>setDraft({...draft,product:e.target.value})}><option value="">Chọn sản phẩm</option>{current.product_id&&!products.some(p=>p.id===String(current.product_id))&&<option value={current.product_id}>Sản phẩm đã ẩn/ngừng bán — chọn lại trước khi công khai</option>}{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label className="check-label"><input type="checkbox" name="active" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Công khai trên trang chủ</label>
   <div className="form-actions"><button className="button button-primary" type="submit">{pending?"Đang lưu…":"Lưu banner"}</button></div>
   <details className="banner-remove"><summary>Gỡ nội dung banner này</summary><p>Gỡ ảnh, chữ và liên kết khỏi vị trí này. Không xóa sản phẩm.</p><label className="check-label"><input type="checkbox" name="clear"/>Tôi muốn gỡ toàn bộ nội dung banner này</label><button className="button button-outline" type="submit" name="intent" value="clear">Xác nhận gỡ banner</button></details>
  </fieldset>
  {state.ok?<p role="status" className="auth-feedback">{state.message}</p>:<FormError message={state.message} pending={pending}/>}
 </form></details>;
}
