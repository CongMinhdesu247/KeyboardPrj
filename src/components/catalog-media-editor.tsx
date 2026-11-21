"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeCatalogMedia } from "@/app/admin/catalog/media-actions";
import { catalogAssetUrl, type CatalogMedia } from "@/lib/catalog-media";
import { ShopImage } from "./shop-image";

export function CatalogMediaEditor({
  initial,
  backendUrl,
  onMediaChange,
}: {
  initial: CatalogMedia;
  backendUrl: string;
  onMediaChange?: (media: CatalogMedia) => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<CatalogMedia>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState(initial.videoUrl);
  const current = saved && saved.version >= initial.version ? saved : initial;
  function request(media: CatalogMedia, operation: string) {
    const form = new FormData();
    form.set("id", media.id); form.set("version", String(media.version)); form.set("operation", operation);
    return form;
  }
  async function change(operation: string, value?: string[]) {
    setPending(true); setMessage("");
    try {
      const form = request(current, operation);
      if (value) form.set("images", JSON.stringify(value));
      if (operation === "video-url") form.set("videoUrl",link);
      const result = await changeCatalogMedia(form);
      if (result.media) { setSaved(result.media); onMediaChange?.(result.media); }
      setMessage(result.message);
      if (result.ok) {
        if (operation === "video-url" || operation === "remove-video") setLink(result.media?.videoUrl ?? "");
        router.refresh();
      }
    } catch { setMessage("Mất kết nối. Tải lại trang để kiểm tra ảnh/video đã lưu trước khi thử lại."); }
    finally { setPending(false); }
  }
  async function upload(files: File[], kind: "image" | "video") {
    if (!files.length) return;
    if (kind === "image" && files.length + current.images.length > 10) { setMessage("Tối đa 10 ảnh cho mỗi sản phẩm. Gỡ ảnh cũ hoặc chọn ít ảnh hơn."); return; }
    setPending(true);
    let media = current, completed = 0;
    try {
      for (const file of files) {
        setMessage(`Đang tải ${kind === "image" ? "ảnh" : "video"} ${completed + 1}/${files.length}…`);
        const form = request(media, kind); form.set("file", file);
        const result = await changeCatalogMedia(form);
        if (result.media) { media = result.media; setSaved(media); onMediaChange?.(media); }
        if (!result.ok) { setMessage(`${completed ? `Đã tải ${completed}/${files.length} file. ` : ""}${result.message}`); return; }
        completed++;
      }
      setMessage(`Đã lưu ${completed} ${kind === "image" ? "ảnh" : "video sound test"}.`);
      if (kind === "video") setLink("");
    } catch { setMessage(`Đã xử lý ${completed}/${files.length} file. Mất kết nối; kiểm tra danh sách trước khi chọn lại các file còn thiếu.`); }
    finally { setPending(false); router.refresh(); }
  }
  function move(index: number, target: number) {
    const next = [...current.images]; const [path] = next.splice(index,1); next.splice(target,0,path);
    void change("images",next);
  }
  return (
    <section className="catalog-media-editor" aria-label="Ảnh và sound test sản phẩm" aria-busy={pending}>
      <h2>Ảnh & sound test</h2>
      <p>Media được lưu ngay. Ảnh đầu tiên là ảnh bìa; thông tin và giá dùng nút Lưu thay đổi phía trên.</p>
      <label className="media-upload-label">Thêm ảnh ở các góc ({current.images.length}/10)
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending || current.images.length >= 10} onChange={(e) => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value=""; void upload(files,"image"); }} />
      </label>
      <p className="admin-muted">Có thể chọn nhiều ảnh cùng lúc. Mỗi ảnh tối đa 5 MB, ảnh tĩnh JPEG/PNG/WebP, tối đa 20 MP.</p>
      <ol className="catalog-media-list">
        {current.images.map((path,index) => (
          <li key={path}>
            <div className="catalog-media-thumb"><ShopImage src={catalogAssetUrl(backendUrl,"catalog-images",path)} alt={`Ảnh sản phẩm ${index+1}`} width={240} height={180} /></div>
            <strong>{index === 0 ? "Ảnh bìa" : `Ảnh ${index+1}`}</strong>
            <div className="catalog-media-buttons">
              {index > 0 && <button type="button" disabled={pending} aria-label={`Đặt ảnh ${index+1} làm ảnh bìa`} onClick={() => move(index,0)}>Làm ảnh bìa</button>}
              <button type="button" disabled={pending || index===0} aria-label={`Đưa ảnh ${index+1} lên trước`} onClick={() => move(index,index-1)}>Trước</button>
              <button type="button" disabled={pending || index===current.images.length-1} aria-label={`Đưa ảnh ${index+1} ra sau`} onClick={() => move(index,index+1)}>Sau</button>
              <button type="button" disabled={pending} aria-label={`Gỡ ảnh ${index+1}`} onClick={() => void change("images",current.images.filter((p) => p!==path))}>Gỡ ảnh</button>
            </div>
          </li>
        ))}
      </ol>
      <div className="catalog-sound-test">
        <h3>Video sound test</h3>
        {current.videoPath && <video key={current.videoPath} src={catalogAssetUrl(backendUrl,"catalog-videos",current.videoPath)} controls playsInline preload="metadata" />}
        {current.videoUrl && <p><a href={current.videoUrl} target="_blank" rel="noreferrer">Mở link sound test hiện tại</a></p>}
        <label className="media-upload-label">Tải video MP4
          <input type="file" accept="video/mp4" disabled={pending} onChange={(e) => { const files=Array.from(e.currentTarget.files ?? []); e.currentTarget.value=""; void upload(files,"video"); }} />
        </label>
        <p className="admin-muted">MP4 H.264/AAC tối đa 10 MB. Video dài hơn có thể dùng link YouTube/TikTok. Video và link thay thế nhau.</p>
        <label className="media-upload-label">Link YouTube hoặc TikTok
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={pending} maxLength={500} placeholder="https://…" />
        </label>
        <div className="form-actions">
          <button type="button" className="button button-outline" disabled={pending || !link.trim()} onClick={() => void change("video-url")}>Lưu link sound test</button>
          {(current.videoPath || current.videoUrl) && <button type="button" className="button button-outline" disabled={pending} onClick={() => void change("remove-video")}>Gỡ sound test</button>}
        </div>
      </div>
      {message && <p role="status" className="auth-feedback">{message}</p>}
    </section>
  );
}
