import { useEffect, useMemo, useState, type FormEvent } from "react";

import { apiRequest, messageFromError } from "../api/client";
import type { ComplaintStatus, OperationalReport } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { humanize } from "../utils/format";
import { downloadReport } from "../utils/report-export";

const statuses: ComplaintStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_INFORMATION",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "CLOSED"
];

const today = () => new Date().toISOString().slice(0, 10);
const daysBefore = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};
const displayDate = (value: string) => new Intl.DateTimeFormat("en-LK", {
  dateStyle: "medium",
  timeZone: "UTC"
}).format(new Date(`${value}T00:00:00.000Z`));
const duration = (hours: number | null) => {
  if (hours === null) return "Not available";
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
};

interface ReportFilters {
  from: string;
  to: string;
  bucket: "day" | "week" | "month";
  status: "" | ComplaintStatus;
  categoryId: string;
  departmentId: string;
}

const initialFilters = (): ReportFilters => {
  const to = today();
  return { from: daysBefore(to, 29), to, bucket: "day", status: "", categoryId: "", departmentId: "" };
};

const Distribution = ({
  title,
  items,
  emptyMessage
}: {
  title: string;
  items: Array<{ id?: string | null; key?: string; label: string; count: number }>;
  emptyMessage: string;
}) => {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="panel report-distribution">
      <div className="panel-heading"><div><p className="eyebrow">Breakdown</p><h2>{title}</h2></div></div>
      {items.length === 0 ? <EmptyState title="No report data" description={emptyMessage} /> : (
        <div className="distribution-list">
          {items.map((item) => (
            <div className="distribution-row" key={item.id ?? item.key ?? item.label}>
              <div><strong>{item.label}</strong><span>{item.count}</span></div>
              <span className="distribution-track"><span style={{ width: `${(item.count / maximum) * 100}%` }} /></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const ReportsPage = () => {
  const { session } = useAuth();
  const [draft, setDraft] = useState<ReportFilters>(initialFilters);
  const [applied, setApplied] = useState<ReportFilters>(initialFilters);
  const [report, setReport] = useState<OperationalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({
      from: applied.from,
      to: applied.to,
      bucket: applied.bucket
    });
    if (applied.status) parameters.set("status", applied.status);
    if (applied.categoryId) parameters.set("categoryId", applied.categoryId);
    if (session?.user.role === "ADMINISTRATOR" && applied.departmentId) {
      parameters.set("departmentId", applied.departmentId);
    }
    apiRequest<{ data: { report: OperationalReport } }>({
      url: `/api/v1/reports/overview?${parameters.toString()}`
    }).then((response) => {
      if (active) setReport(response.data.report);
    }).catch((reason) => {
      if (active) {
        setReport(null);
        setError(messageFromError(reason));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [applied, session?.user.role]);

  const trendMaximum = useMemo(() => Math.max(
    1,
    ...(report?.trend.flatMap((item) => [item.submitted, item.resolved, item.closed]) ?? [1])
  ), [report]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setApplied({ ...draft });
  };

  if (!session) return null;
  const isAdministrator = session.user.role === "ADMINISTRATOR";
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Operational reporting"
        title="Reports and analytics"
        actions={<button className="button button-secondary" disabled={loading || !report || Boolean(error)} onClick={() => report && downloadReport(report)}><Icon name="file" /> Download CSV</button>}
        description={isAdministrator
          ? "Review system-wide complaint activity or narrow the report to one department."
          : "Review complaint activity only for the department assigned to this account."}
      />
      <form className="panel report-filters" onSubmit={applyFilters}>
        <label>From<input type="date" value={draft.from} max={draft.to} onChange={(event) => setDraft({ ...draft, from: event.target.value })} required /></label>
        <label>To<input type="date" value={draft.to} min={draft.from} onChange={(event) => setDraft({ ...draft, to: event.target.value })} required /></label>
        <label>Interval<select value={draft.bucket} onChange={(event) => setDraft({ ...draft, bucket: event.target.value as ReportFilters["bucket"] })}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
        <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReportFilters["status"] })}><option value="">All statuses</option>{statuses.map((status) => <option value={status} key={status}>{humanize(status)}</option>)}</select></label>
        <label>Category<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">All categories</option>{report?.filterOptions.categories.map((item) => <option value={item.id} key={item.id}>{item.name}{item.isActive ? "" : " (inactive)"}</option>)}</select></label>
        {isAdministrator && <label>Department<select value={draft.departmentId} onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}><option value="">All departments</option>{report?.filterOptions.departments.map((item) => <option value={item.id} key={item.id}>{item.name}{item.isActive ? "" : " (inactive)"}</option>)}</select></label>}
        <button className="button button-primary" type="submit">Apply filters</button>
      </form>
      {error && <ErrorBanner message={error} />}
      {loading ? <section className="panel"><LoadingState label="Preparing report" /></section> : report && (
        <>
          <div className="report-context" role="status">
            <Icon name="shield" />
            <div><strong>{report.scope.label}</strong><span>{displayDate(report.period.from)} – {displayDate(report.period.to)} (UTC) · Generated {new Date(report.period.generatedAt).toLocaleString("en-LK")}</span><span>Applied filters: {report.filters.status ? humanize(report.filters.status) : "All statuses"} · {report.filters.categoryLabel ?? "All categories"} · {report.period.bucket}. Download exports these displayed results; apply edited filters first.</span></div>
          </div>
          <section className="metric-grid" aria-label="Report summary">
            <article className="metric-card metric-total"><span><Icon name="complaints" /></span><div><small>Submitted</small><strong>{report.summary.total}</strong><p>Within this reporting period</p></div></article>
            <article className="metric-card metric-open"><span><Icon name="alert" /></span><div><small>Open workload</small><strong>{report.summary.open}</strong><p>Current non-terminal status</p></div></article>
            <article className="metric-card metric-done"><span><Icon name="check" /></span><div><small>Resolved or closed</small><strong>{report.summary.resolved + report.summary.closed}</strong><p>From period submissions</p></div></article>
            <article className="metric-card metric-awaiting"><span><Icon name="dashboard" /></span><div><small>Average resolution</small><strong className="duration-value">{duration(report.summary.averageResolutionHours)}</strong><p>{report.summary.resolutionSampleSize} completed sample{report.summary.resolutionSampleSize === 1 ? "" : "s"}</p></div></article>
          </section>
          <section className="panel report-trend">
            <div className="panel-heading"><div><p className="eyebrow">Activity over time</p><h2>Complaint events</h2></div><div className="trend-legend"><span className="submitted">Submitted</span><span className="resolved">Resolved</span><span className="closed">Closed</span></div></div>
            {report.trend.every((item) => item.submitted + item.resolved + item.closed === 0) ? <EmptyState title="No activity in this period" description="Try a wider date range or remove one of the filters." /> : (
              <div className="trend-list">
                {report.trend.map((item) => (
                  <div className="trend-row" key={item.periodStart}>
                    <strong>{displayDate(item.periodStart)}</strong>
                    <div className="trend-bars" aria-label={`${item.submitted} submitted, ${item.resolved} resolved, ${item.closed} closed`}>
                      <span className="trend-bar submitted" style={{ width: `${(item.submitted / trendMaximum) * 100}%` }}><i>{item.submitted || ""}</i></span>
                      <span className="trend-bar resolved" style={{ width: `${(item.resolved / trendMaximum) * 100}%` }}><i>{item.resolved || ""}</i></span>
                      <span className="trend-bar closed" style={{ width: `${(item.closed / trendMaximum) * 100}%` }}><i>{item.closed || ""}</i></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="report-grid">
            <Distribution title="By status" items={report.byStatus.filter((item) => item.count > 0)} emptyMessage="No status totals match these filters." />
            <Distribution title="By category" items={report.byCategory} emptyMessage="No category totals match these filters." />
            {isAdministrator && <Distribution title="By department" items={report.byDepartment} emptyMessage="No department totals match these filters." />}
            <section className="panel reassignment-report">
              <div className="panel-heading"><div><p className="eyebrow">Routing governance</p><h2>Reassignment activity</h2></div></div>
              <dl>
                <div><dt>Requests</dt><dd>{report.reassignments.total}</dd></div>
                <div><dt>Pending</dt><dd>{report.reassignments.pending}</dd></div>
                <div><dt>Approved</dt><dd>{report.reassignments.approved}</dd></div>
                <div><dt>Rejected</dt><dd>{report.reassignments.rejected}</dd></div>
                <div className="wide"><dt>Average decision time</dt><dd>{duration(report.reassignments.averageDecisionHours)}</dd><small>{report.reassignments.decisionSampleSize} decided request{report.reassignments.decisionSampleSize === 1 ? "" : "s"}</small></div>
              </dl>
              <p>Department reports include requests originating from that department. Reassignment remains separate from complaint status.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
