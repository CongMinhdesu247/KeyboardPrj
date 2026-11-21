"use client";
import { useActionState,useEffect,useState } from "react";
import type { Account } from "@/lib/customer-account";
import type { ProfileState } from "@/lib/profile";
import { saveCustomerProfile } from "@/app/account/actions";
import { FormError } from "./form-error";
import { ShopIcon } from "./shop-icon";
export function ProfileForm({account}:{account:Account}) {
 const [draft,setDraft]=useState({name:account.name,phone:account.phone,address:account.address});
 const [result,action,pending]=useActionState(async(previous:ProfileState,form:FormData):Promise<ProfileState>=>{
  try {const saved=await saveCustomerProfile(previous,form);if(saved.ok&&saved.profile)setDraft(saved.profile);return saved;}
  catch {return {message:"Mất kết nối. Thông tin vẫn được giữ; hãy thử lưu lại.",version:previous.version};}
 },{});
 const version=Math.max(account.version,result.version??0);
 useEffect(()=>{
  const field=result.errors&&Object.keys(result.errors)[0];
  if(!pending&&field)document.getElementById(`profile-${field}`)?.focus();
 },[result,pending]);
 return <section className="profile-panel" aria-labelledby="profile-title">
  <header className="profile-panel-heading"><span className="profile-heading-icon"><ShopIcon name="user" size={24}/></span><div><h1 id="profile-title">Hồ sơ cá nhân</h1><p>Cập nhật thông tin liên hệ và địa chỉ nhận hàng.</p></div></header>
  <form action={action} className="profile-form" onReset={e=>e.preventDefault()}>
   <input type="hidden" name="version" value={version}/>
   <fieldset disabled={pending}><legend className="visually-hidden">Thông tin cá nhân</legend>
    <div className="profile-fields">
     <label htmlFor="profile-name">Họ và tên<input id="profile-name" name="name" autoComplete="name" required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} aria-invalid={!!result.errors?.name} aria-describedby={result.errors?.name?"profile-name-error":undefined}/>{result.errors?.name&&<span id="profile-name-error" className="field-error">{result.errors.name}</span>}</label>
     <label htmlFor="profile-phone">Số điện thoại <span className="profile-optional">(không bắt buộc)</span><input id="profile-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} value={draft.phone} placeholder="Thêm số điện thoại…" onChange={e=>setDraft({...draft,phone:e.target.value})} aria-invalid={!!result.errors?.phone} aria-describedby={result.errors?.phone?"profile-phone-error":undefined}/>{result.errors?.phone&&<span id="profile-phone-error" className="field-error">{result.errors.phone}</span>}</label>
     <div className="profile-email-field"><label htmlFor="profile-email">Email đăng nhập</label><div className="profile-email-control"><input id="profile-email" type="email" value={account.email} readOnly autoComplete="email" spellCheck={false}/><ShopIcon name="lock" size={18}/></div><p><ShopIcon name="check" size={16}/> Đã liên kết Google. Email được quản lý tại Google.</p></div>
     <label htmlFor="profile-address" className="profile-address-field">Địa chỉ nhận hàng <span className="profile-optional">(không bắt buộc)</span><textarea id="profile-address" name="address" autoComplete="street-address" rows={3} maxLength={1000} value={draft.address} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố…" onChange={e=>setDraft({...draft,address:e.target.value})} aria-invalid={!!result.errors?.address} aria-describedby={result.errors?.address?"profile-address-error":undefined}/>{result.errors?.address&&<span id="profile-address-error" className="field-error">{result.errors.address}</span>}</label>
    </div>
    {result.ok&&!pending?<p className="profile-success" role="status"><ShopIcon name="check"/>{result.message}</p>:<FormError message={result.message} pending={pending}/>}
    <div className="profile-form-footer"><p><ShopIcon name="shield" size={18}/>Thông tin chỉ dùng để liên hệ và giao hàng.</p><button type="submit" className="button button-primary" aria-busy={pending}>{pending?"Đang lưu…":"Lưu thay đổi"}</button></div>
   </fieldset>
  </form>
 </section>;
}
