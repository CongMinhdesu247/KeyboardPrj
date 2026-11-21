export function isAllowedHost(
  host: string | null,
  pathname: string,
  appOrigin: string,
): boolean {
  if (!host) return false;
  try {
    const origin = new URL(appOrigin);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      return false;
    if (host.toLowerCase() === origin.host.toLowerCase()) return true;
    // Chỉ healthcheck được dùng loopback khi canonical origin là tên miền public.
    return (
      ["/api/health", "/healthz"].includes(pathname) &&
      /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host.toLowerCase())
    );
  } catch {
    return false;
  }
}
