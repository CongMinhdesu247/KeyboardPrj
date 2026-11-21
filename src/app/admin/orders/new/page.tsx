import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { CreateOrderForm } from "@/components/order-forms";
export default async function NewOrderPage() {
  const { client } = await requireAdmin();
  const result = await client
    .from("products_services")
    .select(
      "id,name,price_vnd,version,unit,stock_quantity,service_categories!inner(active)",
    )
    .eq("active", true)
    .is("archived_at", null)
    .eq("service_categories.active", true)
    .order("name");
  if (result.error) throw new Error("Chưa tải được bảng giá.");
  const items = (result.data ?? [])
    .filter((i) => i.price_vnd !== null)
    .map((i) => ({
      id: String(i.id),
      name: i.name,
      price: i.price_vnd!,
      version: i.version,
      unit: i.unit,
      stock: i.stock_quantity,
    }));
  return (
    <main id="main" className="container page-container">
      <Link className="back-link" href="/admin/orders">
        ← Đơn hàng
      </Link>
      <span className="eyebrow">Tiếp nhận bàn phím</span>
      <h1>Tạo đơn mới</h1>
      <section className="info-panel">
        {items.length ? (
          <CreateOrderForm items={items} requestId={randomUUID()} />
        ) : (
          <>
            <p>
              Chưa có hạng mục đang bán và đã nhập giá. Hãy hoàn thiện bảng giá
              trước.
            </p>
            <Link className="button button-primary" href="/admin/catalog">
              Nhập bảng giá
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
