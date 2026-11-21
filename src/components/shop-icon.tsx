const paths={
 calculator:"M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M8 6h8v4H8z M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01 M16 18h.01",
 home:"M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7",
 money:"M2 5h20v14H2z M2 9a4 4 0 0 0 4-4 M18 5a4 4 0 0 0 4 4 M2 15a4 4 0 0 1 4 4 M18 19a4 4 0 0 1 4-4 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
 storefront:"M3 10V7l2-4h14l2 4v3 M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M4 13v8h16v-8 M9 21v-6h6v6 M3 7h18",
 wrench:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
 keyboard:"M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M6 9h.01 M10 9h.01 M14 9h.01 M18 9h.01 M6 12h.01 M10 12h.01 M14 12h.01 M18 12h.01 M7 15h10",
 chat:"M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6 4V4a1 1 0 0 1 1-1z M7 8h10 M7 12h7",
 user:"M20 21v-2a7 7 0 0 0-14 0v2 M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
 book:"M12 6C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2z M12 6v15",
 search:"M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
 logout:"M9 4H4v16h5 M9 12h13 M17 7l5 5-5 5",
 box:"M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10",
 shield:"M12 3l9 4v6c0 5-9 9-9 9S3 18 3 13V7z M8 12l3 3 5-6",
 lock:"M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4",
 check:"M5 12l4 4L20 5",
 arrow:"M5 12h14 M13 6l6 6-6 6",
 pin:"M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
};
export function ShopIcon({name,size=20}:{name:keyof typeof paths;size?:number}) {
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
