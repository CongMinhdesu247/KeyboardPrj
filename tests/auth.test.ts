import test from "node:test";
import assert from "node:assert/strict";
import {
  readAuthConfig,
  isVerifiedGoogleUser,
} from "../src/lib/auth-config.ts";
import {
  createInviteToken,
  hashInviteToken,
} from "../src/lib/admin-contract.ts";

test("invite 256-bit, hash cố định; không nhận token sai định dạng", () => {
  const first = createInviteToken();
  const second = createInviteToken();
  assert.notEqual(first, second);
  assert.match(hashInviteToken(first)!, /^[a-f0-9]{64}$/);
  assert.equal(hashInviteToken(` ${first} `), hashInviteToken(first));
  assert.equal(hashInviteToken("admin123"), null);
});
test("cấu hình auth thiếu hoặc nhầm secret phải đóng truy cập", () => {
  assert.equal(readAuthConfig({}), null);
  const base = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    APP_ORIGIN: "http://localhost:3000",
  };
  assert.equal(readAuthConfig(base)?.secure, false);
  assert.equal(
    readAuthConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: "sb_secret_test" }),
    null,
  );
  assert.equal(
    readAuthConfig({ ...base, SUPABASE_URL: "http://external.example" }),
    null,
  );
  assert.equal(
    readAuthConfig({
      ...base,
      APP_ORIGIN: "https://example.com/not-an-origin",
    }),
    null,
  );
});
test("không tin provider từ metadata, Google identity cần email đã xác minh", () => {
  const user = {
    email: "owner@example.test",
    email_confirmed_at: "2026-01-01",
    identities: [
      {
        provider: "google",
        identity_data: { email: "owner@example.test", email_verified: true },
      },
    ],
  };
  assert.equal(isVerifiedGoogleUser(user), true);
  assert.equal(
    isVerifiedGoogleUser({
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      identities: [],
    }),
    false,
  );
  assert.equal(
    isVerifiedGoogleUser({
      ...user,
      identities: [
        {
          provider: "google",
          identity_data: { email: user.email, email_verified: false },
        },
      ],
    }),
    false,
  );
  assert.equal(
    isVerifiedGoogleUser({
      ...user,
      identities: [
        {
          provider: "google",
          identity_data: { email: "other@example.test", email_verified: true },
        },
      ],
    }),
    false,
  );
});
