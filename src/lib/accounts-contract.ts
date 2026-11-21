export type ManagedAccount={id:string;email:string;name:string;role:"admin"|"customer";status:"active"|"banned"|"deleted";registered_at:string;last_seen_at:string|null;version:number;reason:string;order_count:number};
export type AccountReport={total:number;customers:number;admins:number;banned:number;deleted:number;active30:number;matched:number;accounts:ManagedAccount[];daily:{date:string;count:number}[]};
export type AccountActionState={ok?:boolean;message:string};
export type AccountGrowth = {
 coverage_start: string; as_of: string; registered: number; active30: number; new_month: number;
 daily: {date:string; registered:number; new_registered:number; active:number|null; active30:number|null}[];
};
