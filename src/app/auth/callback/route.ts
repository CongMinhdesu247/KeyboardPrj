import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readAuthConfig, isVerifiedGoogleUser } from "@/lib/auth-config";
import { createAuthClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const config = readAuthConfig(process.env);
  const origin =
    config?.origin ?? process.env.APP_ORIGIN ?? "http://localhost:3000";
  const jar=await cookies(),intent=jar.get("tk-login-intent")?.value;
  const customer=intent==="customer" || intent==="checkout";
  const storedCheckout=jar.get("tk-checkout-return")?.value??"";
  const checkoutReturn=/^\/checkout(?:\?item=[1-9]\d{0,14}&quantity=[1-9]\d?)?$/.test(storedCheckout)?storedCheckout:"/checkout";
  jar.delete("tk-login-intent");
  jar.delete("tk-checkout-return");
  const fail = (status="oauth_failed") =>
    NextResponse.redirect(`${origin}/${customer?"account":"admin"}/login?status=${status}`, {
      headers: { "Cache-Control": "private, no-store" },
    });
  const code = new URL(request.url).searchParams.get("code");
  if (!config || !code || code.length > 2048) return fail();
  const client = await createAuthClient({ writeCookies: true });
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return fail();
  const { data } = await client.auth.getUser();
  if (!isVerifiedGoogleUser(data.user)) {
    await client.auth.signOut({ scope: "local" });
    return fail();
  }
  const account=await client.rpc("touch_account");
  if (account.error || (account.data as {status?:string})?.status!=="active") {
    await client.auth.signOut({scope:"local"});
    return fail("restricted");
  }
  // Fixed destinations only; login never creates admin membership.
  return NextResponse.redirect(`${origin}${customer?(intent==="checkout"?checkoutReturn:"/account"):"/admin"}`, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
