import "server-only";
import { readAuthConfig } from "./auth-config";
import { createServiceClient } from "./supabase/service";
import type { PublicPortfolio } from "./m4-contract";
export async function readPublicPortfolio(
  limit = 60,
): Promise<PublicPortfolio[]> {
  if (!readAuthConfig(process.env)) return [];
  const client = createServiceClient(),
    result = await client.rpc("read_published_portfolio");
  if (result.error) throw new Error("Chưa tải được portfolio của shop.");
  const items = result.data as unknown as {
    id: string;
    title: string;
    keyboard: string;
    mods: string;
    description: string;
    videoUrl: string;
    imagePath: string;
  }[];
  return Promise.all(
    items.slice(0, limit).map(async (i) => {
      const signed = await client.storage
        .from("portfolio-media")
        .createSignedUrl(i.imagePath, 300);
      if (signed.error) throw new Error("Chưa tải được ảnh portfolio.");
      return {
        id: i.id,
        title: i.title,
        keyboard: i.keyboard,
        mods: i.mods,
        description: i.description,
        videoUrl: i.videoUrl,
        imageUrl: signed.data.signedUrl,
      };
    }),
  );
}
