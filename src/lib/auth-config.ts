export function readAuthConfig(env: Record<string, string | undefined>) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    const origin = new URL(env.APP_ORIGIN ?? "http://localhost:3000");
    for (const address of [parsed, origin]) {
      if (
        address.username ||
        address.password ||
        address.pathname !== "/" ||
        address.search ||
        address.hash
      )
        return null;
      if (
        address.protocol !== "https:" &&
        !(
          address.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(address.hostname)
        )
      )
        return null;
    }
    if (key.startsWith("sb_secret_")) return null;
    // Bắt cấu hình nhầm service-role JWT vào client SSR.
    if (key.split(".").length === 3) {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      if (payload.role !== "anon") return null;
    } else if (!key.startsWith("sb_publishable_")) return null;
    return {
      url: parsed.origin,
      key,
      origin: origin.origin,
      secure: origin.protocol === "https:",
    };
  } catch {
    return null;
  }
}

export function isVerifiedGoogleUser(
  user: {
    email?: string;
    email_confirmed_at?: string;
    identities?: {
      provider: string;
      identity_data?: Record<string, unknown>;
    }[];
  } | null,
) {
  return (
    !!user?.email &&
    !!user.email_confirmed_at &&
    !!user.identities?.some(
      (identity) =>
        identity.provider === "google" &&
        identity.identity_data?.email_verified === true &&
        typeof identity.identity_data.email === "string" &&
        identity.identity_data.email.toLowerCase() ===
          user.email!.toLowerCase(),
    )
  );
}
