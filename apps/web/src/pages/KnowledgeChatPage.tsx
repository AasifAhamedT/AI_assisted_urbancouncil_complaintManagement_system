import { useState, type FormEvent } from "react";

import { apiRequest, messageFromError } from "../api/client";
import type { KnowledgeAnswer } from "../api/types";
import { ErrorBanner } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";

interface Exchange {
  question: string;
  result: KnowledgeAnswer;
}

export const KnowledgeChatPage = () => {
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (value.length < 3) return;
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<{ data: { result: KnowledgeAnswer } }>({
        url: "/api/v1/knowledge/query",
        method: "POST",
        data: { question: value }
      });
      setExchanges((current) => [...current, { question: value, result: response.data.result }]);
      setQuestion("");
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  };

  return <div className="page-wrap knowledge-page">
    <PageHeader eyebrow="Authorized Council knowledge" title="Ask the document guide" description="Answers are limited to active documents approved by an Administrator. Unsupported questions receive an explicit abstention." />
    <div className="knowledge-layout">
      <section className="panel chat-panel" aria-live="polite">
        {exchanges.length === 0 && <div className="chat-empty"><span><Icon name="chat" /></span><h2>Ask a public-information question</h2><p>For example, ask about a documented application process, service requirement, or published Council procedure.</p></div>}
        {exchanges.map((exchange, index) => <article className="chat-exchange" key={`${exchange.question}-${index}`}>
          <div className="chat-question"><small>Your question</small><p>{exchange.question}</p></div>
          <div className={`chat-answer ${exchange.result.abstained ? "chat-abstention" : ""}`}>
            <small>{exchange.result.abstained ? "Not supported by current documents" : "Grounded answer"}</small>
            <p>{exchange.result.answer}</p>
            {exchange.result.citations.length > 0 && <div className="citation-list"><strong>Sources</strong>{exchange.result.citations.map((citation, citationIndex) => <div className="citation-card" key={`${citation.documentId}-${citation.location}-${citationIndex}`}><span><Icon name="file" /></span><div><strong>{citation.documentTitle}</strong><small>Version {citation.version} · {citation.location}</small><p>{citation.excerpt}</p></div></div>)}</div>}
          </div>
        </article>)}
        {error && <ErrorBanner message={error} />}
        <form className="chat-form" onSubmit={ask}>
          <label>Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={1000} rows={3} placeholder="Ask only about public information documented by the Council…" required /></label>
          <button className="button button-primary" disabled={loading || question.trim().length < 3}>{loading ? "Checking sources…" : "Ask documents"}</button>
        </form>
      </section>
      <aside className="panel knowledge-safety"><span><Icon name="shield" /></span><div><p className="eyebrow">Privacy boundary</p><h2>No complaint lookup</h2><p>This guide cannot access complaint records, private messages, account details, or another citizen's information.</p><strong>For complaint progress, use My complaints.</strong></div></aside>
    </div>
  </div>;
};
