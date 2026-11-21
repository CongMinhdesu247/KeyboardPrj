import Link from "next/link";
import { readAuthConfig } from "@/lib/auth-config";
import { startGoogleLogin } from "../actions";
const messages: Record<string, string> = {
  session: "Phiên đăng nhập chưa có hoặc đã hết hạn. Hãy đăng nhập lại.",
  google_required:
    "Hãy dùng tài khoản Google đã xác minh để truy cập quản trị.",
  setup: "Chưa cấu hình kết nối xác thực hợp lệ.",
  oauth_failed:
    "Đăng nhập Google chưa hoàn tất. Hãy thử lại; nếu vẫn lỗi, kiểm tra cấu hình OAuth.",
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const feedback =
    status && Object.hasOwn(messages, status) ? messages[status] : null;
  const configured = !!readAuthConfig(process.env);
  return (
    <main id="main" className="container page-container auth-page">
      <Link href="/" className="back-link">
        ← Về trang khách hàng
      </Link>
      <span className="eyebrow">TRUMP Keys · Quản trị</span>
      <h1>Chào bạn trở lại.</h1>
      <p className="page-lead">
        Dùng tài khoản Google để đăng nhập vào khu vực của shop.
      </p>
      <section className="info-panel">
        <h2>Đăng nhập quản trị</h2>
        <p>
          Chỉ tài khoản đã được cấp quyền admin mới có thể xem dữ liệu và quản
          lý cửa hàng.
        </p>
        {feedback && (
          <p role="alert" className="auth-feedback">
            {feedback}
          </p>
        )}
        <form action={startGoogleLogin}>
          <button
            className="button button-primary full-width"
            disabled={!configured}
          >
            Tiếp tục với Google
          </button>
        </form>
        {!configured && (
          <div className="auth-setup">
            <span className="badge">Đang chuẩn bị xác thực local</span>
            <p>
              Đăng nhập sẽ được mở khi người vận hành hoàn tất kết nối tài khoản
              Google cho shop.
            </p>
            <p>
              Người vận hành cấu hình môi trường theo tài liệu{" "}
              <code>docs/M1-AUTH.md</code> rồi khởi động lại ứng dụng.
            </p>
          </div>
        )}
        <p className="muted">
          Được mời làm admin? Đăng nhập Google trước, sau đó nhập mã mời do shop
          cấp.
        </p>
      </section>
    </main>
  );
}
