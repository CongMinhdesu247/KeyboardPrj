# Sao lưu và khôi phục thử TRUMP Keys trên PC

Đã triển khai lệnh sao lưu local và diễn tập vào database riêng. Đây là bước tiếp theo sau M7-PC; không triển khai HP, không reset/khôi phục đè database đang dùng và không đặt lịch xóa/backup tự động.

## Cách chạy

Supabase local `trumpkeys-local` và Docker Engine phải đang chạy. Lệnh chỉ chấp nhận API127.0.0.1:54321, DB127.0.0.1:54322 và container `supabase_db_trumpkeys-local`. Không nhận URL database đích tùy ý hoặc dùng cấu hình HP/managed DB.

```powershell
# Tạo bản sao lưu mới, không xóa bản trước.
npm run backup:local

# Tạo backup mới rồi tự khôi phục/đối chiếu ở database tạm riêng.
npm run backup:drill

# Kiểm tra lại một backup v2 đã tạo. Thay đường dẫn bằng thư mục thật được lệnh trên trả về.
npm run backup:verify -- --backup "C:\Users\Dung\KeyboardPrj\output\backups\trumpkeys-local\REPLACE_WITH_BACKUP_DIRECTORY"
```

Chọn thời điểm shop không nhập/sửa đơn/ảnh hoặc sửa mã nguồn. Không chạy cùng bộ fixture M1–M7 hay worker. Backup DB là snapshot MVCC nhất quán, không khóa ghi nghiệp vụ; khi Storage hoặc source thay đổi trong lúc sao lưu, công cụ dừng thay vì báo thành công giả. Snapshot chỉ đọc có hạn5phút; lệnh archive có timeout2phút. Với dữ liệu lớn hơn cần điều chỉnh/đo thời gian riêng.

## Bộ backup chứa gì

Thư mục mới dưới `output/backups/trumpkeys-local/<UTC-time>-<UUID>/` được gitignore. Windows dùng ACL chỉ owner hiện tại và SYSTEM; Linux/macOS dùng umask077/thư mục700. **Bản này chưa mã hóa** và chứa dữ liệu nhạy cảm: tài khoản/Auth, đơn, thanh toán, chat, ảnh và cấu hình có API key. Không đưa lên web, commit hoặc gửi nguyên bộ qua chat.

| Tệp | Nội dung |
| --- | --- |
| `database.dump` | Full logical PostgreSQL custom archive, có schema/data/owners/ACL/RLS/functions/triggers/indexes/sequences. Không sao chép subscription kết nối ngoài. |
| `objects/<object-UUID>.bin` | Byte gốc của toàn bộ object trong Storage, gồm bucket private; manifest giữ liên hệ bucket/path/metadata. Không dùng tên khách làm đường dẫn filesystem. |
| `source.tar.gz` | Mã nguồn, public assets, migrations, tests, docs và cấu hình build theo whitelist; không `.git`, node_modules, output hoặc env secret. Source hiện chưa có release Git nên lưu snapshot này để không phụ thuộc PC còn mã. |
| `config/*.bin` | Bản sao cấu hình riêng: `.env.local`, bootstrap env nếu có, `supabase/.env`, config.toml và package/lock. Mapping nằm ở `configurations` trong manifest. Chỉ khôi phục chủ động sau khi kiểm môi trường; không execute/source file nhận từ nơi khác. |
| `local-stack.json` | Cấu hình do CLI local trả về, có credential. Không in nội dung. |
| `roles-no-passwords.sql` | Định nghĩa role không có role password, để operator rà soát khi dựng môi trường mới; **không tự áp dụng** vào cluster đang dùng. |
| `manifest.json` | Format `trumpkeys-local-backup-v2`, version Postgres/image/migrations, checksum/size của file, inventory và fingerprint DB tại snapshot. |
| `restore-report.json` | Bằng chứng đối chiếu của lượt diễn tập thành công, bao gồm cờ đã dọn database tạm. |

Mỗi file backup được SHA256; từng bảng thuộc public/private/auth/storage/supabase_migrations được đếm dòng và fingerprint nội dung theo thứ tự độc lập. Đối chiếu thêm cấu trúc, quyền hiệu dụng, RLS, function, trigger, constraint/index và sequence. Quyền mặc định được diễn giải theo đúng loại object, không coi thứ tự ACL hoặc biểu diễn NULL/default là mất quyền.

