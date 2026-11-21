import "server-only";
import sharp from "sharp";
export async function webpImage(file: File) {
  if (
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new Error("Chỉ nhận ảnh JPEG/PNG/WebP tối đa 5 MB.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, { limitInputPixels: 20000000 }).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1)
      throw new Error("Invalid image format");
    return await sharp(input, {
      limitInputPixels: 20000000,
    })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error("Ảnh không hợp lệ hoặc vượt 20 megapixel.");
  }
}
