import { Link } from "react-router-dom";

export const NotFoundPage = () => <main className="not-found"><p className="eyebrow">404</p><h1>Page not found</h1><p>The page you requested does not exist or is not available for your role.</p><Link className="button button-primary" to="/dashboard">Return to dashboard</Link></main>;
