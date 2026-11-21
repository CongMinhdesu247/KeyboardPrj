import { requireCustomerAccount } from "@/lib/customer-account";
import { AccountShell } from "@/components/account-shell";
import { ProfileForm } from "@/components/profile-form";
export const dynamic = "force-dynamic";
export const metadata={title:"Hồ sơ cá nhân",robots:{index:false,follow:false}};
export default async function AccountPage() {
 const {account}=await requireCustomerAccount();
 return <AccountShell account={account} selected="profile"><ProfileForm account={account}/></AccountShell>;
}
