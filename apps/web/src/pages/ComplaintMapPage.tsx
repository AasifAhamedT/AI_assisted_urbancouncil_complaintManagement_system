import { useEffect, useState, type FormEvent } from "react";

import { apiRequest, messageFromError } from "../api/client";
import type { Category, ComplaintMapMarker, ComplaintStatus } from "../api/types";
import { MarkerMap } from "../components/ComplaintMap";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { humanize } from "../utils/format";

const statuses: ComplaintStatus[] = ["SUBMITTED", "UNDER_REVIEW", "AWAITING_INFORMATION", "IN_PROGRESS", "RESOLVED", "REJECTED", "CLOSED"];

export const ComplaintMapPage = () => {
  const [markers, setMarkers] = useState<ComplaintMapMarker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState({ status: "", categoryId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (values = filters) => {
    setLoading(true); setError("");
    const query = new URLSearchParams();
    if (values.status) query.set("status", values.status);
    if (values.categoryId) query.set("categoryId", values.categoryId);
    try {
      const response = await apiRequest<{ data: { markers: ComplaintMapMarker[] } }>({ url: `/api/v1/gis/markers?${query}` });
      setMarkers(response.data.markers);
    } catch (reason) { setError(messageFromError(reason)); } finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    apiRequest<{ data: { categories: Category[] } }>({ url: "/api/v1/complaints/categories" })
      .then((response) => setCategories(response.data.categories))
      .catch(() => undefined);
  // Filters are deliberately applied only when the form is submitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: FormEvent) => { event.preventDefault(); void load(filters); };

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="GIS workspace" title="Complaint map" description="Markers are limited by your authenticated complaint access. Department Accounts see only their department's assigned complaints." />
      {error && <ErrorBanner message={error} />}
      <form className="panel map-filter" onSubmit={submit}>
        <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></label>
        <label>Category<select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <button className="button button-primary">Apply filters</button>
      </form>
      <section className="panel map-panel">
        <div className="panel-heading"><div><p className="eyebrow">Authorized locations</p><h2>{markers.length} mapped complaint{markers.length === 1 ? "" : "s"}</h2></div></div>
        {loading ? <LoadingState label="Loading map" /> : markers.length === 0 ? <EmptyState title="No mapped complaints" description="No saved locations match the selected filters and your access scope." /> : <MarkerMap markers={markers} />}
      </section>
      <p className="map-boundary-note">Council administrative boundaries have not been confirmed and are therefore not displayed. [NEEDS CONFIRMATION]</p>
    </div>
  );
};
