import { probeDatabase } from "@/lib/readiness-probe";

export const dynamic = "force-dynamic";
let cached: { until: number; result: Promise<boolean> } | undefined;

export async function GET() {
  if (!cached || cached.until <= Date.now())
    cached = { until: Date.now() + 5000, result: probeDatabase(process.env) };
  const ready = await cached.result;
  return Response.json({ status: ready ? "ok" : "unavailable" }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
