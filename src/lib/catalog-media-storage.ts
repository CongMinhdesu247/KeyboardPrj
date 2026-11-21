import "server-only";
import type { requireAdmin } from "./auth";
type Client = Awaited<ReturnType<typeof requireAdmin>>["client"];
export async function removeUnusedCatalogAsset(client: Client, bucket: "catalog-images" | "catalog-videos", path: string) {
  if (!/^[a-f0-9-]{36}\.(webp|mp4)$/.test(path)) return;
  const query = client.from("products_services").select("id");
  const refs = bucket === "catalog-images"
    ? await query.or(`image_path.eq.${path},image_paths.cs.{${path}}`).limit(1)
    : await query.eq("video_path", path).limit(1);
  // Keep the file if reference lookup is uncertain. Never delete a committed/shared asset.
  if (!refs.error && refs.data.length === 0) await client.storage.from(bucket).remove([path]);
}
