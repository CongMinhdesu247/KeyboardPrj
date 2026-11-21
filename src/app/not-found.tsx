import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container error-page">
      <span className="eyebrow">Không tìm thấy thông tin</span>
      <h1>Kiểm tra lại đường dẫn hoặc mã đơn.</h1>
      <p>Kiểm tra đầy đủ mã shop đã gửi. Bạn cũng có thể xem đơn minh họa.</p>
      <Link href="/track/KB-DEMO2026" className="button button-primary">
        Xem đơn mẫu
      </Link>
      <Link href="/">Về trang chủ</Link>
    </main>
  );
}
