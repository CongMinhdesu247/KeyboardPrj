"use client";
import Link from "next/link";
import {useEffect,useRef,useState,useSyncExternalStore} from "react";
import type {PublicBanner} from "@/lib/banner-contract";
import {ShopImage} from "./shop-image";
import {ShopIcon} from "./shop-icon";
const motionQuery="(prefers-reduced-motion: reduce)";
const subscribeMotion=(notify:()=>void)=>{const media=window.matchMedia(motionQuery);media.addEventListener("change",notify);return()=>media.removeEventListener("change",notify);};
const subscribeVisibility=(notify:()=>void)=>{document.addEventListener("visibilitychange",notify);return()=>document.removeEventListener("visibilitychange",notify);};
const reducedMotion=()=>window.matchMedia(motionQuery).matches;
const visiblePage=()=>document.visibilityState==="visible";
export function HomeBanners({banners}:{banners:PublicBanner[]}) {
 const [selected,setSelected]=useState(0),touch=useRef<{x:number;y:number}|null>(null);
 const [requested,setRequested]=useState<boolean>(),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[touching,setTouching]=useState(false);
 const reduced=useSyncExternalStore(subscribeMotion,reducedMotion,()=>true),visible=useSyncExternalStore(subscribeVisibility,visiblePage,()=>false);
 const enabled=requested??!reduced;
 useEffect(()=>{
  if(banners.length<2||!enabled||hovered||focused||touching||!visible)return;
  const timer=window.setTimeout(()=>setSelected(previous=>(previous+1)%banners.length),4000);
  return()=>window.clearTimeout(timer);
 },[banners.length,selected,enabled,hovered,focused,touching,visible]);
 const active=Math.min(selected,banners.length-1),banner=banners[active];
 if(!banner)return null;
 const choose=(n:number)=>setSelected((n+banners.length)%banners.length);
 return <section className="container home-banners" aria-label="Sản phẩm nổi bật" aria-roledescription="bộ banner"
  onPointerEnter={e=>{if(e.pointerType==="mouse")setHovered(true);}} onPointerLeave={()=>setHovered(false)}
  onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
  <div className="home-banner-stage" tabIndex={0} role="group" aria-label={`Banner ${active+1} trên ${banners.length}`}
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;const next=e.key==="ArrowRight"?active+1:e.key==="ArrowLeft"?active-1:e.key==="Home"?0:e.key==="End"?banners.length-1:null;if(next!==null){e.preventDefault();choose(next);}}}
   onTouchStart={e=>{setTouching(true);const p=e.touches[0];touch.current=e.touches.length===1?{x:p.clientX,y:p.clientY}:null;}}
   onTouchCancel={()=>{touch.current=null;setTouching(false);}}
   onTouchEnd={e=>{setTouching(false);const start=touch.current,p=e.changedTouches[0];touch.current=null;if(start&&p){const dx=p.clientX-start.x,dy=p.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)choose(active+(dx<0?1:-1));}}}>
   <div className="home-banner-caption"><div><span className="home-banner-label">TRUMP Keys / Sản phẩm nổi bật</span><h1>{banner.title}</h1>{banner.subtitle&&<p>{banner.subtitle}</p>}</div><Link className="button button-primary" href={`/shop/${banner.productId}`}>Xem sản phẩm <ShopIcon name="arrow" size={18}/></Link></div>
   <Link href={`/shop/${banner.productId}`} className="home-banner-image" key={banner.imageUrl} aria-label={`Xem sản phẩm: ${banner.title}`}><ShopImage src={banner.imageUrl} alt={banner.title} width={1920} height={720} eager/></Link>
  </div>
  {banners.length>1&&<div className="home-banner-controls"><div className="home-banner-dots" aria-label="Chọn banner">{banners.map((b,i)=><button key={b.slot} type="button" aria-label={`Xem banner ${i+1}`} aria-pressed={active===i} onClick={()=>choose(i)}><span/></button>)}</div><div className="home-banner-arrows"><button className="home-banner-play" type="button" aria-label={enabled?"Tạm dừng tự chuyển banner":"Bật tự chuyển banner"} onClick={()=>setRequested(!enabled)}>{enabled?"Tạm dừng":"Tự chuyển"}</button><button type="button" aria-label="Banner trước" onClick={()=>choose(active-1)}>‹</button><span role="status" aria-live={enabled&&!hovered&&!focused?"off":"polite"}>{active+1} / {banners.length}</span><button type="button" aria-label="Banner tiếp theo" onClick={()=>choose(active+1)}>›</button></div></div>}
 </section>;
}
