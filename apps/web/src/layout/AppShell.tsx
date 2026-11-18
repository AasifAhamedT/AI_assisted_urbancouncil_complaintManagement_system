import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import type { RoleCode } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon, type IconName } from "../components/Icon";
import { humanize } from "../utils/format";
import { apiRequest } from "../api/client";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles?: RoleCode[];
}

const navigation: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: "dashboard" },
  { to: "/complaints", label: "My complaints", icon: "complaints", roles: ["CITIZEN"] },
  { to: "/complaints/new", label: "Report an issue", icon: "plus", roles: ["CITIZEN"] },
  { to: "/complaints", label: "Assigned complaints", icon: "complaints", roles: ["DEPARTMENT"] },
  { to: "/complaints", label: "All complaints", icon: "complaints", roles: ["ADMINISTRATOR"] },
  { to: "/map", label: "Complaint map", icon: "map", roles: ["DEPARTMENT", "ADMINISTRATOR"] },
  { to: "/reassignments", label: "Reassignments", icon: "complaints", roles: ["DEPARTMENT", "ADMINISTRATOR"] },
  { to: "/reports", label: "Reports", icon: "dashboard", roles: ["DEPARTMENT", "ADMINISTRATOR"] },
  { to: "/notifications", label: "Notifications", icon: "bell" },
  { to: "/knowledge", label: "Document guide", icon: "chat", roles: ["CITIZEN"] },
  { to: "/admin/setup", label: "Council setup", icon: "settings", roles: ["ADMINISTRATOR"] },
  { to: "/admin/classifications", label: "AI review", icon: "integrations", roles: ["ADMINISTRATOR"] },
  { to: "/admin/integrations", label: "System services", icon: "integrations", roles: ["ADMINISTRATOR"] },
  { to: "/admin/knowledge", label: "Knowledge documents", icon: "file", roles: ["ADMINISTRATOR"] },
  { to: "/future", label: "Upcoming tools", icon: "future" }
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const refreshUnread = useCallback(() => {
    void apiRequest<{ data: { unreadCount: number } }>({
      url: "/api/v1/notifications/unread-count"
    }).then((response) => setUnreadNotifications(response.data.unreadCount)).catch(() => undefined);
  }, []);
  useEffect(() => {
    refreshUnread();
    const interval = window.setInterval(refreshUnread, 60_000);
    window.addEventListener("notifications-updated", refreshUnread);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("notifications-updated", refreshUnread);
    };
  }, [refreshUnread, session?.user.id]);
  if (!session) return null;
  const items = navigation.filter((item) => !item.roles || item.roles.includes(session.user.role));
  const roleLabel = session.user.role === "DEPARTMENT" ? "Department Account" : humanize(session.user.role);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-frame">
      <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
        <Icon name="menu" />
      </button>
      {menuOpen && <button className="nav-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="building" /></span>
          <span><strong>Urban Council</strong><small>Complaint Portal</small></span>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <nav aria-label="Primary navigation">
          {items.map((item) => (
            <NavLink key={`${item.to}-${item.label}`} to={item.to} end={item.to === "/dashboard"} onClick={() => setMenuOpen(false)}>
              <Icon name={item.icon} /><span>{item.label}</span>{item.to === "/notifications" && unreadNotifications > 0 && <strong className="nav-count" aria-label={`${unreadNotifications} unread notifications`}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</strong>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-profile">
          <span className="avatar">{session.user.displayName.slice(0, 1).toUpperCase()}</span>
          <span className="profile-copy"><strong>{session.user.displayName}</strong><small>{roleLabel}</small></span>
          <button onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
};
