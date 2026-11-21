"use server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { integerInput } from "@/lib/catalog-input";
import { validVideoUrl } from "@/lib/order-contract";
import { catalogMediaFromRow, validCatalogMp4, type CatalogMediaResult } from "@/lib/catalog-media";
import { removeUnusedCatalogAsset } from "@/lib/catalog-media-storage";

export async function changeCatalogMedia(form: FormData): Promise<CatalogMediaResult> {
  const { client } = await requireAdmin();
  let id: number, version: number;
  try {
    id = integerInput(String(form.get("id")), 1, Number.MAX_SAFE_INTEGER, "Mã sản phẩm");
    version = integerInput(String(form.get("version")), 1, 2147483646, "Phiên bản");
  } catch { return { message: "Thông tin sản phẩm không hợp lệ." }; }
  const read = () => client.from("products_services").select("id,version,image_paths,video_path,video_url").eq("id", id).is("archived_at", null).single();
  const old = await read();
  if (old.error) return { message: "Không đọc được sản phẩm. Hãy tải lại trang." };
  if (old.data.version !== version) return { message: "Sản phẩm đã thay đổi. Hãy thử lại với dữ liệu mới.", media: catalogMediaFromRow(old.data) };
  let images = [...old.data.image_paths], videoPath = old.data.video_path, videoUrl = old.data.video_url;
  let uploaded: { bucket: "catalog-images" | "catalog-videos"; path: string } | undefined;
  const operation = String(form.get("operation"));
  try {
    if (operation === "image" || operation === "video") {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("Chọn file để tải lên.");
      let bytes: Buffer, contentType: string;
      if (operation === "image") {
        if (images.length >= 10) throw new Error("Mỗi sản phẩm tối đa 10 ảnh. Gỡ một ảnh trước khi thêm.");
        if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Ảnh JPEG/PNG/WebP tối đa 5 MB.");
        const input = Buffer.from(await file.arrayBuffer());
        const meta = await sharp(input, { limitInputPixels: 20000000 }).metadata();
        if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Chỉ nhận ảnh tĩnh hợp lệ.");
        bytes = await sharp(input, { limitInputPixels: 20000000 }).rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
        contentType = "image/webp";
        uploaded = { bucket: "catalog-images", path: `${randomUUID()}.webp` };
      } else {
        if (file.size > 10 * 1024 * 1024 || file.type !== "video/mp4") throw new Error("Video MP4 tối đa 10 MB; dùng link YouTube/TikTok cho video dài hơn.");
        bytes = Buffer.from(await file.arrayBuffer());
        if (!validCatalogMp4(bytes)) throw new Error("File không phải MP4 hợp lệ. Hãy xuất H.264/AAC trước khi tải lên.");
        contentType = "video/mp4";
        uploaded = { bucket: "catalog-videos", path: `${randomUUID()}.mp4` };
      }
      const upload = await client.storage.from(uploaded.bucket).upload(uploaded.path, bytes, {contentType,upsert:false});
      if (upload.error) throw new Error("Chưa tải được file. Hãy kiểm tra kết nối và thử lại.");
      if (operation === "image") images.push(uploaded.path);
      else { videoPath = uploaded.path; videoUrl = ""; }
    } else if (operation === "images") {
      const paths: unknown = JSON.parse(String(form.get("images")));
      if (!Array.isArray(paths) || paths.length > 10 || new Set(paths).size !== paths.length || !paths.every((p) => typeof p === "string" && old.data.image_paths.includes(p))) throw new Error("Danh sách ảnh không hợp lệ. Hãy tải lại trang.");
      images = paths;
    } else if (operation === "video-url") {
      videoUrl = String(form.get("videoUrl") ?? "").trim();
      if (!validVideoUrl(videoUrl)) throw new Error("Dùng link HTTPS của YouTube hoặc TikTok.");
      videoPath = null;
    } else if (operation === "remove-video") { videoPath = null; videoUrl = ""; }
    else throw new Error("Thao tác không hợp lệ.");
  } catch (error) {
    if (uploaded) await removeUnusedCatalogAsset(client, uploaded.bucket, uploaded.path);
    return { message: error instanceof Error && !/sharp|Input|pixel|corrupt|unsupported/i.test(error.message) ? error.message : "Không đọc được ảnh; dùng ảnh tĩnh tối đa 20 megapixel." };
  }
  const result = await client.rpc("set_catalog_media", { p_id:id,p_version:version,p_images:images,p_video_path:videoPath ?? "",p_video_url:videoUrl });
  // Reconcile against the DB even when the RPC response was lost after commit.
  const fresh = await read();
  const matches = fresh.data && JSON.stringify(fresh.data.image_paths)===JSON.stringify(images) && fresh.data.video_path===videoPath && fresh.data.video_url===videoUrl;
  if (result.error || !(result.data as {ok?:boolean})?.ok) {
    if (!matches) {
      if (uploaded && !fresh.error) await removeUnusedCatalogAsset(client, uploaded.bucket, uploaded.path);
      return { message: "Chưa lưu được media hoặc sản phẩm vừa thay đổi. Kiểm tra danh sách rồi thử lại.", media: fresh.data ? catalogMediaFromRow(fresh.data) : undefined };
    }
  }
  if (fresh.error) return { message: "File đã được xử lý nhưng chưa đọc lại được trạng thái. Hãy tải lại trang trước khi thao tác tiếp." };
  for (const path of old.data.image_paths.filter((p) => !fresh.data.image_paths.includes(p))) await removeUnusedCatalogAsset(client,"catalog-images",path);
  if (old.data.video_path && old.data.video_path !== fresh.data.video_path) await removeUnusedCatalogAsset(client,"catalog-videos",old.data.video_path);
  for (const path of ["/","/shop","/cart","/checkout","/admin","/admin/catalog",`/shop/${id}`,`/admin/catalog/${id}`]) revalidatePath(path);
  return {ok:true,message:"Đã lưu ảnh và sound test.",media:catalogMediaFromRow(fresh.data)};
}
