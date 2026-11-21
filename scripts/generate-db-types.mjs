import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// Chỉ ghi đè khi CLI thành công; không làm rỗng file nếu Docker lỗi.
const cli = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const result = spawnSync(
  process.execPath,
  [cli, "gen", "types", "typescript", "--schema", "public"],
  { encoding: "utf8" },
);
if (result.status !== 0 || !result.stdout.includes("export type Database")) {
  console.error(
    "Chưa sinh được types. Hãy khởi động Supabase local và áp dụng migration trước; file contract hiện tại được giữ nguyên.",
  );
  process.exitCode = 1;
} else {
  await writeFile("src/lib/database.types.ts", result.stdout);
  console.log(
    "Đã sinh database.types.ts từ Supabase local. Chạy npm run typecheck để kiểm tra hợp đồng mới.",
  );
}
