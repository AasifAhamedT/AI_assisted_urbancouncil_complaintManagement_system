import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type { Complaint, Pagination } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../utils/format";

export const DashboardPage = () => {
  const { session } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ data: { items: Complaint[]; pagination: Pagination } }>({
      url: "/api/v1/complaints?page=1&pageSize=100&sortBy=createdAt&sortOrder=desc"
    }).then((response) => {
      if (active) {
        setComplaints(response.data.items);
        setPagination(response.data.pagination);
      }
    }).catch((reason) => active && setError(messageFromError(reason))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => ({
    total: pagination?.total ?? complaints.length,
    open: complaints.filter((item) => !["RESOLVED", "REJECTED", "CLOSED"].includes(item.status)).length,
    awaiting: complaints.filter((item) => item.status === "AWAITING_INFORMATION").length,
    completed: complaints.filter((item) => ["RESOLVED", "CLOSED"].includes(item.status)).length
  }), [complaints, pagination]);

  if (!session) return null;
  const role = session.user.role;
  const intro = role === "CITIZEN"
    ? "Track your reports and see what the Council is doing next."
    : role === "DEPARTMENT"
      ? "Review the workload currently assigned to your department."
      : "Monitor complaint activity and maintain Council configuration.";

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Dashboard"
        title={`Good ${new Date().getHours() < 12 ? "morning" : "day"}, ${session.user.displayName.split(" ")[0]}`}
        description={intro}
        actions={role === "CITIZEN" ? <Link className="button button-primary" to="/complaints/new"><Icon name="plus" /> Report an issue</Link> : undefined}
      />
      {error && <ErrorBanner message={error} />}
      <section className="metric-grid" aria-label="Complaint summary">
        <article className="metric-card metric-total"><span><Icon name="complaints" /></span><div><small>Total visible</small><strong>{metrics.total}</strong><p>Within your authorized scope</p></div></article>
        <article className="metric-card metric-open"><span><Icon name="alert" /></span><div><small>In progress</small><strong>{metrics.open}</strong><p>Requiring Council action</p></div></article>
        <article className="metric-card metric-awaiting"><span><Icon name="user" /></span><div><small>Awaiting information</small><strong>{metrics.awaiting}</strong><p>Waiting for citizen response</p></div></article>
        <article className="metric-card metric-done"><span><Icon name="check" /></span><div><small>Resolved or closed</small><strong>{metrics.completed}</strong><p>Completed visible cases</p></div></article>
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent complaints</h2></div><Link to="/complaints">View all <Icon name="arrow" /></Link></div>
          {loading ? <LoadingState label="Loading complaints" /> : complaints.length === 0 ? <EmptyState title="No complaints yet" description={role === "CITIZEN" ? "Your submitted concerns will appear here." : "There are no complaints in your current scope."} /> : (
            <div className="complaint-list compact-list">
              {complaints.slice(0, 5).map((complaint) => (
                <Link to={`/complaints/${complaint.id}`} key={complaint.id} className="complaint-row">
                  <div><span className="reference">{complaint.referenceNumber}</span><h3>{complaint.title}</h3><p>{formatDate(complaint.updatedAt)}</p></div>
                  <StatusBadge value={complaint.status} /><Icon name="arrow" className="row-arrow" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="panel next-panel">
          <p className="eyebrow">Quick access</p><h2>{role === "ADMINISTRATOR" ? "System controls" : "What you can do"}</h2>
          <div className="quick-links">
            {role === "CITIZEN" && <><Link to="/complaints/new"><Icon name="plus" /><span><strong>Report an issue</strong><small>Submit a new civic concern</small></span><Icon name="arrow" /></Link><Link to="/knowledge"><Icon name="chat" /><span><strong>Document guide</strong><small>Ask grounded public-information questions</small></span><Icon name="arrow" /></Link></>}
            {role === "DEPARTMENT" && <><Link to="/complaints"><Icon name="complaints" /><span><strong>Assigned workload</strong><small>Review and update complaints</small></span><Icon name="arrow" /></Link><Link to="/reassignments"><Icon name="complaints" /><span><strong>Reassignment requests</strong><small>Track your department's requests</small></span><Icon name="arrow" /></Link></>}
            {role === "ADMINISTRATOR" && <><Link to="/admin/setup"><Icon name="settings" /><span><strong>Council setup</strong><small>Departments, categories and accounts</small></span><Icon name="arrow" /></Link><Link to="/reassignments"><Icon name="complaints" /><span><strong>Reassignment decisions</strong><small>Review department routing requests</small></span><Icon name="arrow" /></Link><Link to="/admin/integrations"><Icon name="integrations" /><span><strong>System services</strong><small>Check internal service readiness</small></span><Icon name="arrow" /></Link></>}
          </div>
        </aside>
      </div>
    </div>
  );
};
