import { readAuthConfig } from "./auth-config.ts";

export async function probeDatabase(env: Record<string, string | undefined>, http: typeof fetch = fetch) {
  const config = readAuthConfig(env);
  if (!config || !env.SUPABASE_SECRET_KEY) return false;
  try {
    // A real, bounded PostgREST query exercises DB connectivity and the public RLS path.
    const response = await http(`${config.url}/rest/v1/service_categories?select=slug&limit=1`, {
      headers: { apikey: config.key, ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}) },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    return Array.isArray(await response.json());
  } catch { return false; }
}
