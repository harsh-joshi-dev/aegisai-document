import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CloudUpload,
  MessageSquare,
  Lightbulb,
  BarChart3,
  Play,
  ChevronRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  FileText
} from 'lucide-react';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';
import FinancialHealthDashboard from '../components/FinancialHealthDashboard';
import WhatShouldIDoNextModal from '../components/WhatShouldIDoNextModal';
import { UploadResponse, getDocuments, type Document } from '../api/client';
import { documentScopedFeatureIds, getFeatureLabel } from '../config/featuresByCategory';
import { motion, AnimatePresence } from 'framer-motion';
import './upload.css';

export default function UploadPage() {
  const [searchParams] = useSearchParams();
  const featureFromUrl = searchParams.get('feature') ?? '';

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUploadedDocumentIds, setLastUploadedDocumentIds] = useState<string[]>([]);
  const [lastUploadedDocument, setLastUploadedDocument] = useState<Document | null>(null);
  const [openStatementsAnalysis, setOpenStatementsAnalysis] = useState(false);
  const [showWhatShouldIDoNext, setShowWhatShouldIDoNext] = useState(false);

  const [runnerDocuments, setRunnerDocuments] = useState<Document[]>([]);
  const [runnerLoading, setRunnerLoading] = useState(false);
  const [runnerDocumentId, setRunnerDocumentId] = useState<string>('');
  const [openFeatureForDocument, setOpenFeatureForDocument] = useState<{ feature: string; documentId: string } | undefined>(undefined);

  const isDocumentScopedFeature = featureFromUrl && documentScopedFeatureIds.has(featureFromUrl);

  useEffect(() => {
    if (!isDocumentScopedFeature) return;
    setRunnerLoading(true);
    getDocuments()
      .then((r) => {
        setRunnerDocuments(r.documents ?? []);
        setRunnerDocumentId((prev) => {
          const ids = (r.documents ?? []).map((d) => d.id);
          return ids.includes(prev) ? prev : ids[0] ?? '';
        });
      })
      .finally(() => setRunnerLoading(false));
  }, [isDocumentScopedFeature, refreshKey]);

  const handleUploadSuccess = (response: UploadResponse) => {
    setRefreshKey(prev => prev + 1);
    if (response.document) {
      setLastUploadedDocument({
        id: response.document.id,
        filename: response.document.filename,
        uploadedAt: response.document.uploadedAt,
        riskLevel: response.document.riskLevel,
        riskCategory: response.document.riskCategory,
        riskConfidence: response.document.riskConfidence,
      });
    }
  };

  const handleBatchUploadSuccess = (documentIds: string[]) => {
    setLastUploadedDocumentIds(documentIds);
    setRefreshKey(prev => prev + 1);
  };

  const chatUrl = lastUploadedDocumentIds.length > 0
    ? `/chat?documents=${lastUploadedDocumentIds.join(',')}`
    : '/chat';

  const handleRunFeature = () => {
    if (!featureFromUrl || !runnerDocumentId) return;
    setOpenFeatureForDocument({ feature: featureFromUrl, documentId: runnerDocumentId });
  };

  return (
    <div className="upload-page">
      {/* Page Intro */}
      <div className="upload-intro">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <CloudUpload size={20} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-dim">Document Intelligence</span>
        </div>
        <h1 className="upload-title font-display text-main">Central <span className="text-indigo-400">Ingestion</span></h1>
        <p className="upload-subtitle">Transform raw financial data into actionable enterprise intelligence.</p>
      </div>

      {/* Step Indicators */}
      <div className="upload-steps">
        <div className={`upload-step ${lastUploadedDocumentIds.length === 0 ? 'active' : 'completed'}`}>
          <span className="upload-step-label">1. Upload</span>
        </div>
        <div className={`upload-step ${lastUploadedDocumentIds.length > 0 ? 'active' : ''}`}>
          <span className="upload-step-label">2. Analyze</span>
        </div>
        <div className="upload-step">
          <span className="upload-step-label">3. Intelligence</span>
        </div>
      </div>

      {isDocumentScopedFeature && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="upload-feature-runner"
        >
          <div className="upload-feature-runner-header">
            <div className="flex items-center gap-3">
              <Zap size={16} className="text-indigo-400" />
              <span className="upload-feature-runner-label">Executor: {getFeatureLabel(featureFromUrl)}</span>
            </div>
          </div>
          <div className="upload-feature-runner-body">
            {runnerLoading ? (
              <span className="upload-feature-runner-hint">Synchronizing repository…</span>
            ) : runnerDocuments.length === 0 ? (
              <span className="upload-feature-runner-hint">No active documents for cross-referencing.</span>
            ) : (
              <>
                <select
                  id="feature-runner-doc"
                  className="upload-feature-runner-select"
                  value={runnerDocumentId}
                  onChange={(e) => setRunnerDocumentId(e.target.value)}
                >
                  <option value="" disabled>Select Source Document</option>
                  {runnerDocuments.map((d) => (
                    <option key={d.id} value={d.id}>{d.filename}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="upload-feature-runner-btn"
                  onClick={handleRunFeature}
                >
                  <Play size={14} className="inline-block mr-2" />
                  Run Analysis
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}

      <FileUploader
        onUploadSuccess={handleUploadSuccess}
        onBatchUploadSuccess={handleBatchUploadSuccess}
      />

      <AnimatePresence>
        {lastUploadedDocumentIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="upload-universal-cta"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="upload-universal-cta-text">Batch Upload Complete</h3>
                  <p className="text-dim text-xs font-medium">Ready for deep-layer neural analysis.</p>
                </div>
              </div>
            </div>

            <div className="upload-universal-cta-actions">
              <Link to={chatUrl} className="upload-universal-cta-btn primary flex items-center gap-2">
                <MessageSquare size={16} />
                Chat with {lastUploadedDocumentIds.length} Chunks
              </Link>
              {lastUploadedDocument && (
                <button
                  type="button"
                  className="upload-universal-cta-btn primary flex items-center gap-2"
                  onClick={() => { setShowWhatShouldIDoNext(true); }}
                >
                  <Lightbulb size={16} />
                  Intelligence Radar
                </button>
              )}
              <button
                type="button"
                className="upload-universal-cta-btn secondary flex items-center gap-2"
                onClick={() => setOpenStatementsAnalysis(true)}
              >
                <BarChart3 size={16} />
                Audit Pipeline
              </button>
            </div>

            <div className="pt-2 border-t border-subtle">
              <span className="upload-universal-cta-hint italic">
                Pro tip: Use the Audit Pipeline to cross-reference bank statements with GST filings automatically.
              </span>
            </div>

            <button
              type="button"
              className="upload-universal-cta-dismiss"
              onClick={() => { setLastUploadedDocumentIds([]); setLastUploadedDocument(null); setShowWhatShouldIDoNext(false); }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showWhatShouldIDoNext && lastUploadedDocument && (
        <WhatShouldIDoNextModal
          document={lastUploadedDocument}
          onClose={() => setShowWhatShouldIDoNext(false)}
        />
      )}

      <div className="mt-12">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold font-display text-main">Platform <span className="text-dim underline decoration-indigo-500/30">Analytics</span></h2>
        </div>
        <FinancialHealthDashboard />
      </div>

      <div className="mt-12 bg-card rounded-[32px] border border-subtle p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold font-display text-main">Repository Overview</h2>
          </div>
          <Link to="/dashboard" className="text-xs font-bold uppercase tracking-widest text-dim hover:text-indigo-400 transition-colors flex items-center gap-1">
            Global Dashboard <ChevronRight size={14} />
          </Link>
        </div>

        <DocumentList
          key={refreshKey}
          openFinanceTool={
            openStatementsAnalysis && lastUploadedDocumentIds.length > 0
              ? { toolId: 'bank-credit-card-statements', documentIds: lastUploadedDocumentIds }
              : undefined
          }
          onFinanceToolsClose={() => setOpenStatementsAnalysis(false)}
          openFeatureForDocument={openFeatureForDocument}
          onFeatureOpened={() => setOpenFeatureForDocument(undefined)}
        />
      </div>
    </div>
  );
}
