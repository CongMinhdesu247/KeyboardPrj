export default function AdminLoading() {
 return <main id="main" className="container page-container" aria-busy="true" aria-label="Đang tải dữ liệu quản trị"><p role="status">Đang tải dữ liệu quản trị…</p><div className="dashboard-skeleton" aria-hidden="true"><div className="skeleton-heading"/><div className="dashboard-kpis">{[1,2,3,4].map(n=><div key={n}/>)}</div><div className="skeleton-chart"/><div className="skeleton-chart"/></div></main>;
}
