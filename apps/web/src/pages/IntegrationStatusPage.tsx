import { useCallback, useEffect, useState } from "react";

import { apiRequest, messageFromError } from "../api/client";
import type { IntegrationHealth } from "../api/types";
import { ErrorBanner, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export const IntegrationStatusPage = () => {
  const [data, setData] = useState<{ status: string; integrations: IntegrationHealth[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await apiRequest<{ data: { status: string; integrations: IntegrationHealth[] } }>({ url: "/api/v1/system/integrations" }); setData(response.data); }
    catch (reason) { setError(messageFromError(reason)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <div className="page-wrap"><PageHeader eyebrow="Administrator" title="System services" description="Check the gateway's connection to internal AI and knowledge services without exposing private configuration." actions={<button className="button button-secondary" onClick={load}>Refresh status</button>} />{error && <ErrorBanner message={error} />}{loading ? <LoadingState label="Checking integrations" /> : data && <><section className="integration-summary"><span className={`service-pulse ${data.status}`}><Icon name="integrations" /></span><div><p className="eyebrow">Overall readiness</p><h2>{data.status.replaceAll("_", " ")}</h2><p>Core complaint services remain available even when optional providers are not configured.</p></div></section><section className="service-grid">{data.integrations.map((service) => <article className="panel service-card" key={service.service}><div className="service-heading"><span><Icon name={service.service === "rag" ? "future" : "integrations"} /></span><StatusBadge value={service.readiness} /></div><h2>{service.service === "rag" ? "Knowledge & RAG" : "AI classification"}</h2><p>{service.reachable ? "The gateway can reach this internal service." : "This internal service is currently unavailable."}</p><dl><div><dt>Reachable</dt><dd>{service.reachable ? "Yes" : "No"}</dd></div><div><dt>Provider configured</dt><dd>{service.providerConfigured === null ? "Unknown" : service.providerConfigured ? "Yes" : "Not yet"}</dd></div><div><dt>Response time</dt><dd>{service.latencyMs} ms</dd></div></dl></article>)}</section></>}</div>;
};
