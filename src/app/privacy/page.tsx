import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
import { privacySections } from "@/lib/shop-policies";
export const metadata: Metadata = {
  title: "Thông tin riêng tư & lưu dữ liệu",
  description:
    "Thông tin TRUMP Keys tiếp nhận, phạm vi tra cứu đơn và cách liên hệ về dữ liệu.",
};
export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Thông tin riêng tư"
      description="Cách shop dùng thông tin để xử lý đơn, tư vấn và hỗ trợ bạn. Đọc trước khi gửi thông tin trên website."
      sections={privacySections}
    />
  );
}
