"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAdminInbox, readAdminNotifications } from "@/app/admin/inbox/actions";
import { inboxHref, inboxLabels, type AdminInbox, type InboxItem } from "@/lib/inbox-contract";
import { formatDate } from "@/lib/tracking";

function useInbox(initial?: AdminInbox, unread = false, offset = 0) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initial);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await loadAdminInbox(unread, offset);
      if (request !== generation.current) return;
      if (result.data) { setData(result.data); setError(""); }
      else setError(result.error ?? "Chưa tải được thông báo.");
    } catch {
      if (request === generation.current) setError("Chưa tải được thông báo. Hãy thử lại.");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [unread, offset]);
  useEffect(() => {
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    // Load the noncritical toolbar after paint; polling never blocks page rendering.
    const initialLoad = window.setTimeout(visibleRefresh, 0);
    const timer = window.setInterval(visibleRefresh, 30000);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("focus", visibleRefresh);
    window.addEventListener("online", visibleRefresh);
    window.addEventListener("admin-inbox-changed", visibleRefresh);
    return () => {
      invalidate();
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibleRefresh);
      window.removeEventListener("focus", visibleRefresh);
      window.removeEventListener("online", visibleRefresh);
      window.removeEventListener("admin-inbox-changed", visibleRefresh);
    };
  }, [refresh, invalidate]);
  return { data, error, loading, refresh };
}

function InboxList({ data, onSelect }: { data: AdminInbox; onSelect: (item: InboxItem) => Promise<void> }) {
  return !data.items.length ? <div className="admin-inbox-empty"><strong>Không có thông báo mới</strong><p>Đơn hàng, thanh toán và yêu cầu hỗ trợ sẽ xuất hiện tại đây.</p></div> :
    <ul className="admin-inbox-list">{data.items.map(item => <li key={item.id} data-unread={!item.read_at}>
      <Link href={inboxHref(item)} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); void onSelect(item);
      }}>
        <span className="admin-inbox-dot" aria-label={item.read_at ? "Đã đọc" : "Chưa đọc"} />
        <span><strong>{inboxLabels[item.event_type] ?? "Thông báo cửa hàng"}</strong>
          <span className="admin-inbox-reference">{item.event_type.startsWith("order_") ? "Đơn" : item.event_type === "request_created" ? "Yêu cầu" : "Tư vấn"} · {item.entity_id.slice(0, 8).toUpperCase()}</span>
          <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
        </span>
        <span className="admin-inbox-arrow" aria-hidden="true">→</span>
      </Link>
    </li>)}</ul>;
}

function Bell() {
  const { data, error, loading, refresh } = useInbox();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const router = useRouter();
  async function read(input: { ids?: string[]; before?: string }) {
    setActionError(""); setBusy(true);
    try {
      const result = await readAdminNotifications(input);
      if (result.error) { setActionError(result.error); return false; }
      window.dispatchEvent(new Event("admin-inbox-changed"));
      return true;
    } catch { setActionError("Chưa đánh dấu được thông báo. Hãy thử lại."); return false; }
    finally { setBusy(false); }
  }
  async function select(item: InboxItem) {
    if (busy) return;
    if (!item.read_at && !await read({ ids: [item.id] })) return;
    dialog.current?.close();
    router.push(inboxHref(item));
  }
  return <header className="admin-toolbar">
    <span>Quản trị cửa hàng</span>
    <button ref={trigger} className="admin-bell-button" aria-label={`Thông báo${data ? `, ${data.unread} chưa đọc` : ""}`} aria-haspopup="dialog" aria-controls="admin-bell-dialog" onClick={() => { dialog.current?.showModal(); void refresh(); }}>
      <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4" /></svg>
      {data && data.unread > 0 && <span className="admin-bell-count">{data.unread > 99 ? "99+" : data.unread}</span>}
      {!data && error && <span className="admin-bell-count">!</span>}
    </button>
    <dialog ref={dialog} id="admin-bell-dialog" className="admin-bell-dialog" aria-labelledby="admin-bell-title" onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="admin-bell-heading"><div><h2 id="admin-bell-title">Thông báo</h2><p>{data ? `${data.unread} chưa đọc` : "Thông báo cửa hàng"}</p></div><button className="icon-button" aria-label="Đóng thông báo" onClick={() => dialog.current?.close()}>×</button></div>
      {error && <div className="admin-inbox-error" role="alert">{error}<button className="text-button" onClick={() => void refresh()}>Thử lại</button></div>}
      {actionError && <p className="admin-inbox-error" role="alert">{actionError}</p>}
      {loading && !data && <p role="status" className="admin-inbox-loading">Đang tải thông báo…</p>}
      {data && <><div className="admin-inbox-tools"><span>Cập nhật mỗi 30 giây</span><button className="text-button" disabled={!data.unread || busy} onClick={() => void read({ before: data.snapshot_at })}>{busy ? "Đang lưu…" : "Đọc tất cả"}</button></div><div aria-busy={busy}><InboxList data={data} onSelect={select} /></div></>}
      <div className="admin-bell-footer"><Link href="/admin/inbox" onClick={() => dialog.current?.close()}>Xem tất cả thông báo <span aria-hidden="true">→</span></Link></div>
    </dialog>
  </header>;
}

export function AdminNotificationBell() {
  const pathname = usePathname();
  return pathname === "/admin/login" || pathname === "/admin/join" ? null : <Bell />;
}

export function AdminInboxView({ initial }: { initial: AdminInbox }) {
  const [unread, setUnread] = useState(false);
  const [offset, setOffset] = useState(0);
  const { data, error, loading, refresh } = useInbox(initial, unread, offset);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const router = useRouter();
  async function mark(input: { ids?: string[]; before?: string }) {
    setBusy(true); setActionError("");
    try {
      const result = await readAdminNotifications(input);
      if (result.error) { setActionError(result.error); return false; }
      window.dispatchEvent(new Event("admin-inbox-changed")); return true;
    } catch { setActionError("Chưa đánh dấu được thông báo. Hãy thử lại."); return false; }
    finally { setBusy(false); }
  }
  return <>
    <div className="admin-inbox-page-tools"><div className="admin-inbox-filters" role="group" aria-label="Lọc thông báo">
      <button className="button button-outline" aria-pressed={!unread} disabled={loading} onClick={() => { setUnread(false); setOffset(0); }}>Tất cả</button>
      <button className="button button-outline" aria-pressed={unread} disabled={loading} onClick={() => { setUnread(true); setOffset(0); }}>Chưa đọc ({data?.unread ?? 0})</button>
    </div><button className="button button-outline" disabled={!data?.unread || busy || loading} onClick={() => data && void mark({ before: data.snapshot_at })}>{busy ? "Đang lưu…" : "Đánh dấu tất cả đã đọc"}</button></div>
    {(error || actionError) && <div className="admin-inbox-error" role="alert">{error || actionError}<button className="text-button" onClick={() => void refresh()}>Tải lại</button></div>}
    <section className="admin-inbox-page-list" aria-label="Danh sách thông báo" aria-busy={loading || busy}>{data && <InboxList data={data} onSelect={async item => {
      if (loading || busy) return;
      if (!item.read_at && !await mark({ ids: [item.id] })) return;
      router.push(inboxHref(item));
    }} />}</section>
    <div className="admin-inbox-pagination"><button className="button button-outline" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - 20))}>Trang trước</button><span>Trang {offset / 20 + 1}</span><button className="button button-outline" disabled={!data || offset + 20 >= data.total || loading} onClick={() => setOffset(value => value + 20)}>Trang sau</button></div>
  </>;
}
