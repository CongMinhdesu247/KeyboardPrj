import assert from "node:assert/strict";
import {chromium,expect} from "@playwright/test";
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
 const context=await browser.newContext(),page=await context.newPage();
 // Intercept the handoff before Supabase/Google is contacted. This is not a login.
 await page.route("**/auth/v1/authorize**",route=>route.fulfill({contentType:"text/html",body:"<h1>OAuth handoff intercepted for verification</h1>"}));
 await page.goto("http://localhost:3000/account/login?checkout=1&item=123&quantity=2");
 const request=page.waitForRequest(req=>new URL(req.url()).pathname==="/auth/v1/authorize");
 await page.getByRole("button",{name:"Tiếp tục với Google",exact:true}).click();
 const target=new URL((await request).url());
  await expect(page.getByRole("heading",{name:"OAuth handoff intercepted for verification",exact:true})).toBeVisible();
 assert.equal(target.searchParams.get("provider"),"google");assert.equal(target.searchParams.get("redirect_to"),"http://localhost:3000/auth/callback");assert.ok(target.searchParams.get("code_challenge"));
 const jar=await context.cookies("http://localhost:3000/");
 assert.equal(jar.find(c=>c.name==="tk-login-intent")?.value,"checkout");assert.equal(decodeURIComponent(jar.find(c=>c.name==="tk-checkout-return")?.value??""),"/checkout?item=123&quantity=2");assert.equal(jar.find(c=>c.name==="tk-login-intent")?.httpOnly,true);
 await page.goto("http://localhost:3000/auth/callback?next=https://evil.example/");await expect(page).toHaveURL("http://localhost:3000/account/login?status=oauth_failed");
 assert.equal((await context.cookies()).some(c=>c.name==="tk-login-intent"),false);
 console.log("PASS: customer Google OAuth handoff, PKCE, fixed callback, quick-buy return cookie and failure redirect. No Google login simulated or completed.");
 await context.close();
} finally {await browser.close();}
