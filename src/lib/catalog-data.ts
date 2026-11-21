import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readAuthConfig } from "./auth-config";
import { categories, catalog as demoCatalog } from "./catalog";
import type { CatalogItem } from "./domain";
import type { Database } from "./database.types";
import { catalogAssetUrl } from "./catalog-media";

export type AdminCatalogItem = Omit<
  Database["public"]["Tables"]["products_services"]["Row"],
  "id"
> & { id: string; cost_vnd: number };
export type InventoryMovement = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
};
export function catalogImageUrl(path: string | null, backendUrl: string) {
  return path
    ? `${backendUrl}/storage/v1/object/public/catalog-images/${encodeURIComponent(path)}`
    : undefined;
}
export async function readPublicCatalog() {
  const config = readAuthConfig(process.env);
  if (!config) return { categories, catalog: demoCatalog, demo: true };
  // Luôn dùng client anonymous riêng, không mang cookie admin sang public page.
  const client = createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  const [groups, items] = await Promise.all([
    client
      .from("service_categories")
      .select("slug,title,description,position")
      .eq("active", true)
      .order("position"),
    client
      .from("products_services")
      .select(
        "id,category_slug,name,description,type,unit,price_vnd,stock_quantity,lube_package,image_path,image_paths,video_path,video_url",
      )
      .eq("active", true)
      .is("archived_at", null)
      .order("id"),
  ]);
  if (groups.error || items.error)
    throw new Error(
      "Chưa tải được bảng giá. Hãy thử lại hoặc liên hệ Zalo của shop.",
    );
  const publicItems: CatalogItem[] = (items.data ?? []).map((item) => ({
    id: String(item.id),
    category: item.category_slug as CatalogItem["category"],
    name: item.name,
    description: item.description,
    type: item.type as CatalogItem["type"],
    unit: item.unit as CatalogItem["unit"],
    price: item.price_vnd!,
    stock: item.stock_quantity,
    imageUrl: catalogImageUrl(item.image_path, config.url),
    imageUrls: item.image_paths.map((p) => catalogAssetUrl(config.url,"catalog-images",p)),
    videoUrl: item.video_path ? catalogAssetUrl(config.url,"catalog-videos",item.video_path) : undefined,
    soundTestUrl: item.video_url || undefined,
    lubePackage: item.lube_package ?? undefined,
  }));
  return {
    categories: (groups.data ?? []).flatMap((group) => {
      const known = categories.find((category) => category.slug === group.slug);
      return known
        ? [{ ...known, title: group.title, description: group.description }]
        : [];
    }),
    catalog: publicItems,
    demo: false,
  };
}
