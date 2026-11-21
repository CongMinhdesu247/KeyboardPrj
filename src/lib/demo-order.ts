import type { PublicOrder } from "./domain";

// Chỉ public DTO giả. Không đặt PII, secret hoặc thông tin nội bộ ở đây.
export const demoOrder: PublicOrder = {
  code: "KB-DEMO2026",
  customerDisplayName: "An N. (mẫu)",
  customerPhoneMasked: "•••••••678",
  keyboard: "MonsGeek M1 · layout 75%",
  services: ["Lube 82 switch", "Cân chỉnh stabilizer", "Lót foam", "Tape mod"],
  paymentLabel: "Đã đặt cọc (minh họa)",
  updatedAt: "2026-11-19T03:30:00Z",
  steps: [
    {
      name: "Đang chờ",
      description: "Kiểm tra ngoại hình và từng phím.",
      status: "complete",
      updatedAt: "2026-11-18T02:00:00Z",
      note: "Đã kiểm tra đủ phím. Nội dung minh họa, không phải đơn thật.",
    },
    {
      name: "Đang xử lý",
      description: "Lube switch, cân stab và xử lý tiêu âm.",
      status: "current",
      updatedAt: "2026-11-19T03:30:00Z",
      note: "Đang cân chỉnh stabilizer trước khi lắp lại.",
    },
    {
      name: "Hoàn thành",
      description: "Hoàn tất kiểm tra, sound test và bàn giao.",
      status: "pending",
    },
  ],
};
