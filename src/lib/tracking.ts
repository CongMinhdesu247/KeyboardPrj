export function normalizeOrderCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^(?:KB-[A-Z0-9]{6,32}|TK-[A-F0-9]{32})$/.test(code) ? code : null;
}
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
