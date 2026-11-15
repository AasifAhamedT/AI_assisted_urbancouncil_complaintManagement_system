import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type { Category, Complaint } from "../api/types";
import { LocationPicker, type Coordinates } from "../components/ComplaintMap";
import { ErrorBanner } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";

export const NewComplaintPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ title: "", description: "", categoryId: "" });
  const [coordinates, setCoordinates] = useState<Coordinates>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<{ data: { categories: Category[] } }>({ url: "/api/v1/complaints/categories" })
      .then((response) => setCategories(response.data.categories))
      .catch((reason) => setError(messageFromError(reason)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await apiRequest<{ data: { complaint: Complaint } }>({
        method: "POST",
        url: "/api/v1/complaints",
        data: { title: form.title, description: form.description, ...(form.categoryId ? { categoryId: form.categoryId } : {}) }
      });
      let locationWarning = "";
      if (coordinates) {
        try {
          await apiRequest({
            method: "PUT",
            url: `/api/v1/gis/complaints/${response.data.complaint.id}/location`,
            data: coordinates
          });
        } catch (reason) {
          locationWarning = `The complaint was saved, but its map location was not saved: ${messageFromError(reason)}`;
        }
      }
      navigate(`/complaints/${response.data.complaint.id}`, {
        replace: true,
        state: { created: true, ...(locationWarning ? { locationWarning } : {}) }
      });
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrap narrow-page">
      <PageHeader eyebrow="Citizen service" title="Report a local issue" description="Describe the concern clearly. Your complaint is saved before any optional future AI processing." actions={<Link to="/complaints" className="button button-secondary">Cancel</Link>} />
      {error && <ErrorBanner message={error} />}
      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-section-heading"><span>1</span><div><h2>Complaint details</h2><p>Provide enough detail for the responsible department to understand the issue.</p></div></div>
        <label>Short title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required minLength={5} maxLength={200} placeholder="Example: Blocked drain near Main Street" /><small>{form.title.length}/200 characters</small></label>
        <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required minLength={20} maxLength={20_000} rows={7} placeholder="Where is the issue, how long has it existed, and what impact is it causing?" /><small>{form.description.length}/20,000 characters</small></label>
        <label>Category <span className="optional">Optional</span><select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Council review required</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><small>The backend uses the approved category mapping to select a department.</small></label>
        <div className="form-section-heading"><span>2</span><div><h2>Issue location <span className="optional">Optional</span></h2><p>Select and confirm the complaint location. Your complaint is saved first so a map failure cannot lose the report.</p></div></div>
        <LocationPicker value={coordinates} onChange={setCoordinates} />
        <div className="form-actions"><Link to="/complaints" className="button button-secondary">Cancel</Link><button className="button button-primary" disabled={submitting}>{submitting ? "Submitting…" : "Submit complaint"}</button></div>
      </form>
    </div>
  );
};
