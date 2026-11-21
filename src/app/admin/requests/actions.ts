"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { requestStatuses, type M4State } from "@/lib/m4-contract";
import { integerInput } from "@/lib/catalog-input";
export async function updateFindRequest(
  _state: M4State,
  form: FormData,
): Promise<M4State> {
  const { client } = await requireAdmin();
  const id = String(form.get("id") ?? ""),
    status = String(form.get("status") ?? ""),
    note = String(form.get("internalNote") ?? "").trim();
  let version: number;
  try {
    version = integerInput(
      String(form.get("version")),
      1,
      2147483647,
      "Phiên bản",
    );
  } catch {
    return { message: "Hãy tải lại trang để lấy dữ liệu mới." };
  }
  if (
    !/^[a-f0-9-]{36}$/i.test(id) ||
    !Object.hasOwn(requestStatuses, status) ||
    note.length > 2000
  )
    return { message: "Trạng thái hoặc ghi chú không hợp lệ." };
  const result = await client.rpc("update_custom_request", {
    p_id: id,
    p_version: version,
    p_status: status,
    p_note: note,
  });
  if (result.error) return { message: "Chưa lưu được thay đổi. Hãy thử lại." };
  if (!(result.data as { ok?: boolean })?.ok)
    return {
      message: "Yêu cầu đã thay đổi. Hãy tải lại trang trước khi sửa tiếp.",
    };
  revalidatePath("/admin/requests");
  return { ok: true, message: "Đã cập nhật yêu cầu." };
}
