"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import {
  chatHash,
  newChatToken,
  fallbackReply,
  type ChatTurn,
} from "@/lib/chat-contract";
import { verifyRequestToken } from "@/lib/request-token";
import { geminiReply } from "@/lib/integrations";
import { readPublicCatalog } from "@/lib/catalog-data";
import { scheduleNotifications } from "@/lib/notifications";
export type ChatState = {
  ok?: boolean;
  message?: string;
  history?: ChatTurn[];
};
export async function sendChat(
  _state: ChatState,
  form: FormData,
): Promise<ChatState> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (
    !secret ||
    !verifyRequestToken(
      String(form.get("token") ?? ""),
      secret,
      Date.now(),
      "chat",
    )
  )
    return { message: "Phiên tư vấn hết hạn. Tải lại trang để tiếp tục." };
  const text = String(form.get("message") ?? "").trim(),
    id = String(form.get("messageId") ?? "");
  if (
    !/^[a-f0-9-]{36}$/i.test(id) ||
    text.length < 1 ||
    text.length > 1000 ||
    form.get("consent") !== "on" ||
    form.get("website")
  )
    return {
      message: "Nhập câu hỏi tối đa 1.000 ký tự và đồng ý lưu lịch sử tư vấn.",
    };
  try {
    const jar = await cookies();
    let token = jar.get("tk-chat")?.value ?? "";
    if (!chatHash(token)) {
      token = newChatToken();
      jar.set("tk-chat", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.APP_ORIGIN?.startsWith("https:"),
        path: "/chat",
        maxAge: 30 * 24 * 3600,
      });
    }
    const hash = chatHash(token)!,
      client = createServiceClient();
    const begin = await client.rpc("begin_chat", {
      p_hash: hash,
      p_id: id,
      p_text: text,
    });
    if (begin.error)
      return {
        message: "Chưa lưu được câu hỏi. Nội dung vẫn được giữ để thử lại.",
      };
    const data = begin.data as {
      error?: string;
      done?: boolean;
      lease?: string;
      history?: ChatTurn[];
    };
    if (data.error)
      return {
        message:
          (
            {
              busy: "Một lượt tư vấn đang xử lý. Chờ ít giây rồi thử lại.",
              quota: "Đã hết lượt tư vấn hiện tại. Vui lòng liên hệ Zalo.",
              expired:
                "Lịch sử phiên đã hết hạn truy cập. Bấm Bắt đầu phiên mới.",
              conflict:
                "Lượt này đã gửi nội dung khác. Tải lại trang trước khi gửi câu mới.",
            } as Record<string, string>
          )[data.error] ?? "Chưa gửi được câu hỏi.",
      };
    if (data.done) return { ok: true, history: data.history };
    let reply: { text: string; mode: "ai" | "fallback" } = {
      text: fallbackReply,
      mode: "fallback",
    };
    try {
      const catalog = await readPublicCatalog();
      if (!catalog.demo)
        reply = await geminiReply(
          process.env,
          catalog.catalog,
          data.history ?? [],
        );
    } catch {
      /* Catalog unavailable must not turn demo prices into advice. */
    }
    const finish = await client.rpc("finish_chat", {
      p_hash: hash,
      p_id: id,
      p_lease: data.lease!,
      p_text: reply.text,
      p_mode: reply.mode,
    });
    if (finish.error || !finish.data)
      return {
        message:
          "Chưa xác nhận được phản hồi. Giữ nội dung và bấm gửi lại để kiểm tra cùng lượt.",
      };
    const history = await client.rpc("chat_history", { p_hash: hash });
    if (history.error)
      return { message: "Câu hỏi đã lưu; tải lại trang để xem phản hồi." };
    revalidatePath("/admin/chat");
    return { ok: true, history: history.data as unknown as ChatTurn[] };
  } catch {
    return {
      message: "Kết nối tư vấn bị gián đoạn. Hãy thử lại hoặc liên hệ Zalo.",
    };
  }
}
export async function requestChatHandoff(
  _state: ChatState,
  form: FormData,
): Promise<ChatState> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (
    !secret ||
    !verifyRequestToken(
      String(form.get("token") ?? ""),
      secret,
      Date.now(),
      "chat",
    )
  )
    return { message: "Tải lại trang để gửi yêu cầu hỗ trợ." };
  const hash = chatHash((await cookies()).get("tk-chat")?.value ?? "");
  if (!hash)
    return {
      message: "Hãy gửi câu hỏi trước, hoặc mở Zalo để nhắn trực tiếp.",
    };
  try {
    const r = await createServiceClient().rpc("handoff_chat", { p_hash: hash });
    if (r.error)
      return {
        message: "Chưa ghi nhận được. Bạn vẫn có thể nhắn Zalo trực tiếp.",
      };
    scheduleNotifications();
    revalidatePath("/admin/chat");
    return {
      ok: true,
      message:
        "Đã đánh dấu phiên cần hỗ trợ. Hãy mở Zalo và nhắn cho shop để trao đổi trực tiếp; website chưa kết nối nhân viên theo thời gian thực.",
    };
  } catch {
    return { message: "Chưa gửi được yêu cầu. Hãy mở Zalo để nhắn shop." };
  }
}
export async function resetChat() {
  (await cookies()).delete({ name: "tk-chat", path: "/chat" });
  revalidatePath("/chat");
}
