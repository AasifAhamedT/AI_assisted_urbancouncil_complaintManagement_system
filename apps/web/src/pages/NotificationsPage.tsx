import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type {
  NotificationPreference,
  NotificationRecord,
  Pagination
} from "../api/types";
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { formatDate, humanize } from "../utils/format";

const notifyBadgeChanged = () => window.dispatchEvent(new Event("notifications-updated"));

const safePath = (notification: NotificationRecord): string | null => {
  const path = notification.metadata?.path;
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
    ? path
    : null;
};

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [preference, setPreference] = useState<NotificationPreference | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listResponse, countResponse, preferenceResponse] = await Promise.all([
        apiRequest<{ data: { items: NotificationRecord[]; pagination: Pagination } }>({
          url: `/api/v1/notifications?page=${page}&pageSize=20&unreadOnly=${unreadOnly}`
        }),
        apiRequest<{ data: { unreadCount: number } }>({
          url: "/api/v1/notifications/unread-count"
        }),
        apiRequest<{ data: { preference: NotificationPreference } }>({
          url: "/api/v1/notifications/preferences/me"
        })
      ]);
      setItems(listResponse.data.items);
      setPagination(listResponse.data.pagination);
      setUnreadCount(countResponse.data.unreadCount);
      setPreference(preferenceResponse.data.preference);
      notifyBadgeChanged();
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (notification: NotificationRecord, followLink: boolean) => {
    setError("");
    try {
      if (!notification.readAt) {
        await apiRequest({
          method: "PATCH",
          url: `/api/v1/notifications/${notification.id}/read`
        });
        setItems((current) => unreadOnly
          ? current.filter((item) => item.id !== notification.id)
          : current.map((item) => item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item));
        if (unreadOnly) {
          setPagination((current) => current ? {
            ...current,
            total: Math.max(0, current.total - 1),
            totalPages: Math.ceil(Math.max(0, current.total - 1) / current.pageSize)
          } : current);
        }
        setUnreadCount((current) => Math.max(0, current - 1));
        notifyBadgeChanged();
      }
      const path = safePath(notification);
      if (followLink && path) navigate(path);
    } catch (reason) {
      setError(messageFromError(reason));
    }
  };

  const markAllRead = async () => {
    setBusy(true); setError(""); setSuccess("");
    try {
      await apiRequest({ method: "POST", url: "/api/v1/notifications/read-all" });
      setSuccess("All notifications marked as read.");
      await load();
      notifyBadgeChanged();
    } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); }
  };

  const updatePreference = async (inAppEnabled: boolean) => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await apiRequest<{ data: { preference: NotificationPreference } }>({
        method: "PUT",
        url: "/api/v1/notifications/preferences/me",
        data: { inAppEnabled }
      });
      setPreference(response.data.preference);
      setSuccess(inAppEnabled
        ? "In-app notifications enabled."
        : "In-app notifications disabled. Existing history remains available.");
    } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); }
  };

  const changeFilter = (nextUnreadOnly: boolean) => {
    setUnreadOnly(nextUnreadOnly);
    setPage(1);
    setSuccess("");
  };

  return (
    <div className="page-wrap narrow-page">
      <PageHeader
        eyebrow="Notification centre"
        title="Your updates"
        description="Durable, private updates for complaint activity relevant to your account. Email and SMS delivery are not enabled."
        actions={unreadCount > 0 ? <button className="button button-secondary" disabled={busy} onClick={() => void markAllRead()}>Mark all read</button> : undefined}
      />
      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}
      <div className="notification-toolbar">
        <div className="notification-tabs" role="group" aria-label="Notification filter">
          <button className={!unreadOnly ? "active" : ""} onClick={() => changeFilter(false)}>All</button>
          <button className={unreadOnly ? "active" : ""} onClick={() => changeFilter(true)}>Unread <span>{unreadCount}</span></button>
        </div>
        <span>{pagination ? `${pagination.total} shown in this filter` : "Loading count"}</span>
      </div>
      <div className="notification-layout">
        <section className="panel notification-panel">
          {loading ? <LoadingState label="Loading notifications" /> : items.length === 0 ? (
            <EmptyState title={unreadOnly ? "No unread notifications" : "No notifications yet"} description="Relevant complaint and reassignment updates will appear here." />
          ) : (
            <div className="notification-list">
              {items.map((notification) => {
                const path = safePath(notification);
                return <article className={notification.readAt ? "notification-item" : "notification-item unread"} key={notification.id}>
                  <span className="notification-icon"><Icon name={notification.eventType.startsWith("REASSIGNMENT") ? "complaints" : "bell"} /></span>
                  <div className="notification-copy">
                    <div><small>{humanize(notification.eventType)}</small><time>{formatDate(notification.createdAt)}</time></div>
                    <h2>{notification.title}</h2>
                    <p>{notification.message}</p>
                    <div className="notification-actions">
                      {!notification.readAt && <button onClick={() => void markRead(notification, false)}>Mark as read</button>}
                      {path && <button onClick={() => void markRead(notification, true)}>Open update</button>}
                    </div>
                  </div>
                </article>;
              })}
            </div>
          )}
          {pagination && pagination.totalPages > 1 && <div className="pagination notification-pagination"><button className="button button-secondary button-small" disabled={page <= 1 || busy} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="button button-secondary button-small" disabled={page >= pagination.totalPages || busy} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
        </section>
        <aside className="panel notification-preferences">
          <p className="eyebrow">Delivery preference</p>
          <h2>In-app notifications</h2>
          <p>Control whether new notification records are created for this account.</p>
          <label className="preference-switch">
            <input type="checkbox" checked={preference?.inAppEnabled ?? true} disabled={busy || !preference} onChange={(event) => void updatePreference(event.target.checked)} />
            <span><strong>{preference?.inAppEnabled === false ? "Disabled" : "Enabled"}</strong><small>Existing notification history is retained.</small></span>
          </label>
          <div className="future-inline"><Icon name="alert" /><div><strong>Email and SMS unavailable</strong><p>Only in-app delivery is implemented and approved in this phase.</p></div></div>
        </aside>
      </div>
    </div>
  );
};
