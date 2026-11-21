# Backup/restore riêng TRUMP Keys trên HP

Đây là quy trình cho **Supabase managed riêng của TRUMP Keys**, PostgreSQL 17. App không ghi upload vào HP: ảnh/video nằm trong Supabase Storage. Vì vậy backup thư mục container web không thay thế backup dữ liệu. Công cụ local PC trong [LOCAL-BACKUP-RESTORE.md](LOCAL-BACKUP-RESTORE.md) giữ nguyên phạm vi và guard cũ.

`scripts/hp-backup.py` dùng Python 3 chuẩn trên Ubuntu và PostgreSQL client trong image Supabase pin version/digest. Không yêu cầu Node/Postgres cài trên HP, không mount Docker socket vào ứng dụng. Script gọi Docker từ shell operator đã có quyền quản trị Docker. Không dùng DB/volume/script backup BankingPrj.

## 1. Chuẩn bị riêng trên HP

**[HP Server], thư mục `/home/congminh/apps/KeyboardPrj`**, sau khi chọn backend Supabase production. Chưa có backend production thì chưa thể nghiệm thu backup thực.

```sh
cd /home/congminh/apps/KeyboardPrj
umask 077
mkdir -p shared/backup /home/congminh/backups/trumpkeys/managed
chmod 700 shared shared/backup /home/congminh/backups/trumpkeys/managed
touch shared/backup/pg_service.conf shared/backup/pgpass shared/backup/storage.json
chmod 600 shared/backup/pg_service.conf shared/backup/pgpass shared/backup/storage.json
nano shared/backup/pg_service.conf
nano shared/backup/pgpass
nano shared/backup/storage.json
```

Nhập giá trị thật **chỉ trong editor trên HP**, không đưa vào chat, command history hoặc Git. Tạo tài khoản DB chuyên backup có quyền SELECT các schema cần thiết và BYPASSRLS để không tạo dump thiếu hàng; xác minh với Supabase quyền role theo gói. Nếu dùng role operator `postgres`, coi pgpass là credential đặc quyền, chỉ operator đọc; không chuyển cho web. Dùng direct connection hoặc session pooler được Supabase cung cấp; không dùng transaction pooler cho snapshot/pg_dump. Chọn host từ Dashboard, không tự suy host nếu project khác region/IPv6.

Mẫu `pg_service.conf` (các placeholder phải được thay tại editor):

```ini
[trumpkeys_backup]
host=REPLACE_WITH_DIRECT_OR_SESSION_POOLER_HOST
port=5432
dbname=postgres
user=REPLACE_WITH_BACKUP_DB_USER
sslmode=verify-full
connect_timeout=10
```

