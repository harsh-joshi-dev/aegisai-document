import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getFinanceToolsList,
  runFinanceTool,
  type FinanceToolId,
  type FinanceToolMeta,
  type FinanceToolResult,
  type Document,
} from '../api/client';
import FinanceToolResultView from './FinanceToolResultView';
import './FinanceToolsModal.css';

const TOOL_DESCRIPTIONS: Record<string, { short: string; why: string }> = {
  'bank-credit-card-statements': {
    short: 'Upload bank + credit card statements → totals, income vs expense, categories, trends. Chat & more.',
    why: 'Full end-to-end analysis with charts.',
  },
  'tax-threshold-monitor': {
    short: 'Bank statements → total credits, income vs GST/IT limits. Flags when nearing or crossing.',
    why: 'Avoid unknowingly crossing tax limits and penalties.',
  },
  'real-time-tax-liability-estimator': {
    short: 'Bank credits + bills → current tax payable, expected at year end, remaining liability.',
    why: 'Visibility into upcoming tax burden.',
  },
  'tax-liability-calculator': {
    short: 'GST bills, tax notices, invoices → total payable, penalty risk, due dates.',
    why: 'Perfect for SMEs, accountants, founders.',
  },
  'investment-suggestions': {
    short: 'Tax exposure → 80C/80D options, amount to invest, safe vs aggressive.',
    why: 'Smart tax planning, not last-minute.',
  },
  'income-source-classification': {
    short: 'Detect Salary, Business, Freelance, Rental, Other and tag transactions.',
    why: 'Correct tax category and avoid misreporting.',
  },
  'gst-registration-eligibility': {
    short: 'Income + invoices → GST required? Month to cross threshold. Alerts in advance.',
    why: 'Avoid late GST registration penalties.',
  },
  'expense-contract-mismatch': {
    short: 'Contract + invoices → overbilling, unauthorized charges, rate mismatch.',
    why: 'Companies lose money silently.',
  },
  'vendor-payment-reconciliation': {
    short: 'Vendor bills + bank statements → Paid / Unpaid / Partial / Discrepancies.',
    why: 'Eliminates painful manual reconciliation.',
  },
  'subscription-recurring-tracker': {
    short: 'SaaS bills, AMC contracts → renewal dates, auto-renew traps, cost increase.',
    why: 'CFO-level visibility.',
  },
  'penalty-late-fee-predictor': {
    short: 'Bills & notices → possible penalties, interest accumulation.',
    why: 'Avoid surprises.',
  },
  'multi-bill-summary-report': {
    short: 'One-click: total amount, risk exposure, deadlines. Export PDF.',
    why: 'Board-ready summaries.',
  },
  'fraud-duplicate-detection': {
    short: 'Multiple bills → duplicate invoices, altered amounts, suspicious vendors.',
    why: 'Direct money saving.',
  },
  'cost-trend-anomaly': {
    short: 'Monthly expenses, vendor trends → sudden spikes, abnormal billing.',
    why: 'CFO-grade anomaly detection.',
  },
  'settlement-negotiation-suggestions': {
    short: 'Negotiation points, payment restructuring, legal pushback clauses.',
    why: 'Moves from analysis to action.',
  },
  'bill-accounting-entry-generator': {
    short: 'Bills → journal entries, Tally / Zoho / QuickBooks format.',
    why: 'Huge time saver.',
  },
};

interface FinanceToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Document[];
  preselectedDocumentIds?: string[];
  /** When opening, preselect this tool (e.g. Bank & Credit Card Statements from Upload page). */
  initialToolId?: FinanceToolId;
}

