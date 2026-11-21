import { redirect } from "next/navigation";
import { requireGoogleUser } from "@/lib/auth";
import { JoinAdminForm } from "@/components/admin-access";
import { logout } from "../actions";
export default async function JoinPage() {
  const { client, user } = await requireGoogleUser();
  const { data, error } = await client.rpc("is_admin");
  if (error)
    throw new Error(
      "Chưa xác minh được quyền. Hãy kiểm tra migration và kết nối dữ liệu.",
    );
  if (data === true) redirect("/admin");
  return (
    <main id="main" className="container page-container auth-page">
      <span className="eyebrow">TRUMP Keys · Cấp quyền</span>
      <h1>Tài khoản chưa có quyền admin.</h1>
      <p className="page-lead">
        Bạn đang đăng nhập bằng {user.email}. Hãy nhập mã mời được một admin gửi
        riêng cho bạn.
      </p>
      <section className="info-panel">
        <JoinAdminForm />
        <p>
          Admin đầu tiên cần được người vận hành cấp quyền theo quy trình
          bootstrap. Đăng nhập đúng email cũng không tự tạo quyền.
        </p>
      </section>
      <form action={logout}>
        <button className="button button-outline">
          Đăng xuất để đổi tài khoản
        </button>
      </form>
    </main>
  );
}
