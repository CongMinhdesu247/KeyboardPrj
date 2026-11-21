# Kiểm tra chỉ đọc trên HP trước triển khai

Chạy nguyên khối này trong **[HP Server] phiên SSH/Tailscale do bạn mở**, tại thư mục home bất kỳ. Không cần gửi secret hoặc toàn bộ log lên chat. Các lệnh không thay UFW, SSH, Docker hay route Cloudflare; `sudo` có thể hỏi mật khẩu ngay tại terminal của bạn.

```sh
date -Is
uname -m
cat /etc/os-release
timedatectl show -p Timezone
free -h
swapon --show
vmstat 1 5
df -h / /home/congminh/apps /var/lib/docker
df -i / /home/congminh/apps /var/lib/docker
sudo ss -lntup
sudo docker version --format '{{.Server.Version}}'
sudo docker compose version
sudo docker compose ls
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
sudo docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
sudo docker system df
sudo ufw status verbose
```

Đọc kết quả:

| Kiểm tra | Điều kiện để đi tiếp | Nếu khác |
| --- | --- | --- |
| Kiến trúc | `x86_64`, tương ứng `linux/amd64` | Dừng, không dùng image amd64 cho host khác |
| RAM | Xem `available`, swap và `si/so` trong vmstat | Không coi swap là RAM cho build; build trên PC nếu áp lực RAM/I/O |
| Disk/inode | Đủ cho image mới + image rollback + backup + ít nhất 20% dung lượng dự phòng | Chọn nơi lưu/giảm retention bằng thao tác có review; không prune |
| Cổng | Không có listener 8094 và 2094 (kể cả IPv6 hoặc bind `0.0.0.0`) | Chọn cổng khác ngoài 8090–8093 rồi cập nhật env/tunnel/monitor cùng nhau |
| Docker | Engine và `docker compose` plugin chạy được | Xử lý quyền/service bằng hướng dẫn host hiện có, không khởi động lại toàn Docker tùy tiện |
| App cũ | Ghi lại trạng thái `banking-local` và các app khác | Không sửa/dừng dịch vụ đang giữ cổng |

Không dùng `docker inspect` toàn bộ, `docker compose config` không có `--quiet`, hoặc `systemctl cat` tunnel để chia sẻ kết quả: các đầu ra có thể chứa token. Không đọc `/etc/hp-server-monitor/telegram.json`. Không cần kiểm tra hay mở private key SSH.

8094 là đề xuất hiện hành của dự án, **chưa được xác nhận trống trên HP**. 8091/8092 trong prompt là ví dụ, không được chọn khi tài liệu đã dành 8090–8093 cho ứng dụng khác. Giới hạn Compose mới là 512 MiB web + 128 MiB tunnel; chưa đo RSS/CPU thực tế trên HP.