export default function FinanceToolsModal({
  isOpen,
  onClose,
  documents,
  preselectedDocumentIds = [],
  initialToolId,
}: FinanceToolsModalProps) {
  const [tools, setTools] = useState<FinanceToolMeta[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(preselectedDocumentIds);
  const [selectedToolId, setSelectedToolId] = useState<FinanceToolId | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinanceToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResultView, setShowResultView] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDocumentIds((prev) =>
        preselectedDocumentIds.length > 0 ? preselectedDocumentIds : prev
      );
      if (initialToolId) setSelectedToolId(initialToolId);
      setResult(null);
      setError(null);
    }
  }, [isOpen, preselectedDocumentIds, initialToolId]);

  useEffect(() => {
    if (!isOpen) return;
    getFinanceToolsList()
      .then((res) => setTools(res.tools))
      .catch(() => setTools([]));
  }, [isOpen]);

  const toggleDocument = (id: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRun = async () => {
    if (!selectedToolId || selectedDocumentIds.length === 0) {
      setError('Select at least one document and a tool.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runFinanceTool(selectedToolId, selectedDocumentIds);
      setResult(res.result);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to run tool';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = `
      <!DOCTYPE html>
      <html><head><title>${result.title}</title></head>
      <body style="font-family: system-ui; padding: 2rem; max-width: 800px;">
        <h1>${result.title}</h1>
        <p>${result.summary}</p>
        ${result.sections
          .map(
            (s) => `
          <h2>${s.heading}</h2>
          <p>${s.content}</p>
          ${s.items?.length ? `<ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>` : ''}`
          )
          .join('')}
      </body></html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  if (!isOpen) return null;

  return (
    <div className="finance-tools-overlay" onClick={onClose}>
      <div className="finance-tools-modal" onClick={(e) => e.stopPropagation()}>
        <div className="finance-tools-header">
          <h2>Finance & Tax Tools</h2>
          <button type="button" className="finance-tools-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="finance-tools-body">
          <div className="finance-tools-docs">
            <h3>Select documents</h3>
            <p className="finance-tools-hint">Use these documents for the chosen tool (batch or folder).</p>
            <div className="finance-tools-doc-list">
              {documents.length === 0 ? (
                <p className="finance-tools-empty">No documents. Upload bills or contracts first.</p>
              ) : (
                documents.slice(0, 50).map((doc) => (
                  <label key={doc.id} className="finance-tools-doc-chip">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                    />
                    <span>{doc.filename}</span>
                  </label>
                ))
              )}
            </div>
            {documents.length > 50 && (
              <p className="finance-tools-hint">Showing first 50. Filter by folder to reduce list.</p>
            )}
          </div>

          <div className="finance-tools-tools-wrap">
            <h3>Choose a tool</h3>
            <div className="finance-tools-grid">
            {tools.map((tool) => {
              const desc = TOOL_DESCRIPTIONS[tool.id];
              const isSelected = selectedToolId === tool.id;
              const hasResultForThisTool = result?.toolId === tool.id;
              return (
                <div
                  key={tool.id}
                  className={`finance-tool-card-wrap ${isSelected ? 'selected' : ''}`}
                >
                  <button
                    type="button"
                    className={`finance-tool-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedToolId(tool.id as FinanceToolId)}
                  >
                    <span className="finance-tool-title">{tool.title}</span>
                    {desc && (
                      <>
                        <span className="finance-tool-short">{desc.short}</span>
                        <span className="finance-tool-why">{desc.why}</span>
                      </>
                    )}
                  </button>
                  {hasResultForThisTool && (
                    <button
                      type="button"
                      className="finance-tool-card-show-result"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowResultView(true);
                      }}
                    >
                      Show Result
                    </button>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          <div className="finance-tools-actions">
            <button
              type="button"
              className="finance-tools-run-btn"
              onClick={handleRun}
              disabled={loading || selectedDocumentIds.length === 0 || !selectedToolId}
            >
              {loading ? 'Running…' : 'Run tool'}
            </button>
          </div>

          {error && (
            <div className="finance-tools-error">
              {error}
            </div>
          )}

          {result && (
            <div className="finance-tools-result">
              <div className="finance-tools-result-header">
                <h3>{result.title}</h3>
                <div className="finance-tools-result-header-btns">
                  <button
                    type="button"
                    className="finance-tools-show-result-btn"
                    onClick={() => setShowResultView(true)}
                  >
                    Show Result
                  </button>
                  {(result.toolId === 'multi-bill-summary-report' || result.sections?.length) && (
                    <button type="button" className="finance-tools-export-pdf" onClick={handleExportPdf}>
                      Export PDF
                    </button>
                  )}
                </div>
              </div>
              {result.error && <p className="finance-tools-result-error">{result.error}</p>}
              {result.youAreSafe && (
                <div className="finance-tools-you-are-safe">
                  <span className="finance-tools-you-are-safe-icon">✓</span>
                  <strong>You are safe.</strong> No tax liability / no action required.
                  {result.nextCheckSuggested && (
                    <span className="finance-tools-next-check"> Next check suggested: {result.nextCheckSuggested}</span>
                  )}
                </div>
              )}
              {result.summary && <p className="finance-tools-summary">{result.summary}</p>}
              {result.toolId === 'bank-credit-card-statements' && selectedDocumentIds.length > 0 && (
                <p className="finance-tools-chat-link-wrap">
                  <Link
                    to={`/chat?documents=${selectedDocumentIds.join(',')}`}
                    className="finance-tools-chat-link"
                  >
                    Chat with these statements
                  </Link>
                  {' — Explain, Share, What If, Voice & more.'}
                </p>
              )}
              <div className="finance-tools-sections">
                {result.sections?.map((s, i) => (
                  <div key={i} className="finance-tools-section">
                    <h4>{s.heading}</h4>
                    {s.content && <p>{s.content}</p>}
                    {s.items?.length ? (
                      <ul>
                        {s.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showResultView && result && (
            <FinanceToolResultView
              result={result}
              onClose={() => setShowResultView(false)}
              onExportPdf={handleExportPdf}
            />
          )}
        </div>
      </div>
    </div>
  );
}
