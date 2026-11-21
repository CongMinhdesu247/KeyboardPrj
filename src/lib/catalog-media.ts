export type CatalogMedia = { id: string; version: number; images: string[]; videoPath: string | null; videoUrl: string };
export type CatalogMediaResult = { ok?: boolean; message: string; media?: CatalogMedia };
export const maxCatalogImages = 10;
export function catalogAssetUrl(base: string, bucket: "catalog-images" | "catalog-videos", path: string) {
  return `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(path)}`;
}
export function catalogMediaFromRow(row: { id: string | number; version: number; image_paths: string[]; video_path: string | null; video_url: string }): CatalogMedia {
  return { id: String(row.id), version: row.version, images: row.image_paths, videoPath: row.video_path, videoUrl: row.video_url };
}
// Validate bounded ISO-BMFF boxes, not just a renamed file or an ftyp prefix.
// Codec playback is checked by the browser; recommend H.264/AAC MP4 to admins.
export function validCatalogMp4(bytes: Uint8Array) {
  if (bytes.byteLength < 32 || bytes.byteLength > 10 * 1024 * 1024) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0, moov = false, mdat = false;
  const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return false;
    let size = view.getUint32(offset), header = 8;
    const kind = text(offset + 4);
    if (size === 1) {
      if (offset + 16 > bytes.length) return false;
      const extended = view.getBigUint64(offset + 8);
      if (extended > BigInt(bytes.length)) return false;
      size = Number(extended); header = 16;
    } else if (size === 0) size = bytes.length - offset;
    if (size < header || offset + size > bytes.length) return false;
    if (offset === 0 && (kind !== "ftyp" || size < 16 || !["isom", "iso2", "mp41", "mp42", "avc1", "iso5", "iso6"].includes(text(header)))) return false;
    moov ||= kind === "moov" && size > header;
    mdat ||= kind === "mdat" && size > header;
    offset += size;
  }
  return moov && mdat;
}
