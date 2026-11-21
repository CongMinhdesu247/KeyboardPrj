import type { Metadata } from "next";
import { readPublicCatalog } from "@/lib/catalog-data";
import { Storefront } from "@/components/storefront";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cửa hàng bàn phím & linh kiện" };
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const data = await readPublicCatalog();
  const filters = await searchParams;
  return (
    <main id="main" className="container shop-page">
      <Storefront
        key={`${filters.q ?? ""}:${filters.category ?? ""}`}
        items={data.catalog}
        categories={data.categories}
        demo={data.demo}
        initialSearch={(filters.q ?? "").slice(0, 120)}
        initialCategory={filters.category ?? ""}
      />
    </main>
  );
}
