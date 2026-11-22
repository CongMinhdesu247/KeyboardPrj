import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import {
  catalogImageUrl,
  type AdminCatalogItem,
  type InventoryMovement,
} from "@/lib/catalog-data";
import {
  CatalogEditor,
  ArchiveForm,
  StockForm,
} from "@/components/catalog-admin";
import { readAuthConfig } from "@/lib/auth-config";
import { formatDate } from "@/lib/tracking";
export default async function EditCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireAdmin();
  const { id } = await params;
  if (!/^[1-9]\d{0,14}$/.test(id)) notFound();
  const { data, error } = await client.rpc("list_catalog_admin");
  if (error) throw new Error("Chưa tải được sản phẩm.");
  const item = (
    (Array.isArray(data) ? data : []) as unknown as AdminCatalogItem[]
  ).find((item) => item.id === id);
  if (!item) notFound();
  const movements =
    item.type === "product"
      ? await client.rpc("list_inventory_movements", { p_id: Number(id) })
      : { data: [], error: null };
  if (movements.error) throw new Error("Chưa tải được lịch sử tồn kho.");
  const history = (Array.isArray(movements.data)
    ? movements.data
    : []) as unknown as InventoryMovement[];
  return (
    <main id="main" className="container page-container">
      <Link href="/admin/catalog" className="back-link">
        ← Danh sách dịch vụ & linh kiện
      </Link>
      <span className="eyebrow">TRUMP Keys · Chỉnh sửa</span>
      <h1>{item.name}</h1>
      <section className="info-panel">
        <CatalogEditor
          backendUrl={readAuthConfig(process.env)!.url}
          item={item}
          imageUrl={catalogImageUrl(
            item.image_path,
            readAuthConfig(process.env)!.url,
          )}
        />
      </section>
      {item.type === "product" && (
        <>
          <section className="info-panel">
            <h2>
              Tồn kho: {item.stock_quantity} {item.unit}
            </h2>
            <StockForm id={id} requestId={randomUUID()} />
          </section>
          <section className="info-panel" id="history">
            <h2>Lịch sử nhập / điều chỉnh</h2>
            <p>
              100 lần gần nhất. Tồn kho được trừ tự động khi xác nhận tiền thực
              nhận của đơn hàng.
            </p>
            <ul className="inventory-history">
              {!history.length && <li>Chưa có biến động tồn kho.</li>}
              {history.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta} · Còn {m.balance_after}
                    </strong>
                    <p>{m.reason}</p>
                  </div>
                  <time dateTime={m.created_at}>
                    {formatDate(m.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <section className="info-panel">
        <ArchiveForm item={item} />
      </section>
    </main>
  );
}
