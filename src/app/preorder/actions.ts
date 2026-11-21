"use server";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyRequestToken, issueRequestToken } from "@/lib/request-token";
import { safeReferenceUrl, type M4State } from "@/lib/m4-contract";
import { integerInput } from "@/lib/catalog-input";
import { webpImage } from "@/lib/media-image";
import { scheduleNotifications } from "@/lib/notifications";
import { clientAddress } from "@/lib/request-security";

export async function submitFindRequest(
  _previous: M4State,
  form: FormData,
): Promise<M4State> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    return {
      message: "Shop chưa mở nhận yêu cầu trên web. Vui lòng liên hệ Zalo.",
    };
  const id = verifyRequestToken(String(form.get("token") ?? ""), secret);
  if (!id)
    return {
      message:
        "Phiên gửi đã hết hạn hoặc không hợp lệ. Hãy tải lại trang trước khi gửi.",
    };
  let payload: {
    id: string;
    category: string;
    customerName: string;
    phone: string;
    budget: number;
    referenceUrl: string;
    note: string;
    hash: string;
    imagePath: string;
  };
  let file: File | undefined;
  const text = (key: string, max: number, required = false) => {
    const v = String(form.get(key) ?? "").trim();
    if (v.length > max || (required && !v))
      throw new Error("Điền đủ thông tin và kiểm tra độ dài nội dung.");
    return v;
  };
  try {
    if (text("website", 300) || form.get("consent") !== "on")
      throw new Error("Cần đồng ý để shop liên hệ về yêu cầu này.");
    const category = text("category", 10, true),
      customerName = text("customerName", 120, true),
      phone = text("phone", 20, true).replace(/[\s().-]/g, ""),
      referenceUrl = text("referenceUrl", 500),
      note = text("note", 2000),
      budget = integerInput(
        text("budget", 12, true),
        0,
        1000000000,
        "Ngân sách",
      );
    if (
      !["keycap", "stab"].includes(category) ||
      !/^\+?[0-9]{9,15}$/.test(phone)
    )
      throw new Error("Kiểm tra loại sản phẩm và số điện thoại (9–15 chữ số).");
    if (!safeReferenceUrl(referenceUrl))
      throw new Error(
        "Link tham khảo cần dùng HTTPS, không kèm thông tin đăng nhập.",
      );
    const value = form.get("image");
    file = value instanceof File && value.size ? value : undefined;
    if (
      file &&
      (file.size > 5242880 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    )
      throw new Error("Chỉ nhận ảnh JPEG/PNG/WebP tối đa 5 MB.");
    if (!file && !referenceUrl)
      throw new Error("Thêm ít nhất một ảnh hoặc link mẫu muốn tìm.");
    const imageHash = file
      ? createHash("sha256")
          .update(Buffer.from(await file.arrayBuffer()))
          .digest("hex")
      : "";
    const values = {
      id,
      category,
      customerName,
      phone,
      budget,
      referenceUrl,
      note,
    };
    payload = {
      ...values,
      hash: createHash("sha256")
        .update(JSON.stringify({ ...values, imageHash }))
        .digest("hex"),
      imagePath: "",
    };
  } catch (e) {
    return {
      message: e instanceof Error ? e.message : "Thông tin không hợp lệ.",
    };
  }
  const client = createServiceClient();
  const existing = await client.rpc("lookup_request_submission", {
    p_id: id,
    p_hash: payload.hash,
  });
  if (existing.error)
    return { message: "Chưa kiểm tra được yêu cầu. Vui lòng thử lại." };
  const success = () => ({
    ok: true,
    reference: `FT-${id.replaceAll("-", "").slice(0, 16).toUpperCase()}`,
    message:
      "Shop đã nhận yêu cầu và sẽ liên hệ qua số điện thoại/Zalo. Không cần cọc ở bước đặt tìm.",
  });
  if (existing.data) return success();
  const h = await headers(),
    address = clientAddress(h, process.env.TRUSTED_PROXY);
  if (!address) return { message: "Không xác minh được nguồn truy cập. Hãy thử lại sau." };
  const jar = await cookies();
  let visitorToken = jar.get("tk-find-visitor")?.value ?? "";
  let visitor = verifyRequestToken(visitorToken, secret);
  if (!visitor) {
    visitorToken = issueRequestToken(secret);
    visitor = verifyRequestToken(visitorToken, secret)!;
    jar.set("tk-find-visitor", visitorToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ORIGIN?.startsWith("https:"),
      path: "/preorder",
      maxAge: 3600,
    });
  }
  const key = createHmac("sha256", secret)
    .update(`find-budget:${address}${process.env.TRUSTED_PROXY === "cloudflare" ? "" : `:${visitor}`}`)
    .digest("hex");
  const quota = await client.rpc("consume_request_budget", { p_key: key });
  if (quota.error || !quota.data)
    return {
      message:
        "Đã có nhiều lượt gửi. Hãy thử lại sau một giờ hoặc liên hệ Zalo.",
    };
  if (file) {
    let bytes: Buffer;
    try {
      bytes = await webpImage(file);
    } catch (e) {
      return { message: e instanceof Error ? e.message : "Ảnh không hợp lệ." };
    }
    payload.imagePath = `${randomUUID()}.webp`;
    const upload = await client.storage
      .from("request-images")
      .upload(payload.imagePath, bytes, {
        contentType: "image/webp",
        upsert: false,
      });
    if (upload.error)
      return {
        message: "Chưa tải được ảnh. Thông tin vẫn được giữ để bạn thử lại.",
      };
  }
  const result = await client.rpc("submit_custom_request", { p: payload });
  const data = result.data as { ok?: boolean; duplicate?: boolean } | null;
  if (result.error) {
    // A network failure may follow a committed transaction: never delete its referenced file.
    const check = await client.rpc("lookup_request_submission", {
      p_id: id,
      p_hash: payload.hash,
    });
    if (check.data) {
      const row = check.data as { imagePath?: string };
      if (payload.imagePath && row.imagePath !== payload.imagePath)
        await client.storage.from("request-images").remove([payload.imagePath]);
      return success();
    }
    return {
      message:
        "Chưa xác nhận được kết quả gửi. Hãy giữ nguyên thông tin và thử lại để tránh gửi trùng.",
    };
  }
  if (!data?.ok || data.duplicate) {
    if (payload.imagePath)
      await client.storage.from("request-images").remove([payload.imagePath]);
  }
  if (!data?.ok)
    return {
      message:
        "Phiên gửi đã được dùng cho nội dung khác. Hãy tải lại trang để tạo yêu cầu mới.",
    };
  revalidatePath("/admin/requests");
  scheduleNotifications();
  return success();
}
