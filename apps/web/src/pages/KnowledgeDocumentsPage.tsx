import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest, messageFromError } from "../api/client";
import type { KnowledgeDocument } from "../api/types";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../utils/format";

export const KnowledgeDocumentsPage = () => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<{ data: { documents: KnowledgeDocument[] } }>({ url: "/api/v1/knowledge/documents" });
      setDocuments(response.data.documents);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectTarget = (value: string) => {
    setDocumentId(value);
    if (value) setTitle(documents.find((item) => item.id === value)?.title ?? "");
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const path = documentId
        ? `/api/v1/knowledge/documents/${documentId}/versions`
        : "/api/v1/knowledge/documents";
      await apiRequest({
        url: path,
        method: "POST",
        params: { title: title.trim(), ...(versionNote.trim() ? { versionNote: versionNote.trim() } : {}) },
        headers: { "Content-Type": file.type, "X-Filename": file.name },
        data: file
      });
      setTitle(""); setVersionNote(""); setDocumentId(""); setFile(null);
      const input = window.document.getElementById("knowledge-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (document: KnowledgeDocument) => {
    if (!window.confirm(`Deactivate “${document.title}”? It will no longer support new answers.`)) return;
    setError("");
    try {
      await apiRequest({ url: `/api/v1/knowledge/documents/${document.id}/deactivate`, method: "POST" });
      await load();
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  };

  return <div className="page-wrap">
    <PageHeader eyebrow="Administrator · Knowledge governance" title="Authorized documents" description="Only reviewed public-information documents should be activated. New versions replace retrieval content while preserving traceable version history." />
    {error && <ErrorBanner message={error} />}
    <div className="knowledge-admin-layout">
      <form className="panel form-panel knowledge-upload" onSubmit={upload}>
        <div className="form-section-heading"><span><Icon name="upload" /></span><div><h2>Ingest an approved document</h2><p>PDF, DOCX, or UTF-8 text · maximum 10 MB</p></div></div>
        <label>Document target<select value={documentId} onChange={(event) => selectTarget(event.target.value)}><option value="">Create a new document</option>{documents.map((item) => <option value={item.id} key={item.id}>New version of: {item.title}</option>)}</select></label>
        <label>Public document title<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={200} required /></label>
        <label>Version note (optional)<textarea value={versionNote} onChange={(event) => setVersionNote(event.target.value)} maxLength={500} rows={3} /></label>
        <label>Approved source file<input id="knowledge-file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>
        <p className="form-help">Do not upload complaint records, personal data, draft policy, or unconfirmed Council procedures.</p>
        <button className="button button-primary" disabled={saving || !file}>{saving ? "Extracting and indexing…" : documentId ? "Create new version" : "Ingest document"}</button>
      </form>
      <section className="panel knowledge-document-panel">
        <div className="panel-heading"><div><p className="eyebrow">Retrieval inventory</p><h2>{documents.length} document{documents.length === 1 ? "" : "s"}</h2></div><button className="button button-secondary button-small" onClick={() => void load()}>Refresh</button></div>
        {loading ? <LoadingState label="Loading documents" /> : documents.length === 0 ? <EmptyState title="No authorized documents" description="Ingest an approved public-information document to begin." /> : <div className="knowledge-document-list">{documents.map((document) => {
          const latest = document.versions.at(-1);
          return <article key={document.id}><div className="knowledge-document-heading"><span><Icon name="file" /></span><div><h3>{document.title}</h3><small>Updated {formatDate(document.updatedAt)}</small></div><StatusBadge value={document.isActive ? "ACTIVE" : "INACTIVE"} /></div><dl><div><dt>Active version</dt><dd>{document.currentVersion ?? "None"}</dd></div><div><dt>Latest ingestion</dt><dd>{latest?.status ?? "Unknown"}</dd></div><div><dt>Chunks</dt><dd>{latest?.chunkCount ?? 0}</dd></div></dl><details><summary>Version history</summary>{[...document.versions].reverse().map((version) => <div className="knowledge-version" key={version.version}><strong>Version {version.version} · {version.status}</strong><span>{version.originalFilename} · {formatDate(version.createdAt)}</span>{version.versionNote && <p>{version.versionNote}</p>}{version.failureCode && <p>Failure: {version.failureCode}</p>}</div>)}</details>{document.isActive && <button className="button button-danger button-small" onClick={() => void deactivate(document)}>Deactivate</button>}</article>;
        })}</div>}
      </section>
    </div>
  </div>;
};
