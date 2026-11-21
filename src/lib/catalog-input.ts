export const lubePackages = [
  { value: "switch_33", label: "33 switch" },
  { value: "switch_37", label: "37 switch" },
  { value: "switch_60", label: "60 switch" },
  { value: "switch_68", label: "68 switch" },
  { value: "layout_75", label: "Layout 75" },
  { value: "layout_90", label: "Layout 90" },
  { value: "layout_100", label: "Layout 100" },
  { value: "layout_full", label: "Layout full" },
] as const;
export type CatalogInput = {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;
  type: "service" | "product";
  unit: "phím" | "bộ" | "gói";
  price: number | null;
  cost: number;
  active: boolean;
  lubePackage: string;
  imagePath: string;
};
export function integerInput(
  value: string,
  min: number,
  max: number,
  name: string,
) {
  if (!/^-?\d+$/.test(value.trim()))
    throw new Error(`${name} phải là số nguyên.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max)
    throw new Error(`${name} phải từ ${min} đến ${max}.`);
  return number;
}
export function parseCatalogInput(form: FormData): CatalogInput {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const name = get("name"),
    description = get("description"),
    category = get("category"),
    type = get("type"),
    unit = get("unit"),
    lubePackage = get("lubePackage");
  if (!name || name.length > 120 || description.length > 2000)
    throw new Error("Tên cần 1–120 ký tự; mô tả tối đa 2.000 ký tự.");
  if (
    ![
      "lube",
      "stab",
      "keycap",
      "sound_mod",
      "keyboard",
      "switch",
      "accessory",
    ].includes(category) ||
    !["service", "product"].includes(type) ||
    !["phím", "bộ", "gói"].includes(unit)
  )
    throw new Error("Nhóm, loại hoặc đơn vị không hợp lệ.");
  if (
    lubePackage &&
    (!lubePackages.some((p) => p.value === lubePackage) ||
      category !== "lube" ||
      type !== "service" ||
      unit !== "gói")
  )
    throw new Error(
      "Gói lube cần thuộc nhóm Lube, loại dịch vụ và đơn vị gói.",
    );
  const price =
    get("price") === ""
      ? null
      : integerInput(get("price"), 0, 1_000_000_000, "Giá bán");
  const active = form.get("active") === "on";
  if (active && price === null)
    throw new Error("Nhập giá bán trước khi công khai.");
  const id = get("id");
  if (id && !/^[1-9]\d{0,14}$/.test(id))
    throw new Error("Mã sản phẩm không hợp lệ.");
  return {
    id,
    version: id ? integerInput(get("version"), 1, 2147483646, "Phiên bản") : 1,
    name,
    description,
    category,
    type: type as CatalogInput["type"],
    unit: unit as CatalogInput["unit"],
    price,
    cost: integerInput(get("cost") || "0", 0, 1_000_000_000, "Giá vốn"),
    active,
    lubePackage,
    imagePath: "",
  };
}
export type CatalogFormState = { message: string; ok?: boolean; catalogId?: string; media?: import("./catalog-media").CatalogMedia };
