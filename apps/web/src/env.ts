const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required.");
}

try {
  new URL(apiBaseUrl);
} catch {
  throw new Error("VITE_API_BASE_URL must be a valid absolute URL.");
}

export const webEnv = Object.freeze({
  apiBaseUrl,
  appName:
    import.meta.env.VITE_APP_NAME ??
    "Smart Urban Council Complaint Management System"
});

