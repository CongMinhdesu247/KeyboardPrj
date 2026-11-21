export type BannerCropRect = { left: number; top: number; width: number; height: number };

export function getBannerCrop(width: number, height: number, zoom: number, x: number, y: number, aspect = 1.5): BannerCropRect {
  const cropWidth = Math.min(width, height * aspect) / zoom;
  const cropHeight = cropWidth / aspect;
  return {
    left: Math.round((width - cropWidth) * x / 100),
    top: Math.round((height - cropHeight) * y / 100),
    width: Math.max(1, Math.floor(cropWidth)),
    height: Math.max(1, Math.floor(cropHeight)),
  };
}

export function parseBannerCrop(raw: unknown, aspect = 1.5): BannerCropRect | undefined {
  if (raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || raw.length > 300) throw new Error("Khung cắt ảnh không hợp lệ. Căn lại ảnh rồi thử lại.");
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error("Khung cắt ảnh không hợp lệ. Căn lại ảnh rồi thử lại."); }
  if (!value || ["left", "top", "width", "height"].some(k => !Number.isSafeInteger(value[k])) || value.left < 0 || value.top < 0 || value.width < 1 || value.height < 1 || Math.abs(value.width - value.height * aspect) > 2)
    throw new Error("Khung cắt ảnh không hợp lệ. Căn lại ảnh rồi thử lại.");
  return { left: value.left, top: value.top, width: value.width, height: value.height };
}
