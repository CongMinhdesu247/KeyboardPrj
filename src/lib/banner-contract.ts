export type Banner={slot:number;title:string;subtitle:string;image_path:string|null;product_id:number|null;active:boolean;version:number};
export type PublicBanner={slot:number;title:string;subtitle:string;imageUrl:string;productId:string};
export type BannerState={ok?:boolean;message?:string;version?:number;banner?:Banner;cleared?:boolean};
