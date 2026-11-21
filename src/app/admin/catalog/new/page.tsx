import { requireAdmin } from "@/lib/auth";
import { CatalogEditor } from "@/components/catalog-admin";
import { readAuthConfig } from "@/lib/auth-config";
export default async function NewCatalogPage() {
  await requireAdmin();
  return (
    <main id="main" className="container page-container">
      <span className="eyebrow">TRUMP Keys · Bảng giá</span>
      <h1>Thêm dịch vụ / sản phẩm</h1>
      <section className="info-panel">
        <CatalogEditor backendUrl={readAuthConfig(process.env)!.url} />
      </section>
    </main>
  );
}
