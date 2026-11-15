import { Icon } from "./Icon";

export const LoadingState = ({ label = "Loading" }: { label?: string }) => (
  <div className="loading-state" role="status"><span className="spinner" />{label}…</div>
);

export const ErrorBanner = ({ message }: { message: string }) => (
  <div className="alert alert-error" role="alert"><Icon name="alert" /> <span>{message}</span></div>
);

export const SuccessBanner = ({ message }: { message: string }) => (
  <div className="alert alert-success" role="status"><Icon name="check" /> <span>{message}</span></div>
);

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="empty-state">
    <span className="empty-icon"><Icon name="complaints" /></span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);
