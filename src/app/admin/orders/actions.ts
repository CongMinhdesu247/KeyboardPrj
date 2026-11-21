"use server";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  orderErrors,
  validVideoUrl,
  type OrderFormState,
} from "@/lib/order-contract";
import type { Json } from "@/lib/database.types";
import { integerInput } from "@/lib/catalog-input";
import { scheduleNotifications } from "@/lib/notifications";
import { validCatalogMp4 } from "@/lib/catalog-media";

export async function submitOrder(
  _state: OrderFormState,
  form: FormData,
): Promise<OrderFormState> {
  const { client } = await requireAdmin();
  let payload: Record<string, Json>;
  let uploaded: string | undefined;
  const text = (key: string, max: number, required = false) => {
    const value = String(form.get(key) ?? "").trim();
    if (value.length > max || (required && !value))
      throw new Error("Hãy điền đủ thông tin và kiểm tra độ dài nội dung.");
    return value;
  };
  try {
    const action = text("action", 15, true),
      requestId = text("requestId", 36, true);
    if (!/^[a-f0-9-]{36}$/i.test(requestId))
      throw new Error("Yêu cầu không hợp lệ. Hãy tải lại trang.");
    payload = { action, requestId };
    if (action === "create") {
      const phone = text("phone", 20, true).replace(/[\s().-]/g, "");
      if (!/^\+?[0-9]{9,15}$/.test(phone))
        throw new Error("Số điện thoại cần từ 9 đến 15 chữ số.");
      const items: Json[] = [];
      for (const [key, value] of form.entries())
        if (
          key.startsWith("qty-") &&
          String(value).trim() &&
          String(value) !== "0"
        ) {
          const itemId = key.slice(4);
          if (!/^[0-9]{1,16}$/.test(itemId))
            throw new Error("Hạng mục không hợp lệ.");
          items.push({
            itemId,
            quantity: integerInput(String(value), 1, 999, "Số lượng"),
            version: integerInput(
              String(form.get(`version-${itemId}`)),
              1,
              2147483647,
              "Phiên bản",
            ),
          });
        }
      if (!items.length || items.length > 50)
        throw new Error("Chọn từ 1 đến 50 hạng mục có số lượng.");
      payload = {
        ...payload,
        code: `TK-${randomBytes(16).toString("hex").toUpperCase()}`,
        customerName: text("customerName", 120, true),
        phone,
        keyboard: text("keyboard", 200, true),
        internalNote: text("internalNote", 2000),
        shippingNote: text("shippingNote", 500),
        plan: text("plan", 20, true),
        items,
      };
    } else {
      const orderId = text("orderId", 36, true);
      if (!/^[a-f0-9-]{36}$/i.test(orderId))
        throw new Error("Đơn không hợp lệ.");
      payload.orderId = orderId;
      if (action === "receipt" || action === "refund")
        Object.assign(payload, {
          amount: integerInput(
            text("amount", 14, true),
            1,
            1000000000000,
            "Số tiền",
          ),
          method: text("method", 10, true),
          reference: text("reference", 300, true),
        });
      else if (action === "advance")
        Object.assign(payload, {
          expectedStage: integerInput(
            text("expectedStage", 1, true),
            0,
            2,
            "Bước",
          ),
          note: text("note", 1000),
        });
      else if (action === "cancel") {
        const returns: Record<string, number> = {};
        for (const [key, value] of form.entries())
          if (key.startsWith("return-"))
            returns[key.slice(7)] = integerInput(
              String(value),
              0,
              999,
              "Thu hồi",
            );
        Object.assign(payload, { returns, reason: text("reason", 1000, true) });
      } else if (action === "proof") {
        const videoUrl = text("videoUrl", 500);
        if (!validVideoUrl(videoUrl))
          throw new Error("Link video phải là HTTPS YouTube hoặc TikTok.");
        Object.assign(payload, {
          stage: integerInput(text("stage", 1, true), 0, 2, "Bước"),
          note: text("note", 1000),
          videoUrl,
        });
        const file = form.get("media");
        if (file instanceof File && file.size) {
          if (file.size > 10 * 1024 * 1024)
            throw new Error("File tối đa 10 MB; ảnh tối đa 5 MB.");
          let bytes = Buffer.from(await file.arrayBuffer()),
            extension: string,
            contentType: string;
          if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            if (file.size > 5 * 1024 * 1024)
              throw new Error("Ảnh tối đa 5 MB.");
            try {
              bytes = await sharp(bytes, { limitInputPixels: 20000000 })
                .rotate()
                .resize({ width: 1600, withoutEnlargement: true })
                .webp({ quality: 85 })
                .toBuffer();
            } catch {
              throw new Error("Ảnh không hợp lệ hoặc quá lớn.");
            }
            extension = "webp";
            contentType = "image/webp";
          } else if (
            file.type === "video/mp4" &&
            validCatalogMp4(bytes)
          ) {
            extension = "mp4";
            contentType = "video/mp4";
          } else
            throw new Error(
              "Chỉ nhận ảnh JPEG/PNG/WebP hoặc video MP4 hợp lệ.",
            );
          uploaded = `${orderId}/${randomUUID()}.${extension}`;
          const result = await client.storage
            .from("order-media")
            .upload(uploaded, bytes, { contentType, upsert: false });
          if (result.error) throw new Error("Chưa tải được file. Hãy thử lại.");
          payload.path = uploaded;
        }
      } else throw new Error("Thao tác không hợp lệ.");
    }
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Thông tin không hợp lệ.",
    };
  }
  const result = await client.rpc("order_command", { p: payload });
  const data = result.data as {
    ok?: boolean;
    id?: string;
    code?: string;
  } | null;
  if (result.error || !data?.ok || !data.id) {
    // A lost RPC response may follow a commit; never delete committed evidence.
    if (uploaded && !result.error) await client.storage.from("order-media").remove([uploaded]);
    return {
      message:
        orderErrors[data?.code ?? ""] ??
        "Chưa lưu được. Hãy kiểm tra thông tin hoặc tải lại trang rồi thử lại.",
    };
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  scheduleNotifications();
  revalidatePath(`/admin/orders/${data.id}`);
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  if (payload.action === "create") redirect(`/admin/orders/${data.id}`);
  return {
    ok: true,
    message:
      "Đã lưu. Tiến độ đã cập nhật cho khách; tải lại trang trước thao tác tiếp theo.",
  };
}