Mẫu `pgpass` là một dòng, field host/port/database/user phải khớp service; escape `:` và `\` trong password theo quy tắc libpq:

```text
REPLACE_HOST:5432:postgres:REPLACE_USER:REPLACE_PASSWORD_LOCALLY
```

Mẫu `storage.json`:

```json
{"url":"https://REPLACE_PROJECT_REF.supabase.co","key":"REPLACE_SERVER_SECRET_LOCALLY"}
```

URL, API key và DB service phải thuộc **cùng project TRUMP Keys**. `sslmode=verify-full` yêu cầu CA được client tin cậy; nếu Supabase cung cấp CA riêng, đặt file trong shared/backup và thêm `sslrootcert=/run/backup/ca.crt`. Không hạ SSL để chữa lỗi. Script cố ý không hỗ trợ URL HTTP/custom-domain Storage hoặc PostgreSQL ngoài major17; cần review/pin client và test lại trước khi dùng môi trường khác.

Lệnh sinh mật khẩu operator mạnh, nếu cần tạo role backup ở Dashboard: `openssl rand -hex 32`. Kết quả chỉ dùng tại máy của bạn. Không sinh lại JWT signing secret của Supabase để điền env web.

## 2. Tạo backup trước release và hằng ngày

**[HP Server], thư mục release đang hoạt động** chứa `.env`, `compose.yaml`, package/lock và scripts:

```sh
cd /home/congminh/apps/KeyboardPrj/releases/REPLACE_RELEASE_TAG
python3 scripts/hp-backup.py backup
```

Kỳ vọng: thư mục mới dưới `/home/congminh/backups/trumpkeys/managed/<UTC>-<UUID>`. Các file private: `database.dump`, `objects.tar.gz`, `config.tar.gz`, `manifest.json`. Không chấp nhận bản còn `INCOMPLETE` hoặc lệnh exit khác0. Không chạy đồng thời worker/fixture/backup khác; chọn lúc không sửa ảnh/upload, không chạy DDL/migration. Dừng thao tác nhập liệu tại shop trong cửa sổ backup; không cần dừng BankingPrj.

DB dump và fingerprint từng bảng public/private/auth/storage/migrations/extensions dùng **cùng MVCC snapshot read-only**. Storage bytes tải qua API private bằng ID/path đã lấy trong snapshot, lưu file UUID, kiểm size+SHA256, so sánh metadata sau tải. Nếu object bị sửa/gỡ trong lúc backup thì fail. Snapshot idle timeout5phút, mỗi lệnh tối đa2phút; dữ liệu lớn cần đo và tăng giới hạn có kiểm soát. Config archive chứa cả `.env` và credential backup; chmod600/umask077 là bắt buộc, chưa mã hóa.

Không tạo role dump và không restore role toàn cluster. Backup không bao gồm signing keys do nhà cung cấp giữ, cấu hình Google provider/Dashboard, DNS/Cloudflare hoặc lịch monitor: ghi chép các mục này trong password manager/runbook riêng. Lưu source release, image tar/tag/digest tương ứng cùng ngày, ngoài manifest này.

Chính sách vận hành ban đầu: backup hằng ngày và trước migration/release; giữ **7 bản ngày + 4 bản tuần + 3 bản tháng**, ít nhất một bản off-host đã mã hóa. Giữ bản trước release đến khi bản mới vượt restore drill. Script **không tự xóa hoặc tự lập lịch**; operator đánh dấu các mốc tuần/tháng, kiểm dung lượng và duyệt bản hết hạn để xóa đúng thư mục dự án. Retention backup khác mục tiêu retention dữ liệu khách; rà soát PII trong bản sao trước khi áp dụng xóa tự động. Không lưu bản duy nhất trên HDD cùng server.

## 3. Checksum và restore thử vào container tạm

**[HP Server], cùng release**, thay đường dẫn bằng **một** thư mục backup vừa tạo:

```sh
python3 scripts/hp-backup.py verify /home/congminh/backups/trumpkeys/managed/REPLACE_BACKUP_DIRECTORY
python3 scripts/hp-backup.py drill /home/congminh/backups/trumpkeys/managed/REPLACE_BACKUP_DIRECTORY
```

`verify` chỉ đọc/checksum. `drill` kiểm checksum trước tạo target, tạo container `trumpkeys-drill-<random32hex>` không mạng/không publish cổng/không bind dữ liệu thật. PGDATA trên tmpfs512MiB, RAM768MiB, CPU0.5; chỉ chạy khi HP đủ headroom, dữ liệu lớn hơn cần điều chỉnh giới hạn ở bản script đã review hoặc diễn tập trên máy riêng. Đích luôn là DB **mới** `trumpkeys_restore_<random32hex>` từ template0; không cho nhập target tùy ý, không restore vào `postgres`.

Khôi phục bằng `pg_restore --single-transaction --exit-on-error`, giữ owners/ACL trong archive, không `--clean`/`--create`/reset. Base image có các role Supabase chuẩn; role tùy biến/extensions ngoài image hoặc managed schema không tương thích sẽ fail, không được bỏ lỗi để báo thành công. Tính lại count/fingerprint mọi bảng, giải nén từng file UUID bằng kiểm loại/path, đối chiếu hash ảnh/video. Chỉ dọn container do lượt này tạo sau khi tên+label+DB marker khớp. Không dùng down/prune/xóa volume. Nếu marker không khớp, script giữ target và fail để operator kiểm tra, không đoán container cần xóa.

Kỳ vọng: `DRILL PASSED`, report JSON có `tableContentsMatch`, `storageBytesMatch`, `temporaryContainerRemoved` đều true. Tệp ảnh/video đã phục hồi nằm trong `drill-files-<UUID>` private. Không giải nén config đè release hoặc source/execute file env từ archive.

Đây là **logical DB + file recovery**, chưa chứng minh toàn bộ Google OAuth/session/Storage API/signed URL chạy trên backend mới. Trước nhận đơn thật cần dựng một backend staging riêng, áp dụng config/provider/ACL, nạp bytes đúng bucket/path qua API, thử đăng nhập và signed URL bằng tài khoản fixture, và nghiệm thu lại tiền/kho. Không chuyển web production sang DB diễn tập; không restore trực tiếp đè production để thử.

## 4. Khi thất bại và giám sát backup

- Exit1/INCOMPLETE: không dùng bản đó; kiểm Docker, quota Storage, DB SSL/session pooler, quyền role và cặp URL/key đúng project ngay trên HP. Script không in chi tiết provider/SQL vì có thể chứa PII. Không bật shell `set -x`, không paste pgpass/config/diagnostic lên chat.
- Restore lỗi extension/role/version: giữ archive gốc, dựng backend riêng tương thích và kiểm lại; không thêm `--clean`, `--no-owner`, `--no-acl` để làm xanh phép thử.
- Theo dõi lần backup cuối exit0 **và** lần drill cuối đạt; cảnh báo nếu quá24giờ chưa có bản mới hoặc quá30ngày chưa drill. Thêm một job riêng vào hệ thống giám sát theo cơ chế của host, không sửa backup BankingPrj và không đọc file Telegram credential.

Kiểm chứng trên PC: `python scripts/verify-hp-backup.py` tạo toàn bộ dữ liệu giả, restore PostgreSQL17 container thật, đối chiếu DB/file và thử archive bị sửa. Không dùng env/cookie/API key thật. Luồng dump managed cần credentials production nên **chưa chạy trên HP hoặc managed project thật**.

Nguồn: [pg_dump snapshot](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html), [Supabase backup không chứa Storage bytes](https://supabase.com/docs/guides/platform/backups).
