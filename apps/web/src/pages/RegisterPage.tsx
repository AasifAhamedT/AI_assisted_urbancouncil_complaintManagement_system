import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type { User } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";

export const RegisterPage = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: "", email: "", phoneNumber: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest<{ data: { user: User } }>({
        method: "POST",
        url: "/api/v1/auth/register",
        data: { ...form, phoneNumber: form.phoneNumber || undefined }
      });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-register">
      <section className="auth-story">
        <div className="auth-brand"><span><Icon name="building" /></span> Citizen self-service</div>
        <div><p className="eyebrow">Start with an account</p><h1>Your neighbourhood.<br />Your voice.</h1><p className="auth-lead">Submit concerns with evidence and return at any time to follow Council progress.</p></div>
        <div className="trust-row"><span><Icon name="shield" /> Complaints remain private</span><span><Icon name="check" /> Clear progress updates</span></div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-auth-brand"><Icon name="building" /> Urban Council Portal</div>
          <p className="eyebrow">Citizen registration</p><h2>Create your account</h2><p className="muted">Department and Administrator accounts are created only by authorized administrators.</p>
          {error && <ErrorBanner message={error} />}
          <label>Full name<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required minLength={2} maxLength={150} autoComplete="name" /></label>
          <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" /></label>
          <label>Phone number <span className="optional">Optional</span><input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} maxLength={30} autoComplete="tel" placeholder="+94…" /></label>
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={12} maxLength={128} autoComplete="new-password" /><small>At least 12 characters with uppercase, lowercase, and a number.</small></label>
          <button className="button button-primary button-wide" disabled={submitting}>{submitting ? "Creating account…" : "Create citizen account"}</button>
          <p className="form-footer">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </section>
    </main>
  );
};
