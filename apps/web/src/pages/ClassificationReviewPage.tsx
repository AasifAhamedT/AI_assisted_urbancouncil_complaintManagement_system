import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiRequest, messageFromError } from "../api/client";
import type { Category, ClassificationQueueItem, Pagination } from "../api/types";
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, humanize } from "../utils/format";

export const ClassificationReviewPage = () => {
  const [items, setItems] = useState<ClassificationQueueItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const requiresReason = Boolean(selected && (
    selected.recommendation?.validationStatus !== "VALID" ||
    selected.recommendation.recommendedCategoryId !== categoryId
  ));

  const selectItem = (item: ClassificationQueueItem) => {
    setSelectedId(item.id);
    setCategoryId(item.recommendation?.recommendedCategoryId ?? item.categoryId ?? "");
    setReason("");
    setError("");
    setSuccess("");
  };

  const load = async (preferredId?: string) => {
    setLoading(true); setError("");
    try {
      const [queueResponse, categoryResponse] = await Promise.all([
        apiRequest<{ data: { items: ClassificationQueueItem[]; pagination: Pagination } }>({ url: "/api/v1/admin/classifications?page=1&pageSize=100" }),
        apiRequest<{ data: { categories: Category[] } }>({ url: "/api/v1/complaints/categories" })
      ]);
      const nextItems = queueResponse.data.items;
      setItems(nextItems);
      setCategories(categoryResponse.data.categories);
      const next = nextItems.find((item) => item.id === preferredId) ?? nextItems[0];
      if (next) selectItem(next); else setSelectedId("");
    } catch (reasonValue) { setError(messageFromError(reasonValue)); } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const retry = async () => {
    if (!selected) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await apiRequest({ method: "POST", url: `/api/v1/admin/classifications/${selected.id}/retry` });
      await load(selected.id);
      setSuccess("Classification was processed again. Review the latest result below.");
    } catch (reasonValue) { setError(messageFromError(reasonValue)); } finally { setBusy(false); }
  };

  const review = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !categoryId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await apiRequest({
        method: "POST",
        url: `/api/v1/admin/classifications/${selected.id}/review`,
        data: { categoryId, version: selected.version, ...(reason.trim() ? { reason: reason.trim() } : {}) }
      });
      await load();
      setSuccess("Final classification approved and routed through the configured mapping.");
    } catch (reasonValue) { setError(messageFromError(reasonValue)); } finally { setBusy(false); }
  };

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Administrator" title="AI classification review" description="Review advisory model recommendations before they become the accountable final classification. Department routing always comes from Council configuration." />
      {error && <ErrorBanner message={error} />}{success && <SuccessBanner message={success} />}
      {loading ? <LoadingState label="Loading classification queue" /> : items.length === 0 ? <section className="panel"><EmptyState title="Review queue is clear" description="There are no complaints awaiting a classification decision." /></section> : <div className="classification-layout">
        <section className="panel classification-queue">
          <div className="panel-heading"><div><p className="eyebrow">Human review required</p><h2>{items.length} complaint{items.length === 1 ? "" : "s"}</h2></div></div>
          <div className="classification-list">{items.map((item) => <button className={item.id === selectedId ? "selected" : ""} key={item.id} onClick={() => selectItem(item)}><span><small>{item.referenceNumber}</small><strong>{item.title}</strong><em>{formatDate(item.createdAt)}</em></span><StatusBadge value={item.classificationState} /></button>)}</div>
        </section>
        {selected && <section className="panel classification-review-card">
          <div className="classification-card-heading"><div><p className="eyebrow">Original recommendation</p><h2>{selected.title}</h2></div><Link to={`/complaints/${selected.id}`} className="button button-secondary button-small">Open complaint</Link></div>
          {selected.recommendation ? <div className="recommendation-box">
            <div className="recommendation-status"><StatusBadge value={selected.recommendation.validationStatus} />{selected.recommendation.isAmbiguous && <span><Icon name="alert" /> Ambiguous</span>}</div>
            {selected.recommendation.validationStatus === "VALID" ? <><h3>{categoryNames.get(selected.recommendation.recommendedCategoryId ?? "") ?? "Unknown category"}</h3><p>{selected.recommendation.explanation}</p>{selected.recommendation.confidence !== null && <div className="confidence-note"><strong>{Math.round(selected.recommendation.confidence * 100)}%</strong><span>Uncalibrated model estimate—not a measured accuracy probability.</span></div>}</> : <div className="provider-failure"><Icon name="alert" /><div><strong>Safe manual-review fallback</strong><p>{selected.recommendation.failureCode ? humanize(selected.recommendation.failureCode) : "The provider result was not usable."}</p></div></div>}
            <dl><div><dt>Provider</dt><dd>{selected.recommendation.provider}</dd></div><div><dt>Model</dt><dd>{selected.recommendation.modelName}</dd></div><div><dt>Prompt</dt><dd>{selected.recommendation.promptVersion}</dd></div></dl>
          </div> : <div className="provider-failure"><Icon name="alert" /><div><strong>No recommendation stored yet</strong><p>Process the complaint again or make a documented manual decision.</p></div></div>}
          <form onSubmit={review} className="classification-form">
            <label>Final active category<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small>The backend resolves the responsible department from the active mapping.</small></label>
            <label>Decision reason {requiresReason ? <span className="required-note">Required</span> : <span className="optional">Optional for approval</span>}<textarea rows={4} minLength={requiresReason ? 5 : undefined} maxLength={1000} required={requiresReason} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this category is the accountable final decision." /></label>
            <div className="classification-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={retry}>Process again</button><button className="button button-primary" disabled={busy || !categoryId}>{busy ? "Saving…" : requiresReason ? "Override and route" : "Approve and route"}</button></div>
          </form>
        </section>}
      </div>}
    </div>
  );
};
