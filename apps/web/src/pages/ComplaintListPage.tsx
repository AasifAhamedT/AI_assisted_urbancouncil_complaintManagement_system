import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type { Complaint, ComplaintStatus, Pagination } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../utils/format";

const statuses: Array<ComplaintStatus | ""> = ["", "SUBMITTED", "UNDER_REVIEW", "AWAITING_INFORMATION", "IN_PROGRESS", "RESOLVED", "REJECTED", "CLOSED"];

export const ComplaintListPage = () => {
  const { session } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ComplaintStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "10", sortBy: "createdAt", sortOrder: "desc" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    apiRequest<{ data: { items: Complaint[]; pagination: Pagination } }>({ url: `/api/v1/complaints?${params}` })
      .then((response) => { if (active) { setItems(response.data.items); setPagination(response.data.pagination); } })
      .catch((reason) => active && setError(messageFromError(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, search, status]);

  if (!session) return null;
  const role = session.user.role;
  const title = role === "CITIZEN" ? "My complaints" : role === "DEPARTMENT" ? "Assigned complaints" : "Complaint management";
  const description = role === "CITIZEN" ? "View and follow every concern you have submitted." : role === "DEPARTMENT" ? "Only complaints routed to your department are shown." : "Search and monitor complaints across the system.";
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(query.trim()); };

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Complaint register" title={title} description={description} actions={role === "CITIZEN" ? <Link className="button button-primary" to="/complaints/new"><Icon name="plus" /> Report an issue</Link> : undefined} />
      <section className="panel filter-panel">
        <form onSubmit={submitSearch} className="search-form">
          <label className="search-input"><span className="sr-only">Search complaints</span><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, description or reference" maxLength={100} /></label>
          <label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setStatus(event.target.value as ComplaintStatus | ""); setPage(1); }}>{statuses.map((item) => <option value={item} key={item || "all"}>{item ? item.replaceAll("_", " ") : "All statuses"}</option>)}</select></label>
          <button className="button button-secondary">Search</button>
        </form>
      </section>
      {error && <ErrorBanner message={error} />}
      <section className="panel complaints-panel">
        <div className="panel-heading"><div><p className="eyebrow">Authorized results</p><h2>{pagination?.total ?? 0} complaint{pagination?.total === 1 ? "" : "s"}</h2></div></div>
        {loading ? <LoadingState label="Loading complaints" /> : items.length === 0 ? <EmptyState title="No matching complaints" description="Try a different search or status filter." /> : (
          <div className="complaint-list">
            {items.map((complaint) => (
              <Link to={`/complaints/${complaint.id}`} key={complaint.id} className="complaint-row">
                <div className="complaint-primary"><span className="reference">{complaint.referenceNumber}</span><h3>{complaint.title}</h3><p>{complaint.description}</p></div>
                <div className="complaint-meta"><StatusBadge value={complaint.status} /><span>{formatDate(complaint.updatedAt)}</span><span>Version {complaint.version}</span></div>
                <Icon name="arrow" className="row-arrow" />
              </Link>
            ))}
          </div>
        )}
        {pagination && pagination.totalPages > 1 && <div className="pagination"><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="button button-secondary" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
      </section>
    </div>
  );
};
