import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Cell,
} from 'recharts';
import {
  type Document,
  getDeadlines,
  createDeadline,
  deleteDeadline,
  getFinancialImpact,
  getRiskClauses,
  generateShareSummary,
  getScamScore,
  generateDraft,
  getDocumentComments,
  createDocumentComment,
  deleteDocumentComment,
  getDeadlinesIcalUrl,
  getDocumentContent,
  prepareNegotiation,
  getDocuments,
  matchPolicyWithContract,
  checkDocumentCompleteness,
  verifyDocument,
} from '../api/client';
import './DocumentFeaturesModal.css';

export type TabId = 'deadlines' | 'financial' | 'risky' | 'share' | 'scam' | 'drafts' | 'comments' | 'negotiation' | 'policy' | 'completeness' | 'verify';

interface DocumentFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  /** Open on this tab (e.g. from Features menu or feature runner). */
  initialTab?: TabId;
}

export default function DocumentFeaturesModal({ isOpen, onClose, document: doc, initialTab }: DocumentFeaturesModalProps) {
  const [tab, setTab] = useState<TabId>(initialTab ?? 'deadlines');
  useEffect(() => {
    if (isOpen && initialTab) setTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay doc-features-overlay" onClick={onClose}>
      <div className="modal-content doc-features-modal" onClick={e => e.stopPropagation()}>
        <div className="doc-features-header">
          <h2>Document features</h2>
          <p className="doc-features-filename">{doc.filename}</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="doc-features-tabs">
          {(['deadlines', 'financial', 'risky', 'share', 'scam', 'drafts', 'negotiation', 'comments', 'policy', 'completeness', 'verify'] as TabId[]).map((t) => (
            <button key={t} type="button" className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'deadlines' && '⏰ Deadlines'}
              {t === 'financial' && '💰 Financial'}
              {t === 'risky' && '🔴 Why Risky?'}
              {t === 'share' && '📤 Share'}
              {t === 'scam' && '🛡️ Scam'}
              {t === 'drafts' && '✉️ Drafts'}
              {t === 'negotiation' && '🤝 Negotiation'}
              {t === 'comments' && '💬 Comments'}
              {t === 'policy' && '📋 Policy Matcher'}
              {t === 'completeness' && '✅ Completeness'}
              {t === 'verify' && '🔍 Verify'}
            </button>
          ))}
        </div>
        <div className="doc-features-body">
          {tab === 'deadlines' && <DeadlinesTab documentId={doc.id} />}
          {tab === 'financial' && <FinancialTab documentId={doc.id} />}
          {tab === 'risky' && <RiskyTab documentId={doc.id} />}
          {tab === 'share' && <ShareTab documentId={doc.id} title={doc.filename} />}
          {tab === 'scam' && <ScamTab documentId={doc.id} />}
          {tab === 'drafts' && <DraftsTab documentId={doc.id} />}
          {tab === 'negotiation' && <NegotiationTab documentId={doc.id} />}
          {tab === 'comments' && <CommentsTab documentId={doc.id} />}
          {tab === 'policy' && <PolicyMatcherTab currentDocumentId={doc.id} currentFilename={doc.filename} />}
          {tab === 'completeness' && <CompletenessTab documentId={doc.id} filename={doc.filename} />}
          {tab === 'verify' && <VerifyTab documentId={doc.id} filename={doc.filename} />}
        </div>
      </div>
    </div>
  );
}

