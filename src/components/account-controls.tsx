"use client";
import { useActionState,useEffect,useRef,useState } from "react";
import type { ManagedAccount } from "@/lib/accounts-contract";
import { manageAccount } from "@/app/admin/customers/actions";
export function AccountControls({account}:{account:ManagedAccount}) {
  const dialog=useRef<HTMLDialogElement>(null),[operation,setOperation]=useState("ban");
  const [result,action,pending]=useActionState(manageAccount,{message:""});
  useEffect(()=>{if(result.ok)dialog.current?.close();},[result]);
  if(account.role==="admin"||account.status==="deleted")return null;
  const label=operation==="delete"?"Xóa tài khoản":operation==="ban"?"Cấm tài khoản":"Bỏ cấm tài khoản";
  const open=(value:string)=>{setOperation(value);dialog.current?.querySelector("form")?.reset();dialog.current?.showModal();};
  return <><div className="account-row-actions"><button type="button" className="button button-outline" onClick={()=>open(account.status==="banned"?"unban":"ban")}>{account.status==="banned"?"Bỏ cấm":"Cấm tài khoản"}</button><button type="button" className="button button-outline" onClick={()=>open("delete")}>Xóa tài khoản</button></div>{result.ok&&<p role="status">{result.message}</p>}<dialog ref={dialog} className="account-dialog" aria-label={label}><h2>{label}</h2><p>{account.email}</p><p>{operation==="delete"?"Tài khoản bị khóa vĩnh viễn và ẩn khỏi danh sách mặc định. Lịch sử đơn hàng, thanh toán và hồ sơ xác thực được giữ; đây không phải xóa toàn bộ dữ liệu cá nhân.":operation==="ban"?"Khách sẽ mất quyền đăng nhập và đặt đơn. Các đơn đang xử lý vẫn được giữ.":"Khách được đăng nhập lại. Không tự khôi phục phiên cũ."}</p><form action={action}><input type="hidden" name="id" value={account.id}/><input type="hidden" name="version" value={account.version}/><input type="hidden" name="action" value={operation}/><label>Lý do<textarea name="reason" required minLength={3} maxLength={500} rows={3}/></label><label className="check-label"><input type="checkbox" name="confirm" required/>Tôi xác nhận {label.toLocaleLowerCase("vi")}</label>{!result.ok&&result.message&&<p role="alert">{result.message}</p>}<div className="form-actions"><button type="submit" disabled={pending} className="button button-primary">{pending?"Đang xử lý…":`Xác nhận ${label.toLocaleLowerCase("vi")}`}</button><button type="button" disabled={pending} className="button button-outline" onClick={()=>dialog.current?.close()}>Đóng</button></div></form></dialog></>;
}
