import { requireAdmin } from "@/lib/auth";
import {
  aiConfigured,
  telegramConfigured,
  notificationLabels,
} from "@/lib/integrations";
import { sendPendingNotifications, retryFailedNotifications } from "./actions";
import { formatDate } from "@/lib/tracking";
export default async function NotificationsPage() {
  const { client } = await requireAdmin(),
    r = await client.rpc("admin_notifications");
  if (r.error) throw new Error("Chưa tải được hàng đợi thông báo.");
  const d = r.data as {
    pending: number;
    failed: number;
    sent: number;
    recent: {
      id: string;
      event_type: string;
      attempts: number;
      sent_at: string | null;
      last_error: string | null;
      next_attempt_at: string;
    }[];
  };
  const telegram = telegramConfigured(process.env);
  return (
    <main id="main" className="container page-container">
      <div className="tracking-heading">
        <div>
          <h1>Tích hợp & thông báo</h1>
          <p>
            Trạng thái Gemini và Telegram. Secret được cấu hình ở server, không
            nhập trong trình duyệt.
          </p>
        </div>
        <a className="button button-outline" href="/admin/notifications">
          Tải lại dữ liệu
        </a>
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <h2>Tư vấn Gemini</h2>
          <span className="badge">
            {aiConfigured(process.env) ? "Đã cấu hình · bật" : "Chưa bật"}
          </span>
          <p>
            Chỉ gửi chính sách, tối đa 40 mặt hàng công khai và 6 lượt gần nhất.
            Khi thiếu dữ liệu/lỗi, khách nhận hướng dẫn Zalo.
          </p>
          <p className="admin-muted">
            Giới hạn hiện tại: 20 lượt/phiên/giờ, 200 lượt/ngày toàn shop. Không
            tự xóa lịch sử khi chưa chốt thời hạn lưu.
          </p>
        </section>
        <section className="admin-panel">
          <h2>Telegram nhóm admin</h2>
          <span className="badge">
            {telegram ? "Đã cấu hình · bật" : "Chưa bật · vẫn lưu hàng đợi"}
          </span>
          <p>
            {d.pending} chờ gửi · {d.failed} hết lượt thử · {d.sent} đã gửi
          </p>
          <div className="form-actions">
            <form action={sendPendingNotifications}>
              <button className="button button-primary" disabled={!telegram}>
                Gửi tối đa 5 thông báo đến hạn
              </button>
            </form>
            {d.failed > 0 && (
              <form action={retryFailedNotifications}>
                <button className="button button-outline" disabled={!telegram}>
                  Thử lại 5 thông báo lỗi sau khi sửa cấu hình
                </button>
              </form>
            )}
          </div>
          <p className="admin-muted">
            Gửi sau thao tác tạo đơn/đặt tìm/cập nhật tiền/tiến độ và yêu cầu hỗ
            trợ; worker xử lý retry theo lịch. Lỗi Telegram không hoàn tác đơn.
          </p>
        </section>
      </div>
      <section className="admin-panel">
        <h2>20 thông báo gần nhất</h2>
        {!d.recent.length ? (
          <p>Chưa có thông báo mới từ khi bật module.</p>
        ) : (
          <div className="admin-recent-list">
            {d.recent.map((n) => (
              <div key={n.id}>
                <span>
                  <strong>{notificationLabels[n.event_type]}</strong>
                  <small>
                    Lần thử {n.attempts}/5 · {n.id.slice(0, 8)}
                  </small>
                </span>
                <span>
                  {n.sent_at
                    ? `Đã gửi · ${formatDate(n.sent_at)}`
                    : n.attempts >= 5
                      ? "Hết lượt thử · cần kiểm tra cấu hình"
                      : `Chờ gửi · ${formatDate(n.next_attempt_at)}`}
                  {n.last_error && (
                    <small>
                      Lỗi:{" "}
                      {n.last_error === "network"
                        ? "Lỗi mạng"
                        : n.last_error === "provider"
                          ? "Lỗi nhà cung cấp"
                          : n.last_error === "rate_limit"
                            ? "Vượt giới hạn gửi"
                            : "Lỗi gửi"}
                    </small>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="admin-muted">
          Telegram nhận loại sự kiện và link admin cần đăng nhập; không gửi nội
          dung chat, địa chỉ, SĐT hoặc mã tra cứu. Sự cố mất phản hồi có thể gây
          gửi lặp; mã sự kiện dùng để nhận biết.
        </p>
      </section>
    </main>
  );
}
