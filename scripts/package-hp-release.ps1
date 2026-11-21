$ErrorActionPreference = "Stop"

$dirty = git status --porcelain
if ($dirty) {
  Write-Error "Co thay doi chua commit. Hay commit truoc khi dong goi release de git archive bao gom code moi nhat."
}

$releaseTag = (git rev-parse --short=12 HEAD).Trim()
if (-not $releaseTag) {
  Write-Error "Khong doc duoc git HEAD."
}

New-Item -ItemType Directory -Force output/deploy | Out-Null
$sourceArchive = "output/deploy/trumpkeys-$releaseTag.tar.gz"
$imageArchive = "output/deploy/trumpkeys-image-$releaseTag.tar"
$imageTag = "trumpkeys-web:$releaseTag"

Write-Host "Dong goi ma nguon: $sourceArchive"
git archive --format=tar.gz -o $sourceArchive HEAD

Write-Host "Build Docker image linux/amd64: $imageTag"
docker buildx build --platform linux/amd64 --load -t $imageTag .
docker image inspect $imageTag --format '{{.Os}}/{{.Architecture}} {{.Id}}'

Write-Host "Xuat Docker image: $imageArchive"
docker save -o $imageArchive $imageTag

$sourceHash = (Get-FileHash $sourceArchive -Algorithm SHA256).Hash.ToLowerInvariant()
$imageHash = (Get-FileHash $imageArchive -Algorithm SHA256).Hash.ToLowerInvariant()

Write-Host ""
Write-Host "=== HOAN TAT DONG GOI RELEASE $releaseTag ==="
Write-Host "Source SHA256: $sourceHash"
Write-Host "Image  SHA256: $imageHash"
Write-Host ""
Write-Host "--- Lenh copy sang HP (chay tren PC) ---"
Write-Host "scp `"$sourceArchive`" `"$imageArchive`" homeserver:/home/congminh/apps/KeyboardPrj/incoming/"
Write-Host ""
Write-Host "--- Lenh cap nhat tren HP Server ---"
Write-Host "cd /home/congminh/apps/KeyboardPrj && release_tag=$releaseTag"
Write-Host "sha256sum `"incoming/trumpkeys-$releaseTag.tar.gz`" `"incoming/trumpkeys-image-$releaseTag.tar`""
Write-Host "mkdir -p `"releases/$releaseTag`" && tar -xzf `"incoming/trumpkeys-$releaseTag.tar.gz`" -C `"releases/$releaseTag`" && sudo docker load -i `"incoming/trumpkeys-image-$releaseTag.tar`""
Write-Host "cd `"releases/$releaseTag`" && ln -s ../../shared/.env .env && sudo env IMAGE_TAG=`"$releaseTag`" docker compose --env-file .env -p trumpkeys-hp -f compose.yaml up -d --no-build --pull never web"
Write-Host "curl --fail --max-time 5 http://127.0.0.1:8094/healthz"
