// The HP profile must never quietly start with demo data or insecure OAuth cookies.
if (process.env.DEPLOYMENT_TARGET === "hp") {
  try {
    const origin = new URL(process.env.APP_ORIGIN);
    const backend = new URL(process.env.SUPABASE_URL);
    if (origin.protocol !== "https:" || origin.origin !== process.env.APP_ORIGIN ||
        backend.protocol !== "https:" || backend.origin !== process.env.SUPABASE_URL ||
        process.env.CORS_ORIGINS !== origin.origin ||
        !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY)
      throw new Error();
    // Bounded startup retry for the external DB/API, no migrations or writes here.
    let ready = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(`${backend.origin}/rest/v1/service_categories?select=slug&limit=1`, {
          headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, ...(process.env.SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ") ? {Authorization:`Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`} : {}) },
          signal: AbortSignal.timeout(3000), redirect: "error",
        });
        ready = r.ok && Array.isArray(await r.json());
      } catch { /* Retry without logging credentials or provider responses. */ }
      if (ready) break;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!ready) throw new Error();
  } catch {
    console.error("HP startup refused: check HTTPS origin, same-origin CORS and Supabase configuration/connectivity.");
    process.exit(1);
  }
}
await import("../server.js");
