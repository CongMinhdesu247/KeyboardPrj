import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
import { buyingGuide } from "@/lib/shop-policies";
export const metadata: Metadata = {
  title: "Hướng dẫn mua hàng & thanh toán",
  description:
    "Cách đặt đơn, cọc 20%, COD, theo dõi tiến độ và liên hệ TRUMP Keys.",
};
export default function GuidePage() {
  return (
    <PolicyPage
      title="Hướng dẫn mua hàng"
      description="Từ chọn bộ phím đến nhận hàng: kiểm tra thông tin, thanh toán và theo dõi đơn của bạn."
      sections={buyingGuide}
    />
  );
}
