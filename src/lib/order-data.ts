import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readAuthConfig } from "./auth-config";
import type { Database } from "./database.types";
import type { PublicOrder } from "./domain";
import { orderStages } from "./order-contract";
import { renderBankPayment } from "./bank-payment";

export async function readTrackedOrder(
  code: string,
): Promise<PublicOrder | null> {
  // Public tracking is limited in proxy before rendering or DB access.
  const config = readAuthConfig(process.env);
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret) throw new Error("Chưa cấu hình dịch vụ tra cứu đơn.");
  const client = createClient<Database>(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("track_order", { p_code: code });
  if (error) throw new Error("Chưa tải được tiến độ. Hãy thử lại sau.");
  if (!data) return null;
  const raw = data as unknown as {
    code: string;
    keyboard: string;
    customerDisplayName: string;
    customerPhoneMasked: string;
    stage: number;
    cancelled: boolean;
    updatedAt: string;
    paymentLabel: string;
    payment: {
      available?: boolean;
      plan: "deposit_cod" | "transfer_full";
      total: number;
      deposit: number;
      received: number;
      reference: string;
    };
    services: string[];
    events: {
      kind: string;
      stage: number;
      note: string;
      path: string | null;
      videoUrl: string | null;
      createdAt: string;
    }[];
  };
  const media = await Promise.all(
    raw.events
      .filter((e) => e.kind === "proof")
      .map(async (e) => {
        let url: string | undefined;
        if (e.path) {
          const signed = await client.storage
            .from("order-media")
            .createSignedUrl(e.path, 300);
          if (signed.error)
            throw new Error("Chưa tải được ảnh tiến độ. Hãy thử lại sau.");
          url = signed.data.signedUrl;
        }
        return {
          stage: e.stage,
          note: e.note,
          createdAt: e.createdAt,
          url,
          video: e.path?.endsWith(".mp4") ?? false,
          videoUrl: e.videoUrl ?? undefined,
        };
      }),
  );
  return {
    code: raw.code,
    keyboard: raw.keyboard,
    customerDisplayName: raw.customerDisplayName,
    customerPhoneMasked: raw.customerPhoneMasked,
    services: raw.services,
    paymentLabel: raw.paymentLabel,
    bankPayment: await renderBankPayment({
      ...raw.payment,
      cancelled: raw.cancelled,
    }),
    updatedAt: raw.updatedAt,
    cancelled: raw.cancelled,
    media,
    steps: orderStages.map((name, stage) => {
      const event = raw.events.find(
        (e) =>
          e.stage === stage && (e.kind === "created" || e.kind === "stage"),
      );
      return {
        name,
        description:
          stage === 0
            ? "Shop tiếp nhận và chờ xác nhận thanh toán."
            : stage === 1
              ? "Shop đang thực hiện các hạng mục đã chốt."
              : "Đã hoàn tất các hạng mục của đơn.",
        status:
          stage < raw.stage || (raw.stage === 2 && stage === 2)
            ? "complete"
            : stage === raw.stage
              ? "current"
              : "pending",
        updatedAt: event?.createdAt,
        note: event?.note,
      };
    }),
  };
}
