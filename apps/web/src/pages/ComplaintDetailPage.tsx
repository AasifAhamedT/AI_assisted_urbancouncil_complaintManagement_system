import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { ApiError, apiRequest, messageFromError } from "../api/client";
import type { Complaint, ComplaintAttachment, ComplaintHistory, ComplaintLocation, ComplaintStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { LocationPicker, ReadOnlyLocationMap, type Coordinates } from "../components/ComplaintMap";
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatBytes, formatDate, humanize } from "../utils/format";

const transitions: Record<ComplaintStatus, ComplaintStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["IN_PROGRESS", "AWAITING_INFORMATION", "REJECTED"],
  AWAITING_INFORMATION: ["UNDER_REVIEW"],
  IN_PROGRESS: ["AWAITING_INFORMATION", "RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  REJECTED: ["CLOSED", "UNDER_REVIEW"],
  CLOSED: []
};

export const ComplaintDetailPage = () => {
  const { id = "" } = useParams();
  const routeLocation = useLocation();
  const { session } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<ComplaintHistory[]>([]);
  const [attachments, setAttachments] = useState<ComplaintAttachment[]>([]);
  const [savedLocation, setSavedLocation] = useState<ComplaintLocation | null>(null);
  const [locationEditing, setLocationEditing] = useState(false);
  const [locationDraft, setLocationDraft] = useState<Coordinates>();
  const [loading, setLoading] = useState(true);
  const routeState = routeLocation.state as { created?: boolean; locationWarning?: string } | null;
  const [error, setError] = useState("");
  const [locationWarning] = useState(routeState?.locationWarning ?? "");
  const [success, setSuccess] = useState(routeState?.created ? "Complaint submitted successfully." : "");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [statusForm, setStatusForm] = useState<{ status: ComplaintStatus | ""; reason: string }>({ status: "", reason: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [complaintResponse, historyResponse, attachmentResponse] = await Promise.all([
        apiRequest<{ data: { complaint: Complaint } }>({ url: `/api/v1/complaints/${id}` }),
        apiRequest<{ data: { history: ComplaintHistory[] } }>({ url: `/api/v1/complaints/${id}/history` }),
        apiRequest<{ data: { attachments: ComplaintAttachment[] } }>({ url: `/api/v1/complaints/${id}/attachments` })
      ]);
      setComplaint(complaintResponse.data.complaint);
      setEditForm({ title: complaintResponse.data.complaint.title, description: complaintResponse.data.complaint.description });
      setHistory(historyResponse.data.history);
      setAttachments(attachmentResponse.data.attachments);
      try {
        const locationResponse = await apiRequest<{ data: { location: ComplaintLocation } }>({ url: `/api/v1/gis/complaints/${id}/location` });
        setSavedLocation(locationResponse.data.location);
        setLocationDraft({ latitude: locationResponse.data.location.latitude, longitude: locationResponse.data.location.longitude });
      } catch (reason) {
        if (!(reason instanceof ApiError && reason.code === "LOCATION_NOT_FOUND")) throw reason;
        setSavedLocation(null);
      }
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const nextStatuses = useMemo(() => complaint ? transitions[complaint.status] : [], [complaint]);

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!complaint) return;
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ data: { complaint: Complaint } }>({
        method: "PATCH", url: `/api/v1/complaints/${id}`, data: { ...editForm, version: complaint.version }
      });
      setComplaint(response.data.complaint); setEditing(false); setSuccess("Complaint details updated.");
    } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); }
  };

  const changeStatus = async (event: FormEvent) => {
    event.preventDefault();
    if (!complaint || !statusForm.status) return;
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ data: { complaint: Complaint } }>({
        method: "PATCH",
        url: `/api/v1/complaints/${id}/status`,
        data: { status: statusForm.status, version: complaint.version, ...(statusForm.reason.trim() ? { reason: statusForm.reason.trim() } : {}) }
      });
      setComplaint(response.data.complaint); setStatusForm({ status: "", reason: "" }); setSuccess("Complaint status updated."); await load();
    } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); }
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("attachment") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) { setError("Choose a file before uploading."); return; }
    setBusy(true); setError("");
    try {
      await apiRequest({ method: "POST", url: `/api/v1/complaints/${id}/attachments`, data: file, headers: { "Content-Type": file.type, "X-Filename": file.name } });
      input.value = ""; setSuccess("Attachment uploaded and queued for security scanning."); await load();
    } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); }
  };

  const download = async (attachment: ComplaintAttachment) => {
    try {
      const blob = await apiRequest<Blob>({ url: `/api/v1/complaints/${id}/attachments/${attachment.id}/content`, responseType: "blob" });
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.originalFilename; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(messageFromError(reason)); }
  };

  const saveLocation = async () => {
    if (!locationDraft) { setError("Select a location on the map before saving."); return; }
    setBusy(true); setError("");
    try {
      const response = await apiRequest<{ data: { location: ComplaintLocation } }>({
        method: "PUT", url: `/api/v1/gis/complaints/${id}/location`, data: locationDraft
      });
      setSavedLocation(response.data.location); setLocationEditing(false); setSuccess("Complaint location saved.");
    } catch (reason) { setError(messageFromError(reason)); } finally { setBusy(false); }
  };

  if (!session) return null;
  if (loading) return <div className="page-wrap"><LoadingState label="Loading complaint" /></div>;
  if (!complaint) return <div className="page-wrap"><ErrorBanner message={error || "Complaint not found."} /></div>;
  const isCitizen = session.user.role === "CITIZEN";
  const canChangeStatus = session.user.role !== "CITIZEN" && nextStatuses.length > 0;
  const canEditLocation = session.user.role === "ADMINISTRATOR" || (isCitizen && complaint.status === "SUBMITTED");

  return (
    <div className="page-wrap">
      <PageHeader eyebrow={complaint.referenceNumber} title={complaint.title} description={`Submitted ${formatDate(complaint.submittedAt)}`} actions={<Link className="button button-secondary" to="/complaints">Back to complaints</Link>} />
      {locationWarning && <ErrorBanner message={locationWarning} />}{error && <ErrorBanner message={error} />}{success && <SuccessBanner message={success} />}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel complaint-detail-card">
            <div className="detail-status"><StatusBadge value={complaint.status} /><span className="priority">{humanize(complaint.priority)} priority</span><span>Version {complaint.version}</span></div>
            {editing ? <form onSubmit={saveEdit} className="inline-edit"><label>Title<input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} minLength={5} maxLength={200} required /></label><label>Description<textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} minLength={20} maxLength={20_000} rows={7} required /></label><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button button-primary" disabled={busy}>Save changes</button></div></form> : <><h2>Complaint description</h2><p className="complaint-description">{complaint.description}</p>{isCitizen && complaint.status === "SUBMITTED" && <button className="button button-secondary" onClick={() => setEditing(true)}>Edit submitted complaint</button>}</>}
            {complaint.classificationReviewRequired && <div className="future-inline warning-inline"><Icon name="alert" /><div><strong>Classification review required</strong><p>{complaint.classificationState === "PENDING" ? "AI classification is pending. The complaint remains safely stored." : "An Administrator must approve the final category. Any department assignment is controlled by the configured mapping."}</p>{session.user.role === "ADMINISTRATOR" && <Link to="/admin/classifications">Open AI review queue</Link>}</div></div>}
          </section>
          <section className="panel location-card">
            <div className="panel-heading"><div><p className="eyebrow">GIS location</p><h2>Issue location</h2></div>{canEditLocation && !locationEditing && <button className="button button-secondary button-small" onClick={() => setLocationEditing(true)}>{savedLocation ? "Correct location" : "Add location"}</button>}</div>
            {locationEditing ? <div className="location-editor"><LocationPicker value={locationDraft} onChange={setLocationDraft} /><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => { setLocationEditing(false); setLocationDraft(savedLocation ? { latitude: savedLocation.latitude, longitude: savedLocation.longitude } : undefined); }}>Cancel</button><button className="button button-primary" type="button" disabled={busy || !locationDraft} onClick={saveLocation}>Save location</button></div></div> : savedLocation ? <div className="saved-location"><ReadOnlyLocationMap coordinates={{ latitude: savedLocation.latitude, longitude: savedLocation.longitude }} /><p>{savedLocation.latitude.toFixed(6)}, {savedLocation.longitude.toFixed(6)}</p></div> : <EmptyState title="No location saved" description={canEditLocation ? "Add a map location to help identify the issue." : "The Citizen has not saved a map location for this complaint."} />}
          </section>
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Evidence</p><h2>Attachments</h2></div></div>
            {attachments.length === 0 ? <EmptyState title="No attachments" description={isCitizen ? "Add a supported image or PDF as evidence." : "The citizen has not uploaded evidence."} /> : <div className="attachment-list">{attachments.map((attachment) => <button key={attachment.id} onClick={() => download(attachment)}><span className="file-icon"><Icon name="upload" /></span><span><strong>{attachment.originalFilename}</strong><small>{formatBytes(attachment.sizeBytes)} · {humanize(attachment.scanStatus)}</small></span><Icon name="arrow" /></button>)}</div>}
            {isCitizen && <form className="upload-form" onSubmit={upload}><label>Upload evidence<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></label><button className="button button-secondary" disabled={busy}><Icon name="upload" /> Upload file</button><small>JPEG, PNG, WebP or PDF. Maximum 10 MB.</small></form>}
          </section>
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h2>Status history</h2></div></div>
            <ol className="timeline">{history.map((entry) => <li key={entry.id}><span className="timeline-dot" /><div><strong>{entry.previousStatus ? `${humanize(entry.previousStatus)} → ` : ""}{humanize(entry.newStatus)}</strong><time>{formatDate(entry.changedAt)}</time>{entry.reason && <p>{entry.reason}</p>}</div></li>)}</ol>
          </section>
        </div>
        <aside className="detail-side">
          <section className="panel facts-card"><p className="eyebrow">Case information</p><dl><div><dt>Reference</dt><dd>{complaint.referenceNumber}</dd></div><div><dt>Current status</dt><dd>{humanize(complaint.status)}</dd></div><div><dt>Classification</dt><dd>{humanize(complaint.classificationState)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(complaint.updatedAt)}</dd></div></dl></section>
          {canChangeStatus && <form className="panel status-form" onSubmit={changeStatus}><p className="eyebrow">Workflow action</p><h2>Update status</h2><label>Next status<select value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value as ComplaintStatus | "" })} required><option value="">Choose transition</option>{nextStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></label><label>Reason <span className="optional">Required for some actions</span><textarea rows={4} maxLength={1000} value={statusForm.reason} onChange={(event) => setStatusForm({ ...statusForm, reason: event.target.value })} /></label><button className="button button-primary button-wide" disabled={busy || !statusForm.status}>Update complaint</button></form>}
        </aside>
      </div>
    </div>
  );
};
