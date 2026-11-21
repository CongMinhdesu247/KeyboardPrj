import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readAuthConfig } from "@/lib/auth-config";
import type { Database } from "@/lib/database.types";
export function createServiceClient() {
  const config = readAuthConfig(process.env),
    secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret) throw new Error("Dịch vụ chưa được cấu hình.");
  return createClient<Database>(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
