export const requestStatuses = {
  pending: "Mới nhận",
  contacted: "Đã liên hệ",
  done: "Đã xử lý",
} as const;
export type CustomRequest = {
  id: string;
  category: "keycap" | "stab";
  customer_name: string;
  phone: string;
  budget_vnd: number;
  reference_url: string;
  note: string;
  image_path: string | null;
  status: keyof typeof requestStatuses;
  internal_note: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type PortfolioItem = {
  id: string;
  title: string;
  keyboard: string;
  mods: string;
  description: string;
  video_url: string;
  image_path: string | null;
  published: boolean;
  version: number;
};
export type PublicPortfolio = {
  id: string;
  title: string;
  keyboard: string;
  mods: string;
  description: string;
  videoUrl: string;
  imageUrl: string;
};
export type M4State = { ok?: boolean; message?: string; reference?: string };
export function safeReferenceUrl(input: string) {
  if (!input) return true;
  try {
    const u = new URL(input);
    return (
      input.length <= 500 &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.hostname !== "localhost"
    );
  } catch {
    return false;
  }
}
export function youtubeId(input: string) {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return null;
    const id =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : ["youtube.com", "www.youtube.com"].includes(u.hostname)
          ? u.pathname === "/watch"
            ? u.searchParams.get("v")
            : u.pathname.startsWith("/shorts/")
              ? u.pathname.split("/")[2]
              : null
          : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
