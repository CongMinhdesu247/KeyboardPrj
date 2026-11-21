import { Workshop } from "@/components/workshop";
import { readPublicCatalog } from "@/lib/catalog-data";
import { readPublicPortfolio } from "@/lib/portfolio-data";
import {readPublicBanners} from "@/lib/banner-data";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [catalog, portfolio,banners] = await Promise.all([
    readPublicCatalog(),
    readPublicPortfolio(12),
    readPublicBanners(),
  ]);
  return <Workshop {...catalog} portfolio={portfolio} banners={banners} />;
}
