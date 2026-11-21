import { createClient } from "@supabase/supabase-js";
import { isVerifiedGoogleUser } from "../src/lib/auth-config.ts";

// Chỉ local trong M1. Script operator, tuyệt đối không import vào ứng dụng.
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const userId = process.env.BOOTSTRAP_USER_ID;
try {
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error();
  if (!secret || !userId || !/^[a-f0-9-]{36}$/i.test(userId)) throw new Error();
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (
    error ||
    !isVerifiedGoogleUser(data.user) ||
    data.user?.email?.toLowerCase() !== "congminhnguyen0204@gmail.com"
  )
    throw new Error();
  const result = await client.rpc("bootstrap_first_admin", {
    p_user_id: userId,
  });
  if (result.error || result.data?.ok !== true) throw new Error();
  console.log("Đã cấp quyền admin đầu tiên trên Supabase local.");
} catch {
  console.error(
    "Chưa bootstrap được. Kiểm tra local URL, secret operator, UUID, Google identity đã xác minh và trạng thái bootstrap; không đưa secret vào chat.",
  );
  process.exitCode = 1;
}
