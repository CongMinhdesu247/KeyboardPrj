"use server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  parseCatalogInput,
  integerInput,
  type CatalogFormState,
} from "@/lib/catalog-input";
import { rpcSucceeded } from "@/lib/admin-contract";
import { parseBannerCrop, type BannerCropRect } from "@/lib/banner-crop";
import { catalogMediaFromRow } from "@/lib/catalog-media";
import { removeUnusedCatalogAsset } from "@/lib/catalog-media-storage";

function refreshCatalog(id?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  if (id) revalidatePath(`/shop/${id}`);
  revalidatePath("/admin/catalog");
  if (id) revalidatePath(`/admin/catalog/${id}`);
}
function failureMessage(data: unknown) {
  const code =
    data && typeof data === "object" && "code" in data ? data.code : "";
  if (code === "conflict")
    return "Dữ liệu đã thay đổi ở nơi khác. Hãy tải lại trang trước khi sửa tiếp.";
  if (code === "stock_limit")
    return "Số lượng sau điều chỉnh phải từ 0 đến 1.000.000. Không đủ tồn để trừ.";
  if (code === "immutable_type")
    return "Không đổi loại dịch vụ/linh kiện sau khi tạo. Hãy tạo mục mới.";
  return "Chưa lưu được thay đổi. Hãy kiểm tra dữ liệu và thử lại.";
}
export async function saveCatalogItem(
  _previous: CatalogFormState,
  form: FormData,
): Promise<CatalogFormState> {
  const { client } = await requireAdmin();
  let item;
  try {
    item = parseCatalogInput(form);
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Thông tin không hợp lệ.",
    };
  }
  let oldImage: string | null = null;
  if (item.id) {
    const old = await client
      .from("products_services")
      .select("image_path,version")
      .eq("id", Number(item.id))
      .is("archived_at", null)
      .single();
    if (old.error || old.data.version !== item.version)
      return {
        message:
          "Dữ liệu đã thay đổi hoặc không còn tồn tại. Hãy tải lại trang.",
      };
    oldImage = old.data.image_path;
  }
  const file = form.get("image");
  const hasNewFile = file instanceof File && file.size > 0;
  const removeImage = form.get("removeImage") === "on" && !hasNewFile;
  item.imagePath = removeImage ? "" : (oldImage ?? "");
  let uploaded: string | undefined;
  const rawCrop = form.get("crop");
  let crop: BannerCropRect | undefined;
  if (!removeImage && rawCrop) {
    try {
      crop = parseBannerCrop(rawCrop, 1);
    } catch {
      return { message: "Khung cắt ảnh không hợp lệ. Căn lại ảnh rồi thử lại." };
    }
  }
  if (!removeImage && ((file instanceof File && file.size > 0) || crop)) {
    if (
      file instanceof File &&
      file.size > 0 &&
      (file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    )
      return { message: "Ảnh cần là JPEG, PNG hoặc WebP, tối đa 5 MB." };
    try {
      let bytes: Buffer;
      if (file instanceof File && file.size > 0) {
        bytes = Buffer.from(await file.arrayBuffer());
      } else {
        if (!oldImage)
          return { message: "Chọn ảnh trước khi căn khung sản phẩm." };
        const stored = await client.storage
          .from("catalog-images")
          .download(oldImage);
        if (stored.error || !stored.data || stored.data.size > 5 * 1024 * 1024)
          return {
            message:
              "Chưa đọc được ảnh hiện tại. Hãy chọn lại ảnh từ máy.",
          };
        bytes = Buffer.from(await stored.data.arrayBuffer());
      }
      const metadata = await sharp(bytes, {
        limitInputPixels: 20_000_000,
      }).metadata();
      if (
        !metadata.format ||
        !["jpeg", "png", "webp"].includes(metadata.format) ||
        (metadata.pages ?? 1) > 1
      )
        return { message: "Chỉ nhận ảnh tĩnh JPEG/PNG/WebP hợp lệ." };
      const oriented = await sharp(bytes, { limitInputPixels: 20_000_000 })
        .rotate()
        .toBuffer({ resolveWithObject: true });
      if (
        crop &&
        (crop.left + crop.width > oriented.info.width ||
          crop.top + crop.height > oriented.info.height)
      )
        return { message: "Vùng cắt vượt quá ảnh gốc. Hãy căn lại ảnh." };
      let pipeline = sharp(oriented.data, { limitInputPixels: 20_000_000 });
      if (crop) pipeline = pipeline.extract(crop);
      const encoded = await pipeline
        .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      uploaded = `${randomUUID()}.webp`;
      const result = await client.storage
        .from("catalog-images")
        .upload(uploaded, encoded, {
          contentType: "image/webp",
          upsert: false,
        });
      if (result.error)
        return {
          message:
            "Chưa tải được ảnh. Dữ liệu sản phẩm chưa được lưu; hãy chọn lại ảnh và thử lại.",
        };
      item.imagePath = uploaded;
    } catch {
      return {
        message:
          "Không đọc được ảnh. Hãy chọn ảnh tĩnh hợp lệ, không quá 20 megapixel.",
      };
    }
  }
  const { data, error } = await client.rpc("save_catalog_item", {
    p_item: { ...item },
  });
  if (error || !rpcSucceeded(data)) {
    if (uploaded)
      await removeUnusedCatalogAsset(client, "catalog-images", uploaded);
    return {
      message: error
        ? "Chưa lưu được sản phẩm. Hãy kiểm tra giá, nhóm và kết nối rồi thử lại."
        : failureMessage(data),
    };
  }
  // DB đã commit; lỗi dọn ảnh cũ không đổi kết quả save, có thể dọn orphan sau.
  if (oldImage && oldImage !== item.imagePath)
    await removeUnusedCatalogAsset(client, "catalog-images", oldImage);
  refreshCatalog(data.id);
  const saved = await client.from("products_services").select("id,version,image_paths,video_path,video_url").eq("id",Number(data.id)).single();
  return {
    ok: true,
    catalogId: data.id,
    media: saved.data ? catalogMediaFromRow(saved.data) : undefined,
    message: item.id
      ? "Đã lưu thay đổi."
      : "Đã tạo mục mới. Quay về danh sách để nhập hàng hoặc chỉnh tiếp.",
  };
}
export async function adjustStock(
  _previous: CatalogFormState,
  form: FormData,
): Promise<CatalogFormState> {
  const { client } = await requireAdmin();
  let id, delta;
  try {
    id = integerInput(
      String(form.get("id")),
      1,
      Number.MAX_SAFE_INTEGER,
      "Mã sản phẩm",
    );
    delta = integerInput(
      String(form.get("delta")),
      -1000000,
      1000000,
      "Mức điều chỉnh",
    );
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Dữ liệu sai." };
  }
  const reason = String(form.get("reason") ?? "").trim(),
    requestId = String(form.get("requestId") ?? "");
  if (
    !delta ||
    reason.length < 3 ||
    reason.length > 300 ||
    !/^[a-f0-9-]{36}$/i.test(requestId)
  )
    return { message: "Nhập số tăng/giảm khác 0 và lý do từ 3–300 ký tự." };
  const { data, error } = await client.rpc("adjust_inventory", {
    p_id: id,
    p_delta: delta,
    p_reason: reason,
    p_request_id: requestId,
  });
  if (error || !rpcSucceeded(data))
    return {
      message: error
        ? "Chưa điều chỉnh được tồn kho. Hãy thử lại."
        : failureMessage(data),
    };
  refreshCatalog(String(id));
  return { ok: true, message: "Đã điều chỉnh tồn kho và ghi lịch sử." };
}
export async function archiveCatalogItem(
  _previous: CatalogFormState,
  form: FormData,
): Promise<CatalogFormState> {
  const { client } = await requireAdmin();
  let id, version;
  try {
    id = integerInput(
      String(form.get("id")),
      1,
      Number.MAX_SAFE_INTEGER,
      "Mã sản phẩm",
    );
    version = integerInput(
      String(form.get("version")),
      1,
      2147483646,
      "Phiên bản",
    );
  } catch {
    return { message: "Dữ liệu không hợp lệ." };
  }
  const { data, error } = await client.rpc("archive_catalog_item", {
    p_id: id,
    p_version: version,
  });
  if (error || !rpcSucceeded(data)) return { message: failureMessage(data) };
  refreshCatalog(String(id));
  redirect("/admin/catalog?archived=1");
}
