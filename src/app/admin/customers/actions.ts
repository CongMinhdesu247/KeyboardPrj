"use server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { AccountActionState } from "@/lib/accounts-contract";
export async function manageAccount(_previous:AccountActionState,form:FormData):Promise<AccountActionState> {
  const {client}=await requireAdmin();
  const id=String(form.get("id")),version=Number(form.get("version")),action=String(form.get("action")),reason=String(form.get("reason")??"").trim();
  if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(version)||version<1||!["ban","unban","delete"].includes(action)||reason.length<3||reason.length>500||form.get("confirm")!=="on")return {message:"Kiểm tra lý do và xác nhận thao tác."};
  const result=await client.rpc("manage_account",{p_id:id,p_version:version,p_action:action,p_reason:reason});
  const data=result.data as {ok?:boolean;code?:string}|null;
  if(result.error||!data?.ok)return {message:data?.code==="protected_admin"?"Tài khoản admin được quản lý riêng tại Quản trị viên.":"Chưa cập nhật được hoặc dữ liệu đã thay đổi. Tải lại danh sách và thử lại."};
  revalidatePath("/admin/customers");revalidatePath("/admin");revalidatePath("/account");
  return {ok:true,message:action==="ban"?"Đã cấm tài khoản và thu hồi phiên đăng nhập.":action==="unban"?"Đã bỏ cấm. Khách cần đăng nhập lại.":"Đã xóa quyền truy cập tài khoản; lịch sử đơn và thanh toán được giữ lại."};
}
