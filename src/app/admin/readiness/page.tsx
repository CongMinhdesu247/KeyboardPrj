import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { catalogReadiness, type ReadinessItem } from "@/lib/readiness";
import { aiConfigured, telegramConfigured } from "@/lib/integrations";
import { shippingPolicy, retentionPolicy } from "@/lib/shop-policies";
import { readAuthConfig } from "@/lib/auth-config";
export default async function ReadinessPage() {
  const { client } = await requireAdmin();
  const [items, groups, portfolio] = await Promise.all([
    client.rpc("list_catalog_admin"),
    client.from("service_categories").select("slug").eq("active", true),
    client.rpc("list_portfolio_admin"),
  ]);
  const failed = !!(items.error || groups.error || portfolio.error);
  const quality = !failed
    ? catalogReadiness(
        items.data as unknown as ReadinessItem[],
        groups.data!.map((g) => g.slug),
      )
    : null;
  const published = !failed
    ? (portfolio.data as unknown as { published: boolean }[]).filter(
        (p) => p.published,
      ).length
    : null;
  const config = readAuthConfig(process.env),
    local =
      !!config &&
      ["localhost", "127.0.0.1"].includes(new URL(config.origin).hostname);
  return (
    <main id="main" className="container page-container readiness-page">
      <div className="tracking-heading">
        <div>
          <h1>Chuẩn bị vận hành</h1>
          <p>Kiểm tra nội dung và các bước còn lại trước khi nhận đơn thật.</p>
        </div>
        <Link href="/admin/readiness" className="button button-outline">
          Kiểm tra lại
        </Link>
      </div>
      <p className="readiness-notice">
        {local
          ? "Đang chạy trên PC/local. Chưa triển khai lên HP hoặc kiểm chứng tên miền."
          : "Môi trường hiện tại cần được người vận hành kiểm chứng trước khi phát hành."}{" "}
        Các số liệu bên dưới không thay cho việc duyệt nội dung thật và thử giao
        nhận/chuyển khoản thực tế.
      </p>
      {failed ? (
        <p role="alert">
          Chưa tải đủ dữ liệu kiểm tra. Thử lại; không coi lỗi kết nối là cửa
          hàng đã sẵn sàng.
        </p>
      ) : (
        <>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>Nội dung cửa hàng</h2>
              <Link className="button button-primary" href="/admin/catalog/new">
                Thêm sản phẩm
              </Link>
            </div>
            <p>
              {quality!.visible} mục công khai trong nhóm đang bật ·{" "}
              {quality!.sellable} mục có giá và đang nhận đặt ·{" "}
              {quality!.drafts} mục nháp.
            </p>
            {!quality!.sellable && (
              <p className="readiness-warning">
                Chưa có mặt hàng sẵn sàng nhận đặt. Nhập giá, kiểm kho và bật
                Công khai trước khi mời khách mua.
              </p>
            )}
            <p>
              {quality!.missing.length} mục công khai cần bổ sung ảnh, mô tả
              hoặc giá. Hệ thống chỉ kiểm tra có dữ liệu; bạn vẫn cần kiểm tra
              ảnh đúng mẫu, quyền sử dụng và nội dung.
            </p>
            <div className="readiness-items">
              {quality!.missing.slice(0, 10).map((i) => (
                <Link key={i.id} href={`/admin/catalog/${i.id}`}>
                  <strong>{i.name}</strong>
                  <span>{i.reasons.join(" · ")}</span>
                </Link>
              ))}
            </div>
            {quality!.missing.length > 10 && (
              <Link href="/admin/catalog">
                Xem các mục còn lại trong Bảng giá & kho
              </Link>
            )}
            <details className="admin-disclosure">
              <summary>Cách nhập một mặt hàng bán được</summary>
              <ol>
                <li>
                  Chọn Sản phẩm cho hàng bán có tồn, Dịch vụ cho công mod. Kiểm
                  đúng nhóm và đơn vị tính.
                </li>
                <li>
                  Nhập ảnh thật, mô tả/tương thích, giá bán và giá vốn. Lube
                  theo đúng gói, không suy layout thành số switch.
                </li>
                <li>
                  Lưu mục; với sản phẩm, dùng phiếu nhập trong mục đó để nhập
                  tồn thực tế.
                </li>
                <li>
                  Bật Công khai, mở Cửa hàng kiểm ảnh/giá và thử số lượng. Mục
                  cũ nhập sai loại cần tạo mới đúng loại rồi lưu trữ mục sai,
                  không sửa lịch sử.
                </li>
              </ol>
            </details>
            <Link href="/shop" target="_blank">
              Mở cửa hàng để duyệt ↗
            </Link>
          </section>
          <section className="admin-panel">
            <h2>Portfolio & sound test</h2>
            <p>
              {published} bài công khai trong tối đa 200 bài chưa lưu trữ được
              kiểm tra. Chỉ dùng ảnh đã được phép, không lộ dữ liệu khách. Chưa
              có bài thật thì để trống, không dùng bài đánh giá/đã bán giả.
            </p>
            <Link href="/admin/portfolio">Quản lý portfolio</Link>
          </section>
        </>
      )}
      <section className="admin-panel">
        <h2>Chính sách và kênh hỗ trợ</h2>
        <p>{shippingPolicy}</p>
        <p>{retentionPolicy}</p>
        <div className="policy-links">
          <Link href="/guide" target="_blank">
            Xem hướng dẫn khách
          </Link>
          <Link href="/privacy" target="_blank">
            Xem thông tin riêng tư
          </Link>
        </div>
        <p>
          Telegram:{" "}
          {telegramConfigured(process.env)
            ? "Đã bật/có cấu hình — cần kiểm tra tin đến nhóm khi thử đơn."
            : "Chưa bật hoặc thiếu cấu hình."}{" "}
          Gemini:{" "}
          {aiConfigured(process.env)
            ? "Đã bật/có cấu hình — chưa bảo đảm provider trả lời thành công."
            : "Chưa bật hoặc thiếu cấu hình."}
        </p>
        <Link href="/admin/notifications">Kiểm tra tích hợp & thông báo</Link>
      </section>
      <section className="admin-panel">
        <h2>Thử một đơn trước khi nhận khách</h2>
        <ol className="readiness-steps">
          <li>
            Trên điện thoại, chọn mặt hàng thật, kiểm ảnh/giá/tồn rồi tạo đơn
            thử. Ghi rõ đơn thử và thống nhất trước khi chuyển tiền.
          </li>
          <li>
            Quét QR bằng ứng dụng ngân hàng; kiểm đúng Agribank, người nhận, số
            tiền cọc20% hoặc100% và nội dung riêng của đơn.
          </li>
          <li>
            Kiểm tra Telegram. Admin chỉ ghi nhận tiền sau khi tiền vào tài
            khoản, rồi kiểm lại tồn và tiến độ trên trang khách.
          </li>
          <li>
            Đi lần lượt Đang xử lý → Hoàn thành. Với COD, chỉ ghi80% còn lại khi
            shop thực nhận đối soát; kiểm số liệu tại Tiền thực thu.
          </li>
          <li>
            Thử thêm tình huống hàng hết tồn, mất mạng, hủy và hoàn. Không
            xóa/sửa trực tiếp sổ giao dịch; nếu có khoản tiền thật, giữ đúng
            lịch sử xử lý.
          </li>
        </ol>
        <Link href="/admin/reports">Mở báo cáo tiền thực thu</Link>
      </section>
      <section className="admin-panel">
        <h2>Còn cần người vận hành xác nhận</h2>
        <ul>
          <li>Đã duyệt ảnh/giá/tồn thật và nội dung chính sách với shop.</li>
          <li>
            Đã quét QR, thử nhận tiền/COD, Telegram và luồng trên điện thoại
            thật.
          </li>
          <li>Đã rà soát mốc lưu dữ liệu và bản sao lưu; chưa bật tự xóa.</li>
          <li>
            Đã thử khôi phục database và tệp Storage trong môi trường riêng;
            không reset DB đang dùng.
          </li>
          <li>
            Khi chuyển HP: xác minh cổng8094/tài nguyên, cấu hình DB/Storage bền
            vững, HTTPS/OAuth và worker; giữ các ứng dụng khác. Chưa thực hiện
            các bước này trên HP.
          </li>
        </ul>
        <p className="admin-muted">
          Trang này chỉ đọc trạng thái. Không có nút phát hành hoặc nút tự đánh
          dấu đã nghiệm thu.
        </p>
      </section>
    </main>
  );
}
