"use server";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {revalidatePath} from "next/cache";
import {requireAdmin} from "@/lib/auth";
import type {Banner,BannerState} from "@/lib/banner-contract";
import {parseBannerCrop,type BannerCropRect} from "@/lib/banner-crop";
export async function saveBanner(_previous:BannerState,form:FormData):Promise<BannerState> {
 const {client}=await requireAdmin();
 const slot=Number(form.get("slot")),version=Number(form.get("version")),clear=form.get("intent")==="clear";
 if(clear&&form.get("clear")!=="on")return {message:"Đánh dấu xác nhận trước khi gỡ banner."};
 if(!Number.isInteger(slot)||slot<1||slot>5||!Number.isSafeInteger(version)||version<1)return {message:"Banner không hợp lệ. Tải lại trang."};
 const old=await client.from("home_banners").select("slot,title,subtitle,image_path,product_id,active,version").eq("slot",slot).single();
 if(old.error)return {message:"Chưa đọc được banner. Hãy thử lại."};
 if(old.data.version!==version)return {message:"Banner đã được sửa ở nơi khác. Tải lại trang trước khi lưu."};
 const title=String(form.get("title")??"").trim(),subtitle=String(form.get("subtitle")??"").trim(),rawProduct=String(form.get("product")??""),product=rawProduct?Number(rawProduct):null,active=form.get("active")==="on";
 if(!clear&&(title.length>120||subtitle.length>240||(product!==null&&(!Number.isSafeInteger(product)||product<1))))return {message:"Kiểm tra tên, mô tả và sản phẩm của banner."};
 let path=clear?null:old.data.image_path,uploaded:string|undefined;
 const clean=async(asset:string)=>{
  const refs=await client.from("home_banners").select("slot").eq("image_path",asset).limit(1);
  if(!refs.error&&!refs.data.length)await client.storage.from("home-banners").remove([asset]);
 };
 const file=form.get("image");
 const rawCrop=form.get("crop");
 let crop:BannerCropRect|undefined;
 if(!clear&&rawCrop){
  try{
   crop=parseBannerCrop(rawCrop);
  }catch{return {message:"Khung cắt ảnh không hợp lệ. Căn lại ảnh rồi thử lại."};}
 }
 if(!clear&&((file instanceof File&&file.size)||crop)){
  if(file instanceof File&&file.size&&(file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)))return {message:"Ảnh JPEG/PNG/WebP tối đa 5 MB."};
  try{
   let input:Buffer;
   if(file instanceof File&&file.size)input=Buffer.from(await file.arrayBuffer());
   else {
    if(!old.data.image_path)return {message:"Chọn ảnh trước khi căn khung banner."};
    const stored=await client.storage.from("home-banners").download(old.data.image_path);
    if(stored.error||!stored.data||stored.data.size>5*1024*1024)return {message:"Chưa đọc được ảnh hiện tại. Hãy chọn lại ảnh từ máy."};
    input=Buffer.from(await stored.data.arrayBuffer());
   }
   const meta=await sharp(input,{limitInputPixels:20000000}).metadata();
   if(!["jpeg","png","webp"].includes(meta.format??"")||(meta.pages??1)>1)return {message:"Chỉ nhận ảnh tĩnh hợp lệ, tối đa 20 megapixel."};
   const oriented=await sharp(input,{limitInputPixels:20000000}).rotate().toBuffer({resolveWithObject:true});
   if(crop&&(crop.left+crop.width>oriented.info.width||crop.top+crop.height>oriented.info.height))return {message:"Vùng cắt vượt quá ảnh gốc. Hãy căn lại ảnh."};
   let pipeline=sharp(oriented.data,{limitInputPixels:20000000});
   if(crop)pipeline=pipeline.extract(crop);
   const bytes=await pipeline.resize(1920,1920,{fit:"inside",withoutEnlargement:true}).webp({quality:86}).toBuffer();
   uploaded=`${randomUUID()}.webp`;
   const stored=await client.storage.from("home-banners").upload(uploaded,bytes,{contentType:"image/webp",upsert:false});
   if(stored.error)return {message:"Chưa tải được ảnh. Nội dung đang nhập vẫn được giữ."};
   path=uploaded;
  }catch{return {message:"Không đọc được ảnh. Chọn ảnh tĩnh tối đa 5 MB/20 megapixel."};}
 }
 const result=await client.rpc("save_home_banner",{p_slot:slot,p_version:version,p_title:title,p_subtitle:subtitle,p_image:path??"",p_product:product??0,p_active:active,p_clear:clear});
 const fresh=await client.from("home_banners").select("slot,title,subtitle,image_path,product_id,active,version").eq("slot",slot).single();
 const matches=fresh.data&&(clear?!fresh.data.active&&!fresh.data.image_path&&!fresh.data.title:fresh.data.title===title&&fresh.data.subtitle===subtitle&&fresh.data.image_path===path&&fresh.data.product_id===product&&fresh.data.active===active);
 const outcome=result.data as {ok?:boolean;code?:string}|null;
 if(result.error||!outcome?.ok){
  if(!matches){
   if(uploaded&&!fresh.error)await clean(uploaded);
   return {message:outcome?.code==="incomplete"?"Cần tiêu đề, ảnh và sản phẩm trước khi công khai.":outcome?.code==="unavailable"?"Chọn sản phẩm đang công khai và có giá.":"Chưa lưu được hoặc banner vừa thay đổi. Kiểm tra dữ liệu rồi thử lại."};
  }
 }
 if(fresh.error)return {message:"Đã xử lý nhưng chưa đọc lại được banner. Tải lại trang để kiểm tra trước khi gửi tiếp."};
 if(old.data.image_path&&old.data.image_path!==fresh.data.image_path)await clean(old.data.image_path);
 revalidatePath("/");revalidatePath("/admin/banners");
 return {ok:true,message:clear?"Đã gỡ banner khỏi trang chủ.":"Đã lưu banner.",version:fresh.data.version,banner:fresh.data as Banner,cleared:clear};
}
