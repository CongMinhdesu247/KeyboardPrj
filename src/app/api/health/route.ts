export const dynamic = "force-dynamic";

// Liveness của web, không ngụ ý Auth/DB/Gemini đã kết nối hoặc sẵn sàng.
export function GET() {
  return Response.json(
    { status: "ok", service: "trumpkeys-web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
