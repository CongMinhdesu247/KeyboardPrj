import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { readAuthConfig } from "@/lib/auth-config";
import type { Database } from "@/lib/database.types";

export async function refreshAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = readAuthConfig(process.env);
  if (!config) return response;
  const client = createServerClient<Database>(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: config.secure,
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, cacheHeaders) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(cacheHeaders).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  // Signature/session được xác minh; mọi thao tác quyền còn kiểm getUser + membership riêng.
  await client.auth.getClaims();
  if (request.cookies.getAll().some(c=>c.name.startsWith("sb-"))) await client.rpc("touch_account");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
