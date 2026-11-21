export type ProfileFields={name:string;phone:string;address:string};
export type ProfileState={ok?:boolean;message?:string;version?:number;profile?:ProfileFields;errors?:Partial<Record<keyof ProfileFields,string>>};
export function validateProfile(form:FormData):{profile:ProfileFields;errors:NonNullable<ProfileState["errors"]>} {
 const name=String(form.get("name")??"").trim(),phone=String(form.get("phone")??"").replace(/[\s().-]/g,""),address=String(form.get("address")??"").trim();
 const errors:NonNullable<ProfileState["errors"]>={};
 if(!name||name.length>120)errors.name="Nhập tên từ 1 đến 120 ký tự.";
 if(phone&&!/^\+?[0-9]{9,15}$/.test(phone))errors.phone="Số điện thoại cần từ 9 đến 15 chữ số.";
 if(address.length>1000)errors.address="Địa chỉ tối đa 1.000 ký tự.";
 return {profile:{name,phone,address},errors};
}
