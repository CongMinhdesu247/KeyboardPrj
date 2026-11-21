"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container error-page">
      <h1>Chưa tải được nội dung.</h1>
      <p>Hãy kiểm tra kết nối rồi thử lại.</p>
      <button className="button button-primary" onClick={reset}>
        Thử lại
      </button>
    </main>
  );
}
