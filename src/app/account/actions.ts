"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { readAuthConfig } from "@/lib/auth-config";
import { readAccount } from "@/lib/customer-account";
import { revalidatePath } from "next/cache";
import { validateProfile,type ProfileState } from "@/lib/profile";
export async function customerGoogleLogin(form:FormData) {
  const config=readAuthConfig(process.env);
  if (!config) redirect("/account/login?status=setup");
  const target=form.get("checkout")==="on"?"checkout":"customer";
  const jar=await cookies(),options={httpOnly:true,sameSite:"lax" as const,secure:config.secure,path:"/",maxAge:600};
  jar.set("tk-login-intent",target,options);
  const item=String(form.get("item")??""),quantity=String(form.get("quantity")??"1");
  jar.set("tk-checkout-return",target==="checkout" && /^[1-9]\d{0,14}$/.test(item) && /^[1-9]\d?$/.test(quantity)?`/checkout?item=${item}&quantity=${quantity}`:"/checkout",options);
  const client=await createAuthClient({writeCookies:true});
  const result=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${config.origin}/auth/callback`,queryParams:{prompt:"select_account"}}});
  if (result.error || !result.data.url) redirect("/account/login?status=oauth_failed");
  redirect(result.data.url);
}
export async function customerLogout() {
  const client=await createAuthClient({writeCookies:true});
  const result=await client.auth.signOut({scope:"local"});
  if (result.error) throw new Error("Chưa đăng xuất được. Hãy thử lại.");
  redirect("/account/login");
}
export async function saveCustomerProfile(_previous:ProfileState,form:FormData):Promise<ProfileState> {
  const context=await readAccount();
  if(!context||context.account.status!=="active")return {message:"Phiên đăng nhập không còn hiệu lực. Đăng nhập lại để lưu hồ sơ."};
  const {profile,errors}=validateProfile(form),version=Number(form.get("version"));
  if(Object.keys(errors).length)return {message:"Kiểm tra lại thông tin được đánh dấu.",errors};
  if(!Number.isSafeInteger(version)||version<1)return {message:"Hồ sơ chưa được tải đầy đủ. Hãy tải lại trang."};
  const result=await context.client.rpc("update_customer_profile",{p_name:profile.name,p_phone:profile.phone,p_address:profile.address,p_version:version});
  const data=result.data as ProfileState & {code?:string};
  if(result.error||!data?.ok)return {message:data?.code==="conflict"?"Hồ sơ đã thay đổi ở nơi khác. Tải lại trang trước khi sửa tiếp.":"Chưa lưu được hồ sơ. Thông tin đang nhập vẫn được giữ; hãy thử lại."};
  revalidatePath("/account");revalidatePath("/checkout");revalidatePath("/admin/customers");
  return {ok:true,message:"Đã lưu thông tin cá nhân.",version:data.version,profile:data.profile};
}
