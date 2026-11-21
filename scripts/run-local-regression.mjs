import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
// This project's regression fixtures must never send AI prompts or Telegram notices.
// Temporarily disable local integrations; preserve the exact original env in memory.
const path = new URL("../.env.local", import.meta.url),
  original = await readFile(path, "utf8");
let local = original;
for (const key of ["GEMINI_ENABLED", "TELEGRAM_ENABLED"]) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  local = regex.test(local)
    ? local.replace(regex, `${key}=false`)
    : local + `\n${key}=false\n`;
}
try {
  await writeFile(path, local);
  const response = await fetch("http://localhost:3000/chat", {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || (await response.text()).includes("Trợ lý AI · Gemini"))
    throw new Error(
      "Local server must reload disabled integrations before tests.",
    );
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "scripts/verify-m1-local.mjs",
        "--browser",
        ...process.argv.slice(2),
      ],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} catch {
  console.error(
    "Local regression could not complete; sensitive configuration omitted.",
  );
  process.exitCode = 1;
} finally {
  await writeFile(path, original);
  console.log("Restored original local integration settings.");
}