Backup lỗi có `INCOMPLETE.txt` hoặc không có manifest hoàn chỉnh; công cụ từ chối restore. Backup đã tạo nhưng verify chưa đạt không được coi đã nghiệm thu; chỉ dùng bộ có `restore-report.json` thành công và `scratchDatabaseRemoved=true`. Các bản thử nghiệm formatv1 trước khi hoàn thiện công cụ không dùng cho luồng verifyv2. Không tự xóa các bản cũ khi chưa có chính sách lưu backup.

## Diễn tập thực hiện gì

1. Kiểm toàn bộ checksum/path/type; từ chối traversal, symlink và source tar có entry ngoài manifest hoặc không phải file thường. Kiểm checksum diễn ra trước khi tạo target.
2. Tạo database mới `trumpkeys_restore_<random32hex>` từ template0, gắn marker theo backup. Không chấp nhận `postgres`, template hoặc tên đích do người dùng tự đặt.
3. `pg_restore --single-transaction --exit-on-error` vào database mới. Giữ owner/ACL để đối chiếu; không `--clean`, không sửa global roles, không đổi app/API sang database này.
4. Đối chiếu bảng/quyền/cấu trúc/sequence với manifest. Khôi phục tệp Storage ra `drill-files/` và mã nguồn ra `drill-source/` trong thư mục backup bảo vệ, đọc lại/hash toàn bộ.
5. Chỉ trong DB tạm: tạo identity/session admin giả, thử admin được phép, guest/anon bị chặn và báo cáo tiền khớp ledger. Không dùng cookie Google thật, không tạo receipt/đơn hoặc gửi Gemini/Telegram ở hệ thống đang dùng.
6. Kiểm marker và dọn **đúng database tạm vừa tạo**, không force-kill kết nối khác. Giữ backup, report và bản tệp đã phục hồi để review. `scratchDatabaseRemoved` chỉ true sau khi dọn thành công.

Nếu có lỗi, chi tiết có thể nằm trong `diagnostic-private.log`/`structure-difference-private.json`, cùng quyền bảo vệ; không đăng công khai vì có thể chứa schema/SQL. Console chỉ hiện stage và thống kê không chứa payload/secret. Nếu process bị kill cưỡng bức, DB tạm có thể còn; operator phải kiểm đúng tên/marker trước khi dọn, không drop theo wildcard. Công cụ không có lệnh restore đè nguồn.

## Kết quả đã kiểm chứng

- Khôi phục và fingerprint **63 bảng**, tài khoản/quyền, schema nghiệp vụ và sequence khớp.
- **2 tệp Storage** được tải, khôi phục ra thư mục riêng và đọc lại đúng SHA256.
- Mã nguồn được đóng gói, giải nén ra thư mục riêng và từng file khớp manifest; số file cụ thể trong report từng lượt.
- Admin fixture trên bản sao được truy cập; guest/anon bị chặn. Báo cáo tiền trên bản phục hồi đối chiếu đúng sổ thu–hoàn.
- Kiểm tra backup cố tình đổi1byte bị chặn tại checksum **trước khi tạo database phục hồi**; bản gốc không bị sửa.
- Đã đối chiếu bảng public/private/migrations ở hệ thống đang dùng sau thử nghiệm: không thay đổi. DB tạm đã dọn; không dùng cookie thật hoặc gọi Gemini/Telegram.

## Giới hạn trước phát hành

Đây là kiểm chứng **logical DB và file** trên cùng stack Postgres/roles/extensions local. Chưa chứng minh phục hồi đầy đủ một stack Supabase mới, Google OAuth/provider, Storage API/signed URL với keys mới hoặc VPS/HP khác. `local-stack.json`/role file giúp operator rà soát, không được tự áp dụng sang môi trường khác. Cần thử lại toàn stack khi chọn backend production.

Backup còn ở **cùng PC**, chưa đủ bảo vệ khi mất/hỏng ổ đĩa. Bước tiếp theo là chọn nơi sao lưu ngoài PC và mã hóa/kiểm quyền, xác định lịch và retention, sau đó thử khôi phục từ bản sao ngoài máy. Chưa tự tạo dịch vụ trả phí, upload dữ liệu, cron hay xóa backup. Thời hạn90/180ngày/24tháng của nội dung không tự áp dụng thành lịch xóa backup.

Nguồn đối chiếu: [Postgres pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html), [Supabase backups — Storage bytes cần backup riêng](https://supabase.com/docs/guides/platform/backups).
