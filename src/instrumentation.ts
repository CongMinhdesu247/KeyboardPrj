// Optional workaround for local networks with unreliable IPv6 routing.
// No DNS overrides or preference changes unless the operator enables it.
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.PREFER_IPV4 === "true"
  ) {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
  }
}
