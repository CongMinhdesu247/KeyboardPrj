import type { Metadata } from "next";
import { readPublicCatalog } from "@/lib/catalog-data";
import { ServiceEstimator } from "@/components/service-estimator";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ước tính chi phí" };
export default async function EstimatePage({searchParams}:{searchParams:Promise<{category?:string}>}) {
  const [data,params]=await Promise.all([readPublicCatalog(),searchParams]);
  return <ServiceEstimator key={params.category??""} {...data} initialCategory={params.category??""}/>;
}
