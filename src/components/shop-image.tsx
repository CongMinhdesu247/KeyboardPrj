"use client";

import { useState } from "react";

export function ShopImage({
  src, alt, width, height, eager = false,
}: {
  src?: string;
  alt: string;
  width: number;
  height: number;
  eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  if (src && failedSource !== src) {
    // Storage URLs are supplied by the existing authorized/public server readers.
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={(element) => { if (element?.complete && element.naturalWidth === 0) setFailedSource(src); }} src={src} alt={alt} width={width} height={height} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} onError={() => setFailedSource(src)} />;
  }
  const label = src ? "Ảnh chưa tải được" : "Chưa có ảnh";
  return (
    <span className="product-no-image" role="img" aria-label={`${label}: ${alt}`}>
      <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="4" y="12" width="40" height="25" rx="4" /><path d="M10 19h3m4 0h3m4 0h3m4 0h3M10 25h3m4 0h3m4 0h3m4 0h3M15 31h18" /></svg>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
