"use client";
import { useEffect, useRef, useState } from "react";
import { getBannerCrop } from "@/lib/banner-crop";

type Source = { url: string; width: number; height: number };
export function BannerCrop({
  existing,
  label = "Ảnh banner",
  subject = "ảnh banner",
  hint = "Chọn ảnh rồi kéo để căn vùng hiển thị. Khung banner cố định 3:2, tối đa 5 MB/20 MP.",
  saveHint = "Ảnh chỉ được cắt khi bấm Lưu banner. Có thể dùng các thanh chỉnh bằng bàn phím.",
  aspect = 1.5,
  onSelectChange,
}: {
  existing?: string;
  label?: string;
  subject?: string;
  hint?: string;
  saveHint?: string;
  aspect?: number;
  onSelectChange?: (hasSelection: boolean) => void;
}) {
  const [source, setSource] = useState<Source>();
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [error, setError] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const blob = useRef<string | undefined>(undefined);
  const loading = useRef(0);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number }>(null);
  useEffect(() => () => { loading.current++; if (blob.current) URL.revokeObjectURL(blob.current); }, []);
  function clearSelection() {
    loading.current++;
    if (blob.current) { URL.revokeObjectURL(blob.current); blob.current = undefined; }
    if (fileInput.current) fileInput.current.value = "";
    setSource(undefined);
    setError("");
    onSelectChange?.(false);
  }
  async function load(url: string) {
    const request = ++loading.current;
    setSource(undefined); setError("");
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      if (request !== loading.current) return;
      if (image.naturalWidth * image.naturalHeight > 20000000) throw new Error();
      setSource({ url, width: image.naturalWidth, height: image.naturalHeight });
      setZoom(1); setPosition({ x: 50, y: 50 });
      onSelectChange?.(true);
    } catch {
      if (request === loading.current) {
        if (fileInput.current) fileInput.current.value = "";
        setError("Không đọc được ảnh. Chọn ảnh JPEG/PNG/WebP tối đa 5 MB/20 MP.");
        onSelectChange?.(false);
      }
    }
  }
  const cropWidth = source ? Math.min(source.width, source.height * aspect) / zoom : 0;
  const cropHeight = cropWidth / aspect;
  const crop = source ? getBannerCrop(source.width, source.height, zoom, position.x, position.y, aspect) : null;
  return <div className="banner-crop">
    <label>{label}<input ref={fileInput} aria-label={label} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0];
      loading.current++;
      if (blob.current) { URL.revokeObjectURL(blob.current); blob.current = undefined; }
      setSource(undefined); setError("");
      if (!file) { onSelectChange?.(false); return; }
      if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        event.currentTarget.value = "";
        setError("Ảnh JPEG/PNG/WebP tối đa 5 MB.");
        onSelectChange?.(false);
        return;
      }
      blob.current = URL.createObjectURL(file); void load(blob.current);
    }} /><small>{hint}</small></label>
    {existing && !source && <><button type="button" className="button button-outline" onClick={() => void load(existing)}>Căn lại ảnh hiện tại</button><small>Muốn lấy lại phần ảnh ngoài khung đã lưu, hãy chọn lại ảnh gốc.</small></>}
    <input name="crop" type="hidden" value={crop ? JSON.stringify(crop) : ""} />
    {error && <p role="alert" className="field-error">{error}</p>}
    {source && <div className="banner-crop-controls">
      <p>Kéo ảnh để giữ đúng góc bàn phím bạn muốn hiển thị.</p>
      <div ref={frame} className="banner-crop-frame" style={{ aspectRatio: String(aspect), maxWidth: aspect === 1 ? "480px" : undefined }} onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
      }} onPointerMove={event => {
        if (!drag.current || !frame.current) return;
        const scale = frame.current.clientWidth / cropWidth;
        const dx = (source.width - cropWidth) * scale;
        const dy = (source.height - cropHeight) * scale;
        setPosition({ x: Math.max(0, Math.min(100, drag.current.startX - (event.clientX - drag.current.x) / (dx || Infinity) * 100)), y: Math.max(0, Math.min(100, drag.current.startY - (event.clientY - drag.current.y) / (dy || Infinity) * 100)) });
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source.url} alt={`Vùng ${subject} sẽ hiển thị`} draggable={false} style={{ width: `${source.width / cropWidth * 100}%`, height: `${source.height / cropHeight * 100}%`, left: `${-(source.width / cropWidth - 1) * position.x}%`, top: `${-(source.height / cropHeight - 1) * position.y}%` }} />
        <span className="banner-crop-grid" aria-hidden="true" />
      </div>
      <label>Phóng đại<input aria-label={`Phóng đại ${subject}`} type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <div className="banner-crop-position"><label>Trái / phải<input aria-label={`Vị trí ngang ${subject}`} type="range" min="0" max="100" value={position.x} onChange={e => setPosition({ ...position, x: Number(e.target.value) })} /></label><label>Trên / dưới<input aria-label={`Vị trí dọc ${subject}`} type="range" min="0" max="100" value={position.y} onChange={e => setPosition({ ...position, y: Number(e.target.value) })} /></label></div>
      <div className="form-actions">
        <button type="button" className="text-button" onClick={() => { setZoom(1); setPosition({ x: 50, y: 50 }); }}>Đặt lại khung ảnh</button>
        <button type="button" className="text-button" onClick={clearSelection}>Bỏ ảnh đã chọn</button>
      </div>
      <small>{saveHint}</small>
    </div>}
  </div>;
}
