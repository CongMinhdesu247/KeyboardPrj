"use client";
import { useRef, useState } from "react";
import type { CatalogItem } from "@/lib/domain";
import { ShopImage } from "./shop-image";
import { SoundTest } from "./portfolio-gallery";

type Slide = { kind: "image" | "video" | "external"; url?: string };
export function ProductGallery({ item }: { item: CatalogItem }) {
  const photos = item.imageUrls?.length ? item.imageUrls : item.imageUrl ? [item.imageUrl] : [];
  const slides: Slide[] = photos.map((url) => ({ kind: "image", url }));
  if (item.videoUrl) slides.push({kind:"video",url:item.videoUrl});
  if (item.soundTestUrl) slides.push({kind:"external",url:item.soundTestUrl});
  if (!slides.length) slides.push({kind:"image"});
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [selected,setSelected] = useState(0), [failedVideo,setFailedVideo] = useState<string>();
  const active=Math.min(selected,slides.length-1);
  function choose(index: number) {
    setSelected(Math.max(0,Math.min(slides.length-1,index)));
  }
  const slide=slides[active];
  return (
    <section className="product-gallery" aria-label="Thư viện ảnh và sound test">
      <div className="product-gallery-stage" role="region" aria-label="Ảnh và video sản phẩm" tabIndex={0}
        onTouchStart={(e) => {
          const point=e.touches[0];
          touch.current=e.touches.length===1 && !(e.target as HTMLElement).closest("video,iframe,button,a") ? {x:point.clientX,y:point.clientY} : null;
        }}
        onTouchCancel={() => {touch.current=null;}}
        onTouchEnd={(e) => {
          const start=touch.current, end=e.changedTouches[0];touch.current=null;
          if (!start || !end) return;
          const dx=end.clientX-start.x,dy=end.clientY-start.y;
          if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.5) choose(active+(dx<0?1:-1));
        }}
        onKeyDown={(e) => { if(e.target!==e.currentTarget)return; const next=e.key==="ArrowLeft"?active-1:e.key==="ArrowRight"?active+1:e.key==="Home"?0:e.key==="End"?slides.length-1:null;if(next!==null){e.preventDefault();choose(next);} }}>
          <div className="product-gallery-slide" key={`${slide.kind}-${slide.url ?? "empty"}`}>
            {slide.kind==="image" && <ShopImage src={slide.url} alt={active===0?item.name:`${item.name} — ảnh ${active+1}`} width={1000} height={800} eager />}
            {slide.kind==="video" && (failedVideo===slide.url ? <div className="gallery-video-message"><p>Chưa phát được video.</p><a href={slide.url} target="_blank" rel="noreferrer">Mở video ở tab mới</a></div> : <video src={slide.url} controls playsInline preload="none" poster={photos[0]} aria-label={`Sound test ${item.name}`} onError={() => setFailedVideo(slide.url)} />)}
            {slide.kind==="external" && <div className="gallery-external-video"><h2>Nghe sound test</h2><SoundTest url={slide.url!} title={item.name} /></div>}
          </div>
      </div>
      {slides.length>1 && <>
        <div className="product-gallery-controls">
          <button type="button" className="button button-outline" disabled={active===0} aria-label="Ảnh/video trước" onClick={() => choose(active-1)}>‹</button>
          <p role="status">{slides[active]?.kind==="image"?"Ảnh":"Sound test"} {active+1} / {slides.length}</p>
          <button type="button" className="button button-outline" disabled={active===slides.length-1} aria-label="Ảnh/video tiếp theo" onClick={() => choose(active+1)}>›</button>
        </div>
        <div className="product-gallery-thumbs" aria-label="Chọn góc chụp hoặc video">
          {slides.map((slide,index) => <button key={`${slide.kind}-${index}`} type="button" aria-label={slide.kind==="image"?`Xem ảnh ${index+1}`:"Xem video sound test"} aria-pressed={index===active} onClick={() => choose(index)}>
            {slide.kind==="image" && slide.url ? (
              // Native thumbnails share the already bounded catalog image URLs.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.url} alt="" width={80} height={64} loading="lazy" />
            ) : <span>{slide.kind==="image"?"Ảnh":"Video"}</span>}
          </button>)}
        </div>
        <p className="gallery-hint">Vuốt ảnh hoặc dùng phím mũi tên để xem các góc khác.</p>
      </>}
    </section>
  );
}
