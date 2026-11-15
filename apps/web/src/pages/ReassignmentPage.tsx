import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type {
  Department,
  Pagination,
  ReassignmentRequest,
  ReassignmentStatus
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../utils/format";

const filters: Array<{ value: ReassignmentStatus | ""; label: string }> = [
  { value: "", label: "All requests" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" }
];

export const ReassignmentPage = () => {
  const { session } = useAuth();
  const [items, setItems] = useState<ReassignmentRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<ReassignmentStatus | "">("PENDING");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdministrator = session?.user.role === "ADMINISTRATOR";
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );
  const departmentNames = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments]
  );

  const selectItem = (item: ReassignmentRequest) => {
    setSelectedId(item.id);
    setTargetDepartmentId("");
    setDecisionReason("");
    setError("");
    setSuccess("");
  };

  const load = useCallback(async (preferredId?: string) => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const query = status ? `&status=${status}` : "";
      const requests = await apiRequest<{
        data: { items: ReassignmentRequest[]; pagination: Pagination };
      }>({ url: `/api/v1/reassignments?page=1&pageSize=100${query}` });
      let nextDepartments = departments;
      if (session.user.role === "ADMINISTRATOR" && departments.length === 0) {
        const departmentResponse = await apiRequest<{ data: { departments: Department[] } }>({
          url: "/api/v1/admin/departments"
        });
        nextDepartments = departmentResponse.data.departments;
        setDepartments(nextDepartments);
      }
      const nextItems = requests.data.items;
      setItems(nextItems);
      setPagination(requests.data.pagination);
      const next = nextItems.find((item) => item.id === preferredId) ?? nextItems[0];
      if (next) selectItem(next);
      else setSelectedId("");
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setLoading(false);
    }
  }, [departments, session, status]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (!selected || !decisionReason.trim()) return;
    if (decision === "APPROVED" && !targetDepartmentId) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest({
        method: "POST",
        url: `/api/v1/reassignments/${selected.id}/decision`,
        data: {
          decision,
          decisionReason: decisionReason.trim(),
          ...(decision === "APPROVED" ? { targetDepartmentId } : {})
        }
      });
      await load();
      setSuccess(
        decision === "APPROVED"
          ? "Reassignment approved. The complaint moved to the selected department without changing its status."
          : "Reassignment request rejected. The complaint assignment was not changed."
      );
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setBusy(false);
    }
  };

  const approve = (event: FormEvent) => {
    event.preventDefault();
    void decide("APPROVED");
  };

  if (!session) return null;
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={isAdministrator ? "Administrator" : "Department Account"}
        title="Department reassignment"
        description={isAdministrator
          ? "Review department requests and move complaints through a recorded approval decision. Complaint processing status remains separate."
          : "Track requests submitted by your department. New requests start from an assigned complaint page."}
      />
      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}
      <section className="panel reassignment-filter">
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value as ReassignmentStatus | "")}>
            {filters.map((filter) => <option key={filter.value || "ALL"} value={filter.value}>{filter.label}</option>)}
          </select>
        </label>
        <p>{pagination ? `${pagination.total} matching request${pagination.total === 1 ? "" : "s"}` : "Loading request count"}</p>
      </section>
      {loading ? <LoadingState label="Loading reassignment requests" /> : items.length === 0 ? (
        <section className="panel"><EmptyState title="No matching requests" description={isAdministrator ? "No reassignment decisions are waiting in this view." : "Your department has not submitted a request in this view."} /></section>
      ) : (
        <div className="reassignment-layout">
          <section className="panel reassignment-queue">
            <div className="panel-heading"><div><p className="eyebrow">Request ledger</p><h2>{items.length} shown</h2></div></div>
            <div className="reassignment-list">
              {items.map((item) => (
                <button className={item.id === selectedId ? "selected" : ""} key={item.id} onClick={() => selectItem(item)}>
                  <span><small>{item.complaintReference}</small><strong>{item.reason}</strong><em>{formatDate(item.createdAt)}</em></span>
                  <StatusBadge value={item.status} />
                </button>
              ))}
            </div>
          </section>
          {selected && (
            <section className="panel reassignment-review-card">
              <div className="classification-card-heading">
                <div><p className="eyebrow">Reassignment request</p><h2>{selected.complaintReference}</h2></div>
                {(isAdministrator || selected.status === "PENDING") && <Link className="button button-secondary button-small" to={`/complaints/${selected.complaintId}`}>Open complaint</Link>}
              </div>
              <div className="reassignment-summary">
                <StatusBadge value={selected.status} />
                <dl>
                  <div><dt>Requested</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                  <div><dt>From department</dt><dd>{departmentNames.get(selected.fromDepartmentId) ?? (isAdministrator ? selected.fromDepartmentId : "Your department")}</dd></div>
                  {selected.approvedDepartmentId && <div><dt>Approved destination</dt><dd>{departmentNames.get(selected.approvedDepartmentId) ?? selected.approvedDepartmentId}</dd></div>}
                </dl>
                <div><small>Department reason</small><p>{selected.reason}</p></div>
                {selected.decisionReason && <div><small>Administrator decision reason</small><p>{selected.decisionReason}</p></div>}
              </div>
              {isAdministrator && selected.status === "PENDING" && (
                <form className="reassignment-decision-form" onSubmit={approve}>
                  <label>Approved destination department
                    <select required value={targetDepartmentId} onChange={(event) => setTargetDepartmentId(event.target.value)}>
                      <option value="">Choose a department</option>
                      {departments.filter((department) => department.isActive && department.id !== selected.fromDepartmentId).map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Decision reason <span className="required-note">Required</span>
                    <textarea rows={4} minLength={5} maxLength={1000} required value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Record why this complaint should move or remain assigned." />
                  </label>
                  <div className="classification-actions">
                    <button type="button" className="button button-danger" disabled={busy || decisionReason.trim().length < 5} onClick={() => void decide("REJECTED")}>Reject request</button>
                    <button className="button button-primary" disabled={busy || !targetDepartmentId || decisionReason.trim().length < 5}>{busy ? "Saving…" : "Approve reassignment"}</button>
                  </div>
                </form>
              )}
              {!isAdministrator && selected.status === "PENDING" && <div className="future-inline"><Icon name="alert" /><div><strong>Awaiting Administrator decision</strong><p>The complaint remains assigned to your department until an approval is recorded.</p></div></div>}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
