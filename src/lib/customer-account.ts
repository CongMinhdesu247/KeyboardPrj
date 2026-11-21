import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { isVerifiedGoogleUser, readAuthConfig } from "./auth-config";
export type Account = { id:string;email:string;name:string;phone:string;address:string;version:number;role:"admin"|"customer";status:"active"|"banned"|"deleted" };
export async function readAccount() {
  if (!readAuthConfig(process.env)) return null;
  const client=await createAuthClient();
  const {data,error}=await client.auth.getUser();
  if (error || !isVerifiedGoogleUser(data.user)) return null;
  const account=await client.rpc("touch_account");
  if (account.error) return null;
  return {client,user:data.user!,account:account.data as unknown as Account};
}
export async function requireCustomerAccount() {
  const context=await readAccount();
  if (!context) redirect("/account/login?status=session");
  if (context.account.status!=="active") redirect(`/account/login?status=${context.account.status}`);
  return context;
}
