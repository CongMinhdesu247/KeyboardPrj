"use client";
import { useEffect, useState } from "react";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setMessage("Chưa bật được chế độ offline. Bạn vẫn có thể dùng web."),
        );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const installed = () => {
      setPrompt(null);
      setMessage("Ứng dụng đã được cài đặt.");
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setMessage(
        "iPhone/iPad: mở bằng Safari → Chia sẻ → Thêm vào MH chính. Android/PC: mở menu trình duyệt → Cài đặt ứng dụng, nếu được hỗ trợ.",
      );
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setMessage("Hãy mở menu trình duyệt để cài ứng dụng nếu được hỗ trợ.");
    }
  }
  return (
    <div className="install-control">
      <button className="button button-quiet install-button" onClick={install}>
        ↓ <span>Cài ứng dụng</span>
      </button>
      {message && (
        <div className="install-message" role="status">
          {message}
          <button
            aria-label="Đóng hướng dẫn cài đặt"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
