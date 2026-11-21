"use client";
import { useState } from "react";
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="copy-field">
      <label>
        {label}
        <input
          readOnly
          value={value}
          onClick={(e) => e.currentTarget.select()}
        />
      </label>
      <button
        type="button"
        className="button button-outline"
        aria-label={`Sao chép ${label.toLocaleLowerCase("vi")}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("Đã sao chép.");
          } catch {
            setMessage("Chọn nội dung trong ô để sao chép thủ công.");
          }
        }}
      >
        Sao chép
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
