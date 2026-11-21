import "server-only";
import {createClient} from "@supabase/supabase-js";
import {readAuthConfig} from "./auth-config";
import type {Database} from "./database.types";
import type {PublicBanner} from "./banner-contract";
export function bannerImageUrl(base:string,path:string) {return `${base}/storage/v1/object/public/home-banners/${encodeURIComponent(path)}`;}
export async function readPublicBanners():Promise<PublicBanner[]> {
 const config=readAuthConfig(process.env);if(!config)return [];
 const client=createClient<Database>(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
 const {data,error}=await client.from("home_banners").select("slot,title,subtitle,image_path,product_id").eq("active",true).order("slot");
 if(error)throw new Error("Chưa tải được banner trang chủ. Hãy thử lại.");
 return data.flatMap(b=>b.image_path&&b.product_id?[{slot:b.slot,title:b.title,subtitle:b.subtitle,imageUrl:bannerImageUrl(config.url,b.image_path),productId:String(b.product_id)}]:[]);
}
