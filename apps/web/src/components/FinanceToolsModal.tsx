import { useState, useEffect } from 'react';
import {
  getFinanceToolsList,
  runFinanceTool,
  type FinanceToolId,
  type FinanceToolMeta,
  type FinanceToolResult,
  type Document,
} from '../api/client';
import './FinanceToolsModal.css';

const TOOL_DESCRIPTIONS: Record<string, { short: string; why: string }> = {
  'tax-liability-calculator': {
    short: 'GST bills, tax notices, invoices → total payable, penalty risk, due dates.',
    why: 'Perfect for SMEs, accountants, founders.',
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
}

export default function FinanceToolsModal({
  isOpen,
  onClose,
  documents,
  preselectedDocumentIds = [],
}: FinanceToolsModalProps) {
  const [tools, setTools] = useState<FinanceToolMeta[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(preselectedDocumentIds);
  const [selectedToolId, setSelectedToolId] = useState<FinanceToolId | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinanceToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedDocumentIds((prev) =>
        preselectedDocumentIds.length > 0 ? preselectedDocumentIds : prev
      );
      setResult(null);
      setError(null);
    }
  }, [isOpen, preselectedDocumentIds]);

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
              return (
                <button
                  key={tool.id}
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
                {(result.toolId === 'multi-bill-summary-report' || result.sections?.length) && (
                  <button type="button" className="finance-tools-export-pdf" onClick={handleExportPdf}>
                    Export PDF
                  </button>
                )}
              </div>
              {result.error && <p className="finance-tools-result-error">{result.error}</p>}
              {result.summary && <p className="finance-tools-summary">{result.summary}</p>}
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
        </div>
      </div>
    </div>
  );
}
