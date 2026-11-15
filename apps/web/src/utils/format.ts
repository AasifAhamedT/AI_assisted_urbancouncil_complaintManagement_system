export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo"
  }).format(new Date(value));

export const formatBytes = (value: number): string => {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
};

export const humanize = (value: string): string =>
  value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
