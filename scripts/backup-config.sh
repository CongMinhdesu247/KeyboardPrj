#!/bin/sh
set -eu
umask 077

# Chạy từ thư mục release trên HP; tuyệt đối không source .env.
test -f .env && test -f compose.yaml
backup_root=/home/congminh/backups/trumpkeys/config
mkdir -p "$backup_root"
chmod 700 "$backup_root"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
workdir=$(mktemp -d "$backup_root/config-$stamp-XXXXXX")
docker compose --env-file .env -p trumpkeys-hp -f compose.yaml config --images > "$workdir/images.txt"
container_id=$(docker compose --env-file .env -p trumpkeys-hp -f compose.yaml ps -q web)
if [ -n "$container_id" ]; then
  docker inspect --format '{{.Config.Image}} {{.Image}}' "$container_id" > "$workdir/running-image.txt"
fi
# Dereference .env symlink để backup không phụ thuộc đường dẫn shared hiện tại.
tar -czhf "$workdir/config.tar.gz" .env compose.yaml Dockerfile package.json package-lock.json
chmod 600 "$workdir/config.tar.gz" "$workdir/images.txt"
if [ "$(id -u)" -eq 0 ]; then
  # Người quản trị có thể tải backup qua SSH mà không mở quyền đọc cho người khác.
  chown congminh:congminh "$backup_root" "$workdir" "$workdir/config.tar.gz" "$workdir/images.txt"
  if [ -f "$workdir/running-image.txt" ]; then
    chown congminh:congminh "$workdir/running-image.txt"
  fi
fi
printf 'Config backup completed: %s\n' "$workdir"
