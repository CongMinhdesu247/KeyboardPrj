// Business information approved by the shop; no credentials or customer data.
export const shippingPolicy =
  "Khách thanh toán toàn bộ phí vận chuyển và phí thu hộ COD (nếu có). Shop báo phí và thống nhất trước khi gửi; giá sản phẩm/dịch vụ và QR chưa gồm các phí này.";
export const retentionPolicy =
  "Thời hạn lưu mục tiêu: chat 90 ngày, ảnh/video tiến độ 180 ngày, đơn hàng và thanh toán 24 tháng. Shop đang rà soát mốc tính và dữ liệu sao lưu; hiện chưa áp dụng xóa tự động, dữ liệu có thể còn được lưu sau các mốc mục tiêu này.";
export const buyingGuide = [
  {
    id: "choose",
    title: "Chọn sản phẩm hoặc dịch vụ",
    text: "Xem ảnh, mô tả, giá và tồn tại Cửa hàng. Dịch vụ mod cần ghi tên/cấu hình bàn phím. Nếu chưa có mẫu phù hợp, gửi yêu cầu đặt tìm để shop tư vấn; gửi yêu cầu không cần cọc và không cam kết đã có hàng.",
  },
  {
    id: "order",
    title: "Đặt hàng và giữ mã đơn",
    text: "Thêm vào giỏ hoặc chọn Mua ngay, đăng nhập Google, kiểm tra số lượng rồi nhập tên, số điện thoại, địa chỉ giao hoặc chọn nhận tại shop. Đặt thành công sẽ mở trang có mã đơn và QR. Lưu link này để xem tiến độ; ai có link đều có thể xem thông tin tra cứu được phép hiển thị.",
  },
  {
    id: "pay",
    title: "Chuyển khoản và chờ shop xác nhận",
    text: "Chọn cọc 20% tiền hàng/dịch vụ, trả 80% còn lại khi nhận hàng qua COD; hoặc chuyển khoản 100%. Kiểm tra tên người nhận, số tiền và nội dung trên QR của chính đơn. Shop chỉ xác nhận sau khi kiểm tra tiền thực vào tài khoản. Quét QR hoặc tạo đơn chưa có nghĩa đã thanh toán hay giữ hàng.",
  },
  {
    id: "delivery",
    title: "Giao và nhận hàng",
    text:
      shippingPolicy +
      " Khi nhận tại shop, hãy liên hệ Zalo để hẹn địa điểm và thời gian. Thời gian thực hiện/giao hàng phụ thuộc cấu hình, tình trạng hàng và lịch shop; shop xác nhận riêng, không có ngày giao mặc định.",
  },
  {
    id: "progress",
    title: "Theo dõi tiến độ",
    text: "Đơn đi lần lượt Đang chờ → Đang xử lý → Hoàn thành. Khách xem ảnh/video shop cập nhật ngay trên trang đơn. Hoàn thành là tiến độ công việc, không tự xác nhận đã nhận đủ COD. Khi cần kiểm tra thanh toán hoặc giao nhận, nhắn Zalo kèm mã đơn, không đăng link tra cứu công khai.",
  },
  {
    id: "cancel",
    title: "Đổi yêu cầu, hủy và hoàn tiền",
    text: "Khách không đổi hạng mục sau khi shop bắt đầu xử lý. Khi khách hủy, khoản cọc 20% tiền hàng/dịch vụ không hoàn theo chính sách shop. Phần tiền thực nhận vượt cọc được shop kiểm tra và xử lý hoàn; không có hoàn tiền tự động trên web. Bàn phím và linh kiện thuộc khách vẫn thuộc khách. Liên hệ shop để thống nhất giao trả, tình trạng linh kiện và các khoản phí liên quan.",
  },
] as const;
export const privacySections = [
  {
    id: "collect",
    title: "Thông tin shop tiếp nhận",
    text: "Tài khoản: email Google, tên hiển thị, SĐT/địa chỉ bạn tự lưu trong hồ sơ, ngày đăng ký và lần truy cập gần nhất. Đặt hàng: tên, số điện thoại, địa chỉ giao (nếu chọn ship), cấu hình bàn phím và ghi chú. Đặt tìm: thông tin liên hệ, ngân sách, link/ảnh mẫu. Tư vấn: nội dung chat và phiên trình duyệt. Shop lưu giao dịch thu/hoàn và hình ảnh tiến độ do admin cập nhật để xử lý đơn và hỗ trợ khách.",
  },
  {
    id: "access",
    title: "Ai có thể xem",
    text: "Admin được cấp quyền và đăng nhập Google xem thông tin cần cho vận hành. Người có link tra cứu thấy cấu hình/hạng mục, tiến độ, thanh toán, tên/SĐT đã che và ảnh/video tiến độ; không thấy địa chỉ, SĐT đầy đủ, giá vốn hay ghi chú nội bộ. Giữ riêng link/mã đơn. Ảnh mẫu đặt tìm chỉ shop xem; portfolio được shop chọn và đăng riêng, không tự công khai mọi ảnh đơn.",
  },
  {
    id: "browser",
    title: "Dữ liệu trên trình duyệt",
    text: "Giỏ hàng lưu ID, số lượng và giá tham khảo trong bộ nhớ trình duyệt; không lưu địa chỉ hay SĐT trong giỏ. Cookie phiên chat giúp mở lại lịch sử trên cùng trình duyệt trong 30 ngày. Bắt đầu phiên mới bỏ quyền mở lịch sử cũ trên trình duyệt, không xóa dữ liệu đã lưu tại shop. Cookie đăng nhập dùng cho khách hàng và quản trị viên. Shop ghi nhận ngày đăng ký và lần truy cập để quản lý tài khoản; trạng thái hoạt động thống kê theo 30 ngày gần nhất. Cấm hoặc xóa quyền truy cập không xóa lịch sử đơn và thanh toán.",
  },
  {
    id: "providers",
    title: "Dịch vụ hỗ trợ vận hành",
    text: "Dữ liệu nghiệp vụ được lưu trong hệ thống database và lưu trữ của shop dùng Supabase. Google xác thực tài khoản khách hàng và quản trị. Khi Gemini được bật và khách đồng ý, nội dung tư vấn, lịch sử giới hạn và catalog/chính sách công khai được gửi tới Google để tạo phản hồi AI. Không nhập SĐT, địa chỉ, thông tin ngân hàng hoặc mã đơn vào chat AI. Telegram nhận loại sự kiện và link quản trị cần đăng nhập; không gửi nội dung chat, địa chỉ hay SĐT khách trong thông báo. Khi mở Zalo, mạng xã hội hoặc video ngoài, dữ liệu được xử lý bởi dịch vụ tương ứng.",
  },
  {
    id: "retention",
    title: "Thời gian lưu và xử lý yêu cầu",
    text:
      retentionPolicy +
      " Liên hệ Zalo của shop nếu cần sửa thông tin, hỗ trợ về dữ liệu hoặc hỏi tiến độ xử lý yêu cầu. Shop kiểm tra đúng người/yêu cầu trước khi xử lý; dữ liệu thanh toán, lịch sử và bản sao lưu cần được rà soát cùng nhau.",
  },
] as const;
