import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readAuthConfig } from "@/lib/auth-config";
import type { Database } from "@/lib/database.types";

export async function createAuthClient({ writeCookies = false } = {}) {
  const config = readAuthConfig(process.env);
  if (!config) throw new Error("Chưa cấu hình xác thực hợp lệ.");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: config.secure,
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch (error) {
          if (writeCookies)
            throw error; /* Server Component: proxy đã refresh trước khi render. */
        }
      },
    },
  });
}
