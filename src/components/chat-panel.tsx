"use client";
import { useActionState, useState, useRef, useEffect } from "react";
import {
  sendChat,
  requestChatHandoff,
  resetChat,
  type ChatState,
} from "@/app/chat/actions";
import type { ChatTurn } from "@/lib/chat-contract";
import { shop } from "@/lib/brand";
import Link from "next/link";
export function ChatPanel({
  initial,
  token,
  enabled,
}: {
  initial: ChatTurn[];
  token: string;
  enabled: boolean;
}) {
  const [text, setText] = useState(""),
    [messageId, setMessageId] = useState("");
  const [state, action, pending] = useActionState<ChatState, FormData>(
    async (previous, form) => {
      const requestId = messageId || crypto.randomUUID();
      setMessageId(requestId);
      form.set("messageId", requestId);
      let result: ChatState;
      try {
        result = await sendChat(previous, form);
      } catch {
        return {
          history: previous.history,
          message: "Mất kết nối. Câu hỏi được giữ để bạn thử lại.",
        };
      }
      if (result.ok) {
        setText("");
        setMessageId("");
      }
      return { ...result, history: result.history ?? previous.history };
    },
    {},
  );
  const [handoff, handoffAction, handoffPending] = useActionState(
    requestChatHandoff,
    {},
  );
  const history = state.history ?? initial;
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [history, pending]);
  return (
    <div className="chat-layout">
      <section className="chat-conversation" aria-label="Cuộc tư vấn">
        <div
          ref={log}
          className="chat-history"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {!history.length && (
            <div className="chat-welcome">
              <h2>Bạn cần tư vấn gì?</h2>
              <p>
                Hỏi về switch, lube, cấu hình hoặc cách đặt hàng.
              </p>
              <div className="chat-suggestions">
                {[
                  "Shop nhận những dịch vụ nào?",
                  "Cọc và thanh toán như thế nào?",
                  "Tôi muốn tìm một mẫu keycap",
                ].map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => {
                      setText(q);
                      setMessageId("");
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {history.map((turn) => (
            <article className="chat-turn" key={turn.id}>
              <div className="chat-bubble chat-customer">
                <strong>Bạn</strong>
                <p>{turn.customer}</p>
              </div>
              <div className="chat-bubble chat-assistant">
                <strong>
                  {turn.mode === "ai"
                    ? "Trợ lý AI · Gemini"
                    : "TRUMP Keys · Hướng dẫn"}
                </strong>
                <p>
                  {turn.assistant ??
                    "Phản hồi đang xử lý. Tải lại sau ít giây; nếu gián đoạn, gửi lại cùng câu hỏi."}
                </p>
              </div>
            </article>
          ))}
          {pending && (
            <p role="status" className="admin-muted">
              Đang lưu câu hỏi và chuẩn bị phản hồi…
            </p>
          )}
        </div>
        <form action={action} className="chat-composer">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="messageId" value={messageId} />
          <label className="form-honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label htmlFor="chat-message">
            <strong>Câu hỏi của bạn</strong>
          </label>
          <textarea
            id="chat-message"
            name="message"
            maxLength={1000}
            required
            rows={3}
            value={text}
            disabled={pending}
            onChange={(e) => {
              setText(e.target.value);
              setMessageId("");
            }}
            placeholder="Ví dụ: Tôi muốn switch nhẹ, âm trầm cho bàn phím 68 phím…"
          />
          <label className="chat-consent">
            <input type="checkbox" name="consent" required disabled={pending} />{" "}
            Tôi từ 18 tuổi, đồng ý lưu chat để shop hỗ trợ và gửi nội dung tư
            vấn tới Google Gemini khi AI được bật. Không nhập địa chỉ, SĐT, mã
            đơn hay thông tin thanh toán.
          </label>
          <div className="chat-compose-footer">
            <Link href="/privacy" target="_blank" rel="noreferrer">Thông tin dữ liệu</Link>
            <small>{text.length}/1.000 ký tự</small>
            <button
              className="button button-primary"
              disabled={!enabled || pending}
            >
              {pending ? "Đang gửi…" : "Gửi câu hỏi"}
            </button>
          </div>
          {state.message && (
            <p className="form-message" role="status">
              {state.message}
            </p>
          )}
        </form>
      </section>
      <aside className="chat-help admin-panel">
        <h2>Trao đổi trực tiếp với shop</h2>
        <p>
          Chốt cấu hình, xác nhận hàng hoặc cần kiểm tra đơn? Nhắn Zalo để shop
          hỗ trợ chính xác.
        </p>
        <a
          className="button button-outline"
          href={shop.zalo}
          target="_blank"
          rel="noreferrer"
        >
          Mở Zalo ↗
        </a>
        <p className="admin-muted">
          Giờ tư vấn 08:00–22:00 (Việt Nam). Ngoài giờ, shop phản hồi khi mở
          cửa.
        </p>
        <form action={handoffAction}>
          <input type="hidden" name="token" value={token} />
          <button
            className="button button-outline"
            disabled={!enabled || handoffPending || !history.length}
          >
            Đánh dấu cần shop hỗ trợ
          </button>
        </form>
        {handoff.message && <p role="status">{handoff.message}</p>}
        <hr />
        <p className="admin-muted">
          Lịch sử gắn với trình duyệt này trong 30 ngày. Bắt đầu phiên mới sẽ bỏ
          quyền mở phiên cũ trên trình duyệt; dữ liệu cũ chưa bị xóa.
        </p>
        <form action={resetChat}>
          <button className="button button-outline" disabled={pending}>
            Bắt đầu phiên mới
          </button>
        </form>
      </aside>
    </div>
  );
}
