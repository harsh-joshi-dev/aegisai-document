import { useState } from 'react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';
import { UploadResponse } from '../api/client';
import './upload.css';

export default function UploadPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUploadedDocumentIds, setLastUploadedDocumentIds] = useState<string[]>([]);

  const handleUploadSuccess = (_response: UploadResponse) => {
    setRefreshKey(prev => prev + 1);
  };

  const handleBatchUploadSuccess = (documentIds: string[]) => {
    setLastUploadedDocumentIds(documentIds);
    setRefreshKey(prev => prev + 1);
  };

  const chatUrl = lastUploadedDocumentIds.length > 0
    ? `/chat?documents=${lastUploadedDocumentIds.join(',')}`
    : '/chat';

  return (
    <div className="upload-page">
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
            <span className="upload-universal-cta-hint">
              Explain, Share, What If, Voice, Trust Score, and Agent Swarm work for each document below.
            </span>
          </div>
          <button
            type="button"
            className="upload-universal-cta-dismiss"
            onClick={() => setLastUploadedDocumentIds([])}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <DocumentList key={refreshKey} />
    </div>
  );
}