function DeadlinesTab({ documentId }: { documentId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');

  useEffect(() => {
    getDeadlines({ documentId }).then((r) => { setList(r.deadlines || []); setLoading(false); }).catch(() => setLoading(false));
  }, [documentId]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDue) return;
    try {
      await createDeadline({ documentId, title: newTitle.trim(), due_date: newDue });
      setNewTitle(''); setNewDue('');
      const r = await getDeadlines({ documentId });
      setList(r.deadlines || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDeadline(id);
      setList((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <p>Loading deadlines…</p>;
  return (
    <div className="tab-panel">
      <p className="tab-hint">Add reminders and export to calendar.</p>
      <div className="deadline-add">
        <input type="text" placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      <ul className="deadline-list">
        {list.map((d) => (
          <li key={d.id}>
            <span>{d.title} — {d.due_date}</span>
            <button type="button" onClick={() => handleDelete(d.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <a href={getDeadlinesIcalUrl()} target="_blank" rel="noopener noreferrer" className="export-ical">Export iCal</a>
    </div>
  );
}

function FinancialTab({ documentId }: { documentId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getFinancialImpact(documentId).then((r) => { setData(r.estimate); setLoading(false); }).catch(() => setLoading(false));
  }, [documentId]);

  if (loading) return <p>Estimating financial impact…</p>;
  if (!data) return <p>No estimate available.</p>;

  const barData: { name: string; value: number; fill: string }[] = [];
  if (data.taxPayable?.amount != null) barData.push({ name: 'Tax', value: data.taxPayable.amount, fill: '#3b82f6' });
  if (data.lateFees?.amount != null) barData.push({ name: 'Late fees', value: data.lateFees.amount, fill: '#f59e0b' });
  if (data.interest?.amount != null) barData.push({ name: 'Interest', value: data.interest.amount, fill: '#8b5cf6' });
  if (data.worstCaseExposure?.amount != null) barData.push({ name: 'Worst case', value: data.worstCaseExposure.amount, fill: '#dc2626' });

  return (
    <div className="tab-panel">
      <p className="summary">{data.summary}</p>
      {barData.length > 0 && (
        <div className="financial-impact-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v?.toLocaleString(), 'Amount']} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.taxPayable && <p>Tax: {data.taxPayable.description} {data.taxPayable.amount != null && `${data.taxPayable.currency} ${data.taxPayable.amount}`}</p>}
      {data.lateFees && <p>Late fees: {data.lateFees.description}</p>}
      {data.worstCaseExposure && <p>Worst case: {data.worstCaseExposure.description}</p>}
    </div>
  );
}

function RiskyTab({ documentId }: { documentId: string }) {
  const [clauses, setClauses] = useState<any[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getRiskClauses(documentId).then((r) => { setClauses(r.clauses || []); setSummary(r.summary || ''); setLoading(false); }).catch(() => setLoading(false));
  }, [documentId]);

  if (loading) return <p>Analyzing risk clauses…</p>;
  return (
    <div className="tab-panel">
      <p className="summary">{summary}</p>
      <ul className="risk-clauses-list">
        {clauses.map((c, i) => (
          <li key={i} className={`severity-${c.severity}`}>
            <span className="clause-text">{c.clauseText}</span>
            <span className="reason">{c.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShareTab({ documentId, title }: { documentId: string; title: string }) {
  const [result, setResult] = useState<{ title: string; summary: string; shareableText: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    generateShareSummary(documentId, title).then((r) => { setResult({ title: r.title, summary: r.summary, shareableText: r.shareableText }); setLoading(false); }).catch(() => setLoading(false));
  }, [documentId, title]);

  const copy = () => {
    if (result) navigator.clipboard.writeText(result.summary);
  };

  if (loading) return <p>Generating shareable summary…</p>;
  if (!result) return <p>Could not generate summary.</p>;
  return (
    <div className="tab-panel">
      <p className="tab-hint">Safe, redacted summary to share. No sensitive data.</p>
      <div className="share-summary-box">
        <p>{result.summary}</p>
        <button type="button" onClick={copy}>Copy summary</button>
      </div>
    </div>
  );
}

function ScamTab({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<{ scamProbability: number; signals: any[]; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getScamScore(documentId).then((r) => { setResult({ scamProbability: r.scamProbability, signals: r.signals || [], summary: r.summary }); setLoading(false); }).catch(() => setLoading(false));
  }, [documentId]);

  if (loading) return <p>Computing scam probability…</p>;
  if (!result) return <p>No result.</p>;

  const gaugeColor = result.scamProbability >= 70 ? '#dc2626' : result.scamProbability >= 40 ? '#f59e0b' : '#16a34a';
  const gaugeData = [{ name: 'Scam probability', value: result.scamProbability, fill: gaugeColor }];

  return (
    <div className="tab-panel">
      <div className="scam-gauge-wrap">
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            innerRadius="60%"
            outerRadius="100%"
            data={gaugeData}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar background dataKey="value" cornerRadius={8} />
            <Tooltip formatter={(v: number) => [`${v}%`, '']} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="scam-prob">Scam probability: <strong style={{ color: gaugeColor }}>{result.scamProbability}%</strong></p>
      </div>
      <p>{result.summary}</p>
      {result.signals.length > 0 && (
        <ul className="scam-signals-list">
          {result.signals.map((s, i) => (
            <li key={i} className={`signal-${(s.severity || '').toLowerCase()}`}><strong>{s.type}</strong>: {s.description} ({s.severity})</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftsTab({ documentId }: { documentId: string }) {
  const [type, setType] = useState<'legal_reply' | 'email_response' | 'appeal_draft'>('email_response');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await generateDraft(documentId, type);
      setDraft(r.draft);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => navigator.clipboard.writeText(draft);

  return (
    <div className="tab-panel">
      <p className="tab-hint">Generate a reply or draft. Review with a professional before sending.</p>
      <select value={type} onChange={(e) => setType(e.target.value as any)}>
        <option value="legal_reply">Legal reply</option>
        <option value="email_response">Email response</option>
        <option value="appeal_draft">Appeal draft</option>
      </select>
      <button type="button" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate draft'}</button>
      {draft && (
        <>
          <pre className="draft-text">{draft}</pre>
          <button type="button" onClick={copy}>Copy</button>
        </>
      )}
    </div>
  );
}

function NegotiationTab({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const contentRes = await getDocumentContent(documentId);
      const text = contentRes?.content || '';
      if (text.length < 100) {
        setResult({ error: 'Document content too short for negotiation prep (min 100 characters).' });
        return;
      }
      const r = await prepareNegotiation(text);
      setResult(r);
    } catch (e: any) {
      setResult({ error: e.message || 'Failed to prepare negotiation.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Preparing negotiation strategy…</p>;
  if (!result) {
    return (
      <div className="tab-panel">
        <p className="tab-hint">Get talking points, risk areas, and counter-proposals for this document.</p>
        <button type="button" onClick={run}>Prepare negotiation</button>
      </div>
    );
  }
  if (result.error) return <p className="error">{result.error}</p>;
  const cp = result.counterProposal;
  return (
    <div className="tab-panel">
      {cp?.negotiationPoints?.length > 0 && (
        <>
          <h4>Talking points</h4>
          <ul>{cp.negotiationPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
        </>
      )}
      {cp?.redLines?.length > 0 && (
        <>
          <h4>Red lines (do not accept)</h4>
          <ul>{cp.redLines.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
        </>
      )}
      {cp?.suggestedChanges?.length > 0 && (
        <>
          <h4>Suggested changes</h4>
          <ul>{cp.suggestedChanges.slice(0, 5).map((s: any, i: number) => <li key={i}>{s.originalTerm} → {s.suggestedChange} ({s.rationale})</li>)}</ul>
        </>
      )}
    </div>
  );
}

function CommentsTab({ documentId }: { documentId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => getDocumentComments(documentId).then((r) => { setComments(r.comments || []); setLoading(false); }).catch(() => setLoading(false));

  useEffect(() => { load(); }, [documentId]);

  const handleAdd = async () => {
    if (!content.trim()) return;
    try {
      await createDocumentComment(documentId, content.trim());
      setContent('');
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocumentComment(id);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <p>Loading comments…</p>;
  return (
    <div className="tab-panel">
      <div className="comments-add">
        <textarea placeholder="Add a note…" value={content} onChange={(e) => setContent(e.target.value)} rows={2} />
        <button type="button" onClick={handleAdd}>Add note</button>
      </div>
      <ul className="comments-list">
        {comments.map((c) => (
          <li key={c.id}>
            <p>{c.content}</p>
            <small>{new Date(c.created_at).toLocaleString()}</small>
            <button type="button" onClick={() => handleDelete(c.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PolicyMatcherTab({ currentDocumentId }: { currentDocumentId: string; currentFilename: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [policyDocId, setPolicyDocId] = useState(currentDocumentId);
  const [contractDocId, setContractDocId] = useState('');
  const [result, setResult] = useState<{
    policyViolations: Array<{ policyRule: string; contractClause: string; severity: string; description: string }>;
    missingClauses: Array<{ requiredByPolicy: string; suggestion: string; priority: string }>;
    summary: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocuments().then((r) => {
      setDocuments(r.documents ?? []);
      if (!contractDocId && (r.documents ?? []).length > 0) {
        const other = (r.documents ?? []).find((d) => d.id !== currentDocumentId);
        if (other) setContractDocId(other.id);
      }
      setLoadingDocs(false);
    }).catch(() => setLoadingDocs(false));
  }, [currentDocumentId]);

  const runMatch = async () => {
    if (!policyDocId || !contractDocId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await matchPolicyWithContract(policyDocId, contractDocId);
      setResult({
        policyViolations: r.policyViolations ?? [],
        missingClauses: r.missingClauses ?? [],
        summary: r.summary ?? '',
      });
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Policy match failed');
    } finally {
      setLoading(false);
    }
  };

  if (loadingDocs) return <p>Loading documents…</p>;
  return (
    <div className="tab-panel">
      <p className="tab-hint">Compare a policy document with a contract. Flag violations and missing clauses.</p>
      <div className="policy-matcher-fields">
        <label>
          Policy document
          <select value={policyDocId} onChange={(e) => setPolicyDocId(e.target.value)}>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>
        </label>
        <label>
          Contract document
          <select value={contractDocId} onChange={(e) => setContractDocId(e.target.value)}>
            <option value="">Select…</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={runMatch} disabled={loading || !policyDocId || !contractDocId || policyDocId === contractDocId}>
          {loading ? 'Comparing…' : 'Compare policy vs contract'}
        </button>
      </div>
      {policyDocId && contractDocId && policyDocId === contractDocId && (
        <p className="tab-hint" style={{ color: 'var(--risk-warning, #f59e0b)' }}>Policy and contract must be different documents.</p>
      )}
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="policy-matcher-result">
          <p className="summary">{result.summary}</p>
          {result.policyViolations.length > 0 && (
            <>
              <h4>Policy violations</h4>
              <ul className="risk-clauses-list">
                {result.policyViolations.map((v, i) => (
                  <li key={i} className={`severity-${(v.severity || '').toLowerCase()}`}>
                    <strong>{v.policyRule}</strong> — {v.description}
                    {v.contractClause && <span className="clause-text"> Contract: {v.contractClause}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.missingClauses.length > 0 && (
            <>
              <h4>Missing clauses</h4>
              <ul>
                {result.missingClauses.map((m, i) => (
                  <li key={i}><strong>{m.requiredByPolicy}</strong> — {m.suggestion} (Priority: {m.priority})</li>
                ))}
              </ul>
            </>
          )}
          {result.policyViolations.length === 0 && result.missingClauses.length === 0 && (
            <p>No violations or missing clauses identified.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CompletenessTab({ documentId }: { documentId: string; filename: string }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{
    completenessScore: number;
    overallStatus: string;
    missingElements: Array<{ item?: string; description?: string; category?: string }>;
    summary: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const r = await checkDocumentCompleteness({ documentId });
      setAnalysis(r.analysis ?? null);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Completeness check failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete': case 'Mostly Complete': return '#16a34a';
      case 'Incomplete': return '#f59e0b';
      case 'Very Incomplete': return '#dc2626';
      default: return '#64748b';
    }
  };

  return (
    <div className="tab-panel">
      <p className="tab-hint">Check if the document has all required elements (signatures, dates, clauses, etc.).</p>
      <button type="button" onClick={runCheck} disabled={loading}>{loading ? 'Checking…' : 'Check completeness'}</button>
      {error && <p className="error">{error}</p>}
      {analysis && (
        <div className="completeness-inline-result">
          <div className="completeness-score-box" style={{ borderColor: getStatusColor(analysis.overallStatus) }}>
            <span className="score-value">{analysis.completenessScore}</span>
            <span className="score-label">/ 100</span>
            <span className="status-badge" style={{ background: getStatusColor(analysis.overallStatus), color: '#fff' }}>{analysis.overallStatus}</span>
          </div>
          <p>{analysis.summary}</p>
          {analysis.missingElements && analysis.missingElements.length > 0 && (
            <ul>
              {analysis.missingElements.map((m, i) => (
                <li key={i}>{m.item || m.description || m.category || 'Missing element'}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function VerifyTab({ documentId }: { documentId: string; filename: string }) {
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<{
    status: string;
    checks: Record<string, { passed: boolean; score: number; details: string }>;
    recommendations: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerify = async () => {
    setLoading(true);
    setError(null);
    setVerification(null);
    try {
      const r = await verifyDocument(documentId);
      setVerification(r.verification ?? null);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Verified') return '#16a34a';
    if (status === 'Fraudulent' || status === 'Invalid') return '#dc2626';
    if (status === 'Suspicious') return '#f59e0b';
    return '#64748b';
  };

  return (
    <div className="tab-panel">
      <p className="tab-hint">Verify document authenticity and integrity (tampering, signatures, consistency).</p>
      <button type="button" onClick={runVerify} disabled={loading}>{loading ? 'Verifying…' : 'Verify document'}</button>
      {error && <p className="error">{error}</p>}
      {verification && (
        <div className="verify-inline-result">
          <div className="verify-status-box" style={{ borderColor: getStatusColor(verification.status) }}>
            <span className="status-badge" style={{ background: getStatusColor(verification.status), color: '#fff' }}>{verification.status}</span>
          </div>
          {verification.checks && typeof verification.checks === 'object' && (
            <ul className="verify-checks-list">
              {Object.entries(verification.checks).map(([name, c]) => (
                <li key={name} className={c.passed ? 'passed' : 'failed'}>
                  {c.passed ? '✓' : '✗'} {name} {c.details && <span>{c.details}</span>}
                </li>
              ))}
            </ul>
          )}
          {verification.recommendations && verification.recommendations.length > 0 && (
            <ul>
              {verification.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

