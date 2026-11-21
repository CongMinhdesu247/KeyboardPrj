export type CategorySlug =
  | "lube"
  | "stab"
  | "keycap"
  | "sound_mod"
  | "keyboard"
  | "switch"
  | "accessory";
export type CatalogItem = {
  id: string;
  category: CategorySlug;
  name: string;
  description: string;
  type: "service" | "product";
  unit: "phím" | "bộ" | "gói";
  price: number;
  stock: number | null;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  soundTestUrl?: string;
  lubePackage?: string;
};
export type EstimateLine = { itemId: string; quantity: number };
export type PublicOrder = {
  bankPayment?: import("./bank-transfer").BankPayment;
  cancelled?: boolean;
  media?: {
    stage: number;
    note: string;
    createdAt: string;
    url?: string;
    video: boolean;
    videoUrl?: string;
  }[];
  code: string;
  customerDisplayName: string;
  customerPhoneMasked: string;
  keyboard: string;
  services: string[];
  paymentLabel: string;
  updatedAt: string;
  steps: {
    name: string;
    description: string;
    status: "complete" | "current" | "pending";
    updatedAt?: string;
    note?: string;
  }[];
};
