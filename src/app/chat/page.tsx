import type { Metadata } from "next";
import { cookies } from "next/headers";
import { chatHash, consultationOpen, type ChatTurn } from "@/lib/chat-contract";
import { issueRequestToken } from "@/lib/request-token";
import { aiConfigured } from "@/lib/integrations";
import { createServiceClient } from "@/lib/supabase/service";
import { ChatPanel } from "@/components/chat-panel";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tư vấn bàn phím",
  robots: { index: false, follow: false },
};
export default async function ChatPage() {
  const secret = process.env.SUPABASE_SECRET_KEY,
    hash = chatHash((await cookies()).get("tk-chat")?.value ?? "");
  let history: ChatTurn[] = [],
    error = false;
  if (hash && secret)
    try {
      const r = await createServiceClient().rpc("chat_history", {
        p_hash: hash,
      });
      if (r.error) error = true;
      else history = r.data as unknown as ChatTurn[];
    } catch {
      error = true;
    }
  return (
    <main id="main" className="container page-container buyer-chat-page">
      <div className="tracking-heading">
        <div>
          <h1>Cùng chọn bộ phím phù hợp</h1>
          <p>
            {consultationOpen()
              ? "Đang trong giờ tư vấn của shop."
              : "Hiện ngoài giờ tư vấn. Shop phản hồi Zalo từ 08:00 đến 22:00."}
          </p>
        </div>
        <span className="badge">
          {aiConfigured(process.env)
            ? "Trợ lý AI · Gemini"
            : "AI chưa bật · Có thể nhắn Zalo"}
        </span>
      </div>
      {!aiConfigured(process.env) && (
        <p className="chat-notice">
          AI chưa bật. Câu hỏi vẫn được lưu cho shop; phản hồi hiện tại chỉ hướng dẫn liên hệ Zalo.
        </p>
      )}
      {error && (
        <p role="alert">
          Chưa tải được lịch sử. Thử tải lại trang; không cần gửi lại câu hỏi đã
          gửi.
        </p>
      )}
      <ChatPanel
        initial={history}
        token={secret ? issueRequestToken(secret, undefined, "chat") : ""}
        enabled={!!secret && !error}
      />
    </main>
  );
}
