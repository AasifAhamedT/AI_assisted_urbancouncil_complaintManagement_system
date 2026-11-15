import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { messageFromError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";

export const LoginPage = () => {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      const requested = (location.state as { from?: string } | null)?.from;
      navigate(requested && requested !== "/login" ? requested : "/dashboard", { replace: true });
    } catch (reason) {
      setError(messageFromError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span><Icon name="building" /></span> Kinniya Urban Council context</div>
        <div>
          <p className="eyebrow">One place for civic concerns</p>
          <h1>Report local issues.<br />Follow every response.</h1>
          <p className="auth-lead">A transparent complaint portal for citizens, council departments, and administrators.</p>
        </div>
        <div className="trust-row">
          <span><Icon name="shield" /> Role-protected access</span>
          <span><Icon name="check" /> Traceable status history</span>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-auth-brand"><Icon name="building" /> Urban Council Portal</div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your account</h2>
          <p className="muted">Use the account provided for your role.</p>
          {error && <ErrorBanner message={error} />}
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} /></label>
          <button className="button button-primary button-wide" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
          <p className="form-footer">New citizen? <Link to="/register">Create an account</Link></p>
        </form>
        <p className="legal-note">Academic project prototype · Not an official deployed Council service</p>
      </section>
    </main>
  );
};
