"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyRequestToken } from "@/lib/request-token";
import { parseCart } from "@/lib/cart";
import { scheduleNotifications } from "@/lib/notifications";
import { readAccount } from "@/lib/customer-account";
export type CheckoutState = { ok?: boolean; code?: string; message?: string };
export async function placeCustomerOrder(
  _previous: CheckoutState,
  form: FormData,
): Promise<CheckoutState> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return { message: "Shop chưa mở đặt hàng trên web." };
  const account=await readAccount();
  if (!account || account.account.status!=="active") return {message:"Đăng nhập tài khoản Google đang được phép sử dụng trước khi đặt hàng."};
  const requestId = verifyRequestToken(
    String(form.get("token") ?? ""),
    secret,
    Date.now(),
    "checkout",
  );
  if (!requestId)
    return {
      message: "Phiên đặt hàng hết hạn. Hãy tải lại trang để tiếp tục.",
    };
  const text = (key: string, max: number, required = false) => {
    const s = String(form.get(key) ?? "").trim();
    if (s.length > max || (required && !s))
      throw new Error(
        "Điền đủ thông tin đặt hàng và kiểm tra độ dài nội dung.",
      );
    return s;
  };
  let payload;
  try {
    if (text("website", 300) || form.get("consent") !== "on")
      throw new Error("Cần đồng ý thông tin và điều kiện đặt hàng.");
    const customerName = text("customerName", 120, true),
      phone = text("phone", 20, true).replace(/[\s().-]/g, ""),
      delivery = text("delivery", 10, true),
      address = text("address", 1000),
      plan = text("plan", 20, true),
      note = text("note", 2000),
      keyboard = text("keyboard", 200);
    if (!/^\+?[0-9]{9,15}$/.test(phone))
      throw new Error("Số điện thoại cần từ 9 đến 15 chữ số.");
    if (
      !["ship", "pickup"].includes(delivery) ||
      !["deposit_cod", "transfer_full"].includes(plan)
    )
      throw new Error("Phương án nhận hàng hoặc thanh toán không hợp lệ.");
    if (delivery === "ship" && address.length < 10)
      throw new Error("Điền địa chỉ nhận hàng đầy đủ (ít nhất 10 ký tự).");
    const raw = text("items", 10000, true),
      items = parseCart(raw);
    if (!items.length || items.length !== JSON.parse(raw).length)
      throw new Error("Giỏ hàng không hợp lệ, hãy kiểm tra lại.");
    const data = {
      accountId:account.account.id,
      requestId,
      customerName,
      phone,
      delivery,
      address: delivery === "ship" ? address : "",
      plan,
      note,
      keyboard,
      items: items.sort((a, b) => Number(a.itemId) - Number(b.itemId)),
    };
    payload = {
      ...data,
      hash: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
      code: `TK-${randomBytes(16).toString("hex").toUpperCase()}`,
    };
  } catch (e) {
    return {
      message: e instanceof Error ? e.message : "Thông tin không hợp lệ.",
    };
  }
  const client = createServiceClient();
  const previous = await client.rpc("lookup_checkout", {
    p_request: requestId,
    p_hash: payload.hash,
  });
  if (previous.error)
    return {
      message:
        "Chưa kiểm tra được đơn đã gửi. Hãy giữ nguyên thông tin và thử lại.",
    };
  if (previous.data) return previous.data as CheckoutState;
  // Account/global quota is enforced atomically inside submit_account_order, including direct RPC calls.
  const result = await account.client.rpc("submit_account_order", { p: payload });
  if (result.error) {
    const check = await client.rpc("lookup_checkout", {
      p_request: requestId,
      p_hash: payload.hash,
    });
    return check.data
      ? (check.data as CheckoutState)
      : {
          message:
            "Chưa xác nhận được kết quả đặt hàng. Giữ nguyên thông tin và gửi lại để tránh tạo trùng.",
        };
  }
  const data = result.data as CheckoutState & { error?: string };
  if (!data.ok) {
    const messages: Record<string, string> = {
      quota: "Đã có nhiều lượt đặt hàng. Hãy thử lại sau hoặc liên hệ Zalo.",
      unavailable:
        "Một mặt hàng đã tạm ẩn hoặc ngừng bán. Hãy kiểm tra lại giỏ hàng.",
      price_changed:
        "Giá đã thay đổi. Hãy kiểm tra và xác nhận giá mới trong giỏ hàng.",
      insufficient_stock:
        "Không đủ tồn cho số lượng bạn chọn. Hãy cập nhật giỏ hàng.",
      keyboard_required: "Nhập tên/cấu hình bàn phím cần thực hiện dịch vụ.",
      request_conflict:
        "Phiên này đã được dùng cho nội dung khác. Hãy mở lại trang đặt hàng.",
    };
    return {
      message:
        messages[data.error ?? ""] ??
        "Chưa tạo được đơn. Hãy kiểm tra thông tin và thử lại.",
    };
  }
  revalidatePath("/admin/orders");
  revalidatePath("/account");
  scheduleNotifications();
  revalidatePath("/admin");
  return { ok: true, code: data.code };
}
