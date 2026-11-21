"use client";

import { useEffect, useRef } from "react";

export function FormError({ message, pending }: { message?: string; pending: boolean }) {
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && !pending) {
      feedback.current?.focus({ preventScroll: true });
      feedback.current?.scrollIntoView({ block: "nearest" });
    }
  }, [message, pending]);
  if (!message || pending) return null;
  return <p ref={feedback} role="status" tabIndex={-1} className="form-error">{message}</p>;
}
