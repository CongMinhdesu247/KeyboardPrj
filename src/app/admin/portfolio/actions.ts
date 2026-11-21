"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { webpImage } from "@/lib/media-image";
import { validVideoUrl, type AdminOrder } from "@/lib/order-contract";
import { integerInput } from "@/lib/catalog-input";
import type { M4State, PortfolioItem } from "@/lib/m4-contract";

export async function savePortfolio(
  _state: M4State,
  form: FormData,
): Promise<M4State> {
  const { client } = await requireAdmin();
  const text = (name: string, max: number) => {
    const s = String(form.get(name) ?? "").trim();
    if (s.length > max)
      throw new Error("Nội dung quá dài. Hãy rút gọn và thử lại.");
    return s;
  };
  let id: string,
    version: number,
    title: string,
    keyboard: string,
    mods: string,
    description: string,
    videoUrl: string;
  try {
    id = text("id", 36);
    version = integerInput(text("version", 10), 0, 2147483647, "Phiên bản");
    title = text("title", 120);
    keyboard = text("keyboard", 200);
    mods = text("mods", 2000);
    description = text("description", 2000);
    videoUrl = text("videoUrl", 500);
    if (!/^[a-f0-9-]{36}$/i.test(id) || !title || !keyboard)
      throw new Error("Nhập tên bài và cấu hình bàn phím.");
    if (!validVideoUrl(videoUrl))
      throw new Error("Video cần là link HTTPS YouTube hoặc TikTok hợp lệ.");
  } catch (e) {
    return {
      message: e instanceof Error ? e.message : "Thông tin không hợp lệ.",
    };
  }
  const published = form.get("published") === "on",
    approved = form.get("approved") === "on";
  if (published && !approved)
    return {
      message:
        "Xác nhận đã kiểm tra quyền sử dụng và thông tin riêng tư trước khi công khai.",
    };
  const listed = await client.rpc("list_portfolio_admin");
  if (listed.error)
    return { message: "Chưa kiểm tra được phiên bản bài. Hãy thử lại." };
  const old = (listed.data as unknown as PortfolioItem[]).find(
    (i) => i.id === id,
  );
  if ((old && old.version !== version) || (!old && version !== 0))
    return { message: "Bài đã thay đổi hoặc đã lưu trữ. Hãy tải lại trang." };
  let path = old?.image_path ?? "",
    uploaded: string | undefined;
  const file = form.get("image"),
    sourceOrder = String(form.get("sourceOrder") ?? "").trim(),
    sourceEvent = String(form.get("sourceEvent") ?? "").trim();
  try {
    let bytes: Buffer | undefined;
    if (file instanceof File && file.size) bytes = await webpImage(file);
    else if (sourceOrder || sourceEvent) {
      if (
        !/^[a-f0-9-]{36}$/i.test(sourceOrder) ||
        !/^[a-f0-9-]{36}$/i.test(sourceEvent)
      )
        throw new Error("Mã đơn hoặc mã ảnh nguồn không hợp lệ.");
      const order = await client.rpc("read_order", { p_id: sourceOrder });
      if (order.error || !order.data)
        throw new Error("Không tìm thấy đơn nguồn.");
      const event = (order.data as unknown as AdminOrder).events.find(
        (e) => e.id === sourceEvent && e.path?.endsWith(".webp"),
      );
      if (!event?.path)
        throw new Error(
          "Ảnh đã chọn không thuộc đơn nguồn hoặc không phải ảnh WebP.",
        );
      const downloaded = await client.storage
        .from("order-media")
        .download(event.path);
      if (downloaded.error) throw new Error("Chưa đọc được ảnh nguồn.");
      bytes = await webpImage(
        new File([downloaded.data], "source.webp", { type: "image/webp" }),
      );
    }
    if (bytes) {
      uploaded = `${id}/${randomUUID()}.webp`;
      const upload = await client.storage
        .from("portfolio-media")
        .upload(uploaded, bytes, { contentType: "image/webp", upsert: false });
      if (upload.error) throw new Error("Chưa tải được ảnh portfolio.");
      path = uploaded;
    }
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Chưa lưu được ảnh." };
  }
  if (published && !path)
    return { message: "Cần thêm ảnh trước khi công khai." };
  const result = await client.rpc("save_portfolio", {
    p: {
      id,
      version,
      title,
      keyboard,
      mods,
      description,
      videoUrl,
      imagePath: path,
      published,
      approved,
    },
  });
  const resultData = result.data as { ok?: boolean; code?: string } | null;
  if (result.error || !resultData?.ok) {
    // Only a confirmed business rejection is safe to clean up immediately.
    if (uploaded && !result.error)
      await client.storage.from("portfolio-media").remove([uploaded]);
    return {
      message:
        resultData?.code === "approval_required"
          ? "Cần ảnh và xác nhận trước khi công khai."
          : "Chưa xác nhận được kết quả lưu. Hãy tải lại danh sách trước khi gửi lại.",
    };
  }
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${id}`);
  if (version === 0) redirect(`/admin/portfolio/${id}`);
  return {
    ok: true,
    message: published ? "Đã công khai portfolio." : "Đã lưu bản nháp.",
  };
}
export async function archivePortfolio(
  _state: M4State,
  form: FormData,
): Promise<M4State> {
  const { client } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  let version: number;
  try {
    version = integerInput(
      String(form.get("version")),
      1,
      2147483647,
      "Phiên bản",
    );
  } catch {
    return { message: "Hãy tải lại bài." };
  }
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { message: "Bài không hợp lệ." };
  const result = await client.rpc("save_portfolio", {
    p: { id, version, action: "archive" },
  });
  if (result.error || !(result.data as { ok?: boolean })?.ok)
    return { message: "Bài đã thay đổi. Hãy tải lại và thử lại." };
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/admin/portfolio");
  redirect("/admin/portfolio?archived=1");
}
