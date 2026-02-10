import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';
import FinancialHealthDashboard from '../components/FinancialHealthDashboard';
import WhatShouldIDoNextModal from '../components/WhatShouldIDoNextModal';
import { UploadResponse, getDocuments, type Document } from '../api/client';
import { documentScopedFeatureIds, getFeatureLabel } from '../config/featuresByCategory';
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
      {isDocumentScopedFeature && (
        <div className="upload-feature-runner">
          <div className="upload-feature-runner-header">
            <span className="upload-feature-runner-label">Run: {getFeatureLabel(featureFromUrl)}</span>
          </div>
          <div className="upload-feature-runner-body">
            {runnerLoading ? (
              <span className="upload-feature-runner-hint">Loading documents…</span>
            ) : runnerDocuments.length === 0 ? (
              <span className="upload-feature-runner-hint">Upload a document first, then run this feature.</span>
            ) : (
              <>
                <label htmlFor="feature-runner-doc" className="upload-feature-runner-select-label">Document</label>
                <select
                  id="feature-runner-doc"
                  className="upload-feature-runner-select"
                  value={runnerDocumentId}
                  onChange={(e) => setRunnerDocumentId(e.target.value)}
                >
                  {runnerDocuments.map((d) => (
                    <option key={d.id} value={d.id}>{d.filename}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="upload-feature-runner-btn"
                  onClick={handleRunFeature}
                >
                  Run
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <FileUploader
        onUploadSuccess={handleUploadSuccess}
        onBatchUploadSuccess={handleBatchUploadSuccess}
      />
      {lastUploadedDocumentIds.length > 0 && (
        <div className="upload-universal-cta">
          <p className="upload-universal-cta-text">
            Ask anything from your uploaded documents — answers can come from any of them.
          </p>
          <div className="upload-universal-cta-actions">
            <Link to={chatUrl} className="upload-universal-cta-btn primary">
              Chat with these {lastUploadedDocumentIds.length} document{lastUploadedDocumentIds.length !== 1 ? 's' : ''}
            </Link>
            {lastUploadedDocument && (
              <button
                type="button"
                className="upload-universal-cta-btn primary"
                onClick={() => { setShowWhatShouldIDoNext(true); }}
              >
                What Should I Do Next?
              </button>
            )}
            <button
              type="button"
              className="upload-universal-cta-btn secondary"
              onClick={() => setOpenStatementsAnalysis(true)}
            >
              Analyze Bank &amp; Credit Card Statements
            </button>
            <span className="upload-universal-cta-hint">
              Explain, Share, What If, Voice, Trust Score, Agent Swarm, Deadlines, and more for each document below.
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
        </div>
      )}
      {showWhatShouldIDoNext && lastUploadedDocument && (
        <WhatShouldIDoNextModal
          document={lastUploadedDocument}
          onClose={() => setShowWhatShouldIDoNext(false)}
        />
      )}
      <FinancialHealthDashboard />
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
  );
}
