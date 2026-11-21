import { NextRequest, NextResponse } from "next/server";
import { isAllowedHost } from "@/lib/host-policy";
import { refreshAuthSession } from "@/lib/supabase/session";
import { clientAddress, createRequestLimiter, sameOriginWrite } from "@/lib/request-security";

const limitRequest = createRequestLimiter();

export async function proxy(request: NextRequest) {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (
    !isAllowedHost(
      request.headers.get("host"),
      request.nextUrl.pathname,
      origin,
    )
  ) {
    return new NextResponse("Địa chỉ truy cập không hợp lệ.", { status: 400 });
  }
  const forwarded = request.headers.get("x-forwarded-host");
  if (
    forwarded &&
    !isAllowedHost(forwarded, request.nextUrl.pathname, origin)
  ) {
    return new NextResponse("Địa chỉ proxy không hợp lệ.", { status: 400 });
  }
  const path = request.nextUrl.pathname;
  if (["/api/health", "/healthz"].includes(path)) return NextResponse.next();
  const reject = (message: string, status: number, retry?: number) =>
    new NextResponse(message, { status, headers: {
      "Cache-Control": "private, no-store",
      ...(retry ? { "Retry-After": String(retry) } : {}),
    } });
  if (!sameOriginWrite(request.method, request.headers.get("origin"), origin))
    return reject("Nguồn gửi không hợp lệ.", 403);
  const address = clientAddress(request.headers, process.env.TRUSTED_PROXY);
  if (!address) return reject("Không xác minh được nguồn proxy.", 403);
  // Bound abuse before session refresh, DB calls and multipart processing.
  const scope = path.startsWith("/track/") ? "tracking" :
    path === "/auth/callback" || path.endsWith("/login") ? "login" :
    request.method === "POST" ? "write" : "page";
  if (process.env.TRUSTED_PROXY === "cloudflare" && !path.startsWith("/_next/") && !/\.[a-z0-9]+$/i.test(path)) {
    const retry = limitRequest(address, scope, scope === "tracking" ? 30 : scope === "login" ? 20 : scope === "write" ? 30 : 180);
    if (retry) return reject("Đã có nhiều lượt truy cập. Hãy chờ rồi thử lại.", 429, retry);
  }
  if (
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/auth/") ||
    request.nextUrl.pathname.startsWith("/account") ||
    request.nextUrl.pathname.startsWith("/checkout") ||
    (!request.nextUrl.pathname.startsWith("/_next") && !/\.[a-z0-9]+$/i.test(request.nextUrl.pathname) && request.cookies.getAll().some(c=>c.name.startsWith("sb-")))
  ) {
    return refreshAuthSession(request);
  }
  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
