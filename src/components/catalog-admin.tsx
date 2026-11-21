"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  saveCatalogItem,
  adjustStock,
  archiveCatalogItem,
} from "@/app/admin/catalog/actions";
import { lubePackages } from "@/lib/catalog-input";
import type { CatalogFormState } from "@/lib/catalog-input";
import type { AdminCatalogItem } from "@/lib/catalog-data";
import {
  catalogAssetUrl,
  catalogMediaFromRow,
  type CatalogMedia,
} from "@/lib/catalog-media";
import { BannerCrop } from "./banner-crop";
import { CatalogMediaEditor } from "./catalog-media-editor";
import { VndInput } from "./vnd-input";
const initial: CatalogFormState = { message: "" };
const labels = [
  ["keyboard", "Bàn phím"],
  ["switch", "Switch"],
  ["accessory", "Phụ kiện"],
  ["lube", "Lube & switch"],
  ["stab", "Stabilizer"],
  ["keycap", "Keycap & đặt tìm"],
  ["sound_mod", "Tiêu âm & mod"],
];
export function CatalogEditor({
  item,
  imageUrl,
  backendUrl,
}: {
  item?: AdminCatalogItem;
  imageUrl?: string;
  backendUrl: string;
}) {
  const [state, action, pending] = useActionState(saveCatalogItem, initial);
  const [type, setType] = useState(item?.type ?? "product");
  const [category, setCategory] = useState(item?.category_slug ?? "lube");
  const [unit, setUnit] = useState(item?.unit ?? "gói");
  const [syncedMedia, setSyncedMedia] = useState<CatalogMedia>();
  const [removeImageVersion, setRemoveImageVersion] = useState<number | null>(
    null,
  );
  const [cropReset, setCropReset] = useState(0);
  const itemMedia = item ? catalogMediaFromRow(item) : undefined;
  const currentMedia = [itemMedia, state.media, syncedMedia].reduce<
    CatalogMedia | undefined
  >(
    (latest, candidate) =>
      candidate && (!latest || candidate.version >= latest.version)
        ? candidate
        : latest,
    undefined,
  );
  const currentVersion = currentMedia?.version ?? item?.version ?? 1;
  const currentImageUrl = currentMedia
    ? currentMedia.images[0]
      ? catalogAssetUrl(backendUrl, "catalog-images", currentMedia.images[0])
      : undefined
    : imageUrl;
  const removeImageChecked = removeImageVersion === currentVersion;
  const [draft, setDraft] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    price:
      item?.price_vnd === null || item?.price_vnd === undefined
        ? ""
        : String(item.price_vnd),
    cost: String(item?.cost_vnd ?? 0),
    active: item?.active ?? false,
    lubePackage: item?.lube_package ?? "",
  });
  return (
    <>
    <form
      action={action}
      className="catalog-editor"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="version" value={currentVersion} />
      <label className="span-two">
        Tên dịch vụ / sản phẩm
        <input
          name="name"
          required
          maxLength={120}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        Nhóm
        <select
          name="category"
          aria-label="Nhóm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {labels.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Loại
        <select
          name={item ? undefined : "type"}
          aria-label="Loại"
          value={type}
          disabled={!!item}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="service">Dịch vụ (không quản lý tồn)</option>
          <option value="product">Linh kiện / sản phẩm</option>
        </select>
        {item && <input type="hidden" name="type" value={type} />}
        <small>
          {type === "service"
            ? "Dịch vụ không quản lý tồn. Bàn phím, switch, keycap bán sẵn cần chọn Sản phẩm/linh kiện khi tạo mới."
            : "Sản phẩm có tồn kho. Sau khi tạo, nhập số lượng hàng thực có."}
        </small>
      </label>
      <label>
        Đơn vị
        <select
          name="unit"
          aria-label="Đơn vị"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          <option value="gói">Gói</option>
          <option value="bộ">Bộ</option>
          <option value="phím">Phím / switch</option>
        </select>
      </label>
      <label>
        Phân loại lube
        <select
          name="lubePackage"
          aria-label="Phân loại lube"
          value={draft.lubePackage}
          onChange={(e) => setDraft({ ...draft, lubePackage: e.target.value })}
          disabled={category !== "lube" || type !== "service" || unit !== "gói"}
        >
          <option value="">Không áp dụng</option>
          {lubePackages.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Giá bán (VND)
        <VndInput
          name="price"
          aria-label="Giá bán (VND)"
          min={0}
          max={1000000000}
          value={draft.price}
          onValueChange={(price) => setDraft({ ...draft, price })}
        />
        <small>Để trống khi chưa có giá, mục chỉ lưu nháp.</small>
      </label>
      <label>
        Giá vốn linh kiện (VND)
        <VndInput
          name="cost"
          aria-label="Giá vốn linh kiện (VND)"
          min={0}
          max={1000000000}
          value={draft.cost}
          onValueChange={(cost) => setDraft({ ...draft, cost })}
        />
        <small>Chỉ admin xem. Chưa tính lợi nhuận.</small>
      </label>
      <label className="span-two">
        Mô tả
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <div className="span-two">
        <BannerCrop
          key={`${state.catalogId ?? item?.id ?? "new"}-${currentVersion}-${cropReset}`}
          existing={currentImageUrl}
          aspect={1}
          label="Ảnh công khai của sản phẩm"
          subject="ảnh sản phẩm"
          hint="Đây là ảnh bìa; chọn ảnh rồi kéo để căn vùng hiển thị (khung vuông 1:1, JPEG/PNG/WebP tĩnh, tối đa 5 MB và 20 MP). Thêm các góc chụp và video tại phần Ảnh & sound test sau khi lưu mục mới."
          saveHint="Ảnh chỉ được cắt khi bấm lưu sản phẩm. Có thể dùng các thanh chỉnh bằng bàn phím."
          onSelectChange={(hasSelection) => {
            if (hasSelection) setRemoveImageVersion(null);
          }}
        />
        {currentImageUrl && (
          <div className="catalog-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImageUrl} alt={item?.name ?? "Ảnh hiện tại"} />
            {item && (
              <label className="check-label">
                <input
                  type="checkbox"
                  name="removeImage"
                  checked={removeImageChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setRemoveImageVersion(currentVersion);
                      setCropReset((count) => count + 1);
                    } else {
                      setRemoveImageVersion(null);
                    }
                  }}
                />
                Gỡ ảnh hiện tại
              </label>
            )}
          </div>
        )}
      </div>
      <label className="check-label span-two">
        <input
          type="checkbox"
          name="active"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
        Công khai trên bảng giá (cần nhập giá bán)
      </label>
      {type === "product" && (
        <p className="span-two">
          Tồn kho được cập nhật bằng phiếu nhập/điều chỉnh riêng sau khi tạo.
          Không sửa trực tiếp tại đây.
        </p>
      )}
      <p className="span-two">
        Giá bao gồm công và vật liệu, chưa gồm phí vận chuyển.
      </p>
      <div className="form-actions span-two">
        <button
          className="button button-primary"
          disabled={pending || (state.ok && !item)}
        >
          {pending ? "Đang lưu…" : item ? "Lưu thay đổi" : "Tạo mục mới"}
        </button>
        <Link className="button button-outline" href="/admin/catalog">
          Về danh sách
        </Link>
      </div>
      <p className="auth-feedback span-two" role="status">
        {state.message}
      </p>
    </form>
    {currentMedia ? <CatalogMediaEditor initial={currentMedia} backendUrl={backendUrl} onMediaChange={setSyncedMedia} /> : <p className="catalog-media-start">Lưu mục mới để bắt đầu thêm thư viện ảnh và video sound test.</p>}
    {state.catalogId && !item && <Link className="button button-outline" href={`/admin/catalog/${state.catalogId}`}>Chỉnh sửa thông tin sản phẩm vừa tạo</Link>}
    </>
  );
}
export function StockForm({
  id,
  requestId,
}: {
  id: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(adjustStock, initial);
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");
  return (
    <form
      action={action}
      className="stock-form"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="requestId" value={requestId} />
      <label>
        Số lượng tăng / giảm
        <div className="stock-controls">
          <button
            type="button"
            aria-label="Chọn giảm 1"
            onClick={() => setDelta("-1")}
          >
            −1
          </button>
          <input
            name="delta"
            aria-label="Số điều chỉnh tồn"
            type="number"
            min={-1000000}
            max={1000000}
            step={1}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            required
          />
          <button
            type="button"
            aria-label="Chọn tăng 1"
            onClick={() => setDelta("1")}
          >
            +1
          </button>
        </div>
      </label>
      <label>
        Lý do
        <input
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
          maxLength={300}
          placeholder="Ví dụ: Nhập từ nhà cung cấp"
        />
      </label>
      <button className="button button-outline" disabled={pending || state.ok}>
        {pending ? "Đang ghi…" : "Ghi điều chỉnh"}
      </button>
      <p role="status">
        {state.message}
        {state.ok && " Tải lại trang để tạo phiếu tiếp theo."}
      </p>
    </form>
  );
}
export function ArchiveForm({ item }: { item: AdminCatalogItem }) {
  const [state, action, pending] = useActionState(archiveCatalogItem, initial);
  return (
    <details className="archive-section">
      <summary>Lưu trữ mục này</summary>
      <p>
        Mục sẽ bị gỡ khỏi bảng giá và danh sách đang quản lý; lịch sử tồn và
        tham chiếu đơn được giữ. Thao tác này khác với bỏ tick Công khai để tạm
        ẩn.
      </p>
      <form action={action}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="version" value={item.version} />
        <button
          className="button button-outline"
          disabled={pending || state.ok}
        >
          {pending ? "Đang lưu…" : "Xác nhận đưa vào lưu trữ"}
        </button>
        <p role="status">{state.message}</p>
      </form>
    </details>
  );
}
