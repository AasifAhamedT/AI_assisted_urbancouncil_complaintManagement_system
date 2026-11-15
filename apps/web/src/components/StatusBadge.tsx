import { humanize } from "../utils/format";

export const StatusBadge = ({ value }: { value: string }) => (
  <span className={`status-badge status-${value.toLowerCase()}`}>{humanize(value)}</span>
);
