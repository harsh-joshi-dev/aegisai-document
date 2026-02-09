import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFile, getFolders, createFolder, moveDocumentToFolder } from '../../api/client';

// Same as web FileUploader + backend documentParser
const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp'];
const SUPPORTED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];
const ACCEPT_ALL = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';

function isSupportedFile(file: File): boolean {
  const byMime = SUPPORTED_MIMES.includes(file.type);
  const byExt = SUPPORTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  return byMime || byExt;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export default function MobileScan() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ count: number; filename?: string; documentIds: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBatchNameModal, setShowBatchNameModal] = useState(false);
  const [pendingBatchDocumentIds, setPendingBatchDocumentIds] = useState<string[]>([]);
  const [batchFolderName, setBatchFolderName] = useState('Uploaded Documents');

  const uploadAll = async () => {
    if (pendingFiles.length === 0) return;
    setError(null);
    setResult(null);
    const invalid = pendingFiles.filter(f => !isSupportedFile(f));
    if (invalid.length > 0) {
      setError(`Unsupported: ${invalid.map(f => f.name).join(', ')}. Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, WEBP`);
      return;
    }
    setUploading(true);
    const timeoutId = window.setTimeout(() => setUploading(false), 120000);
    const uploadedIds: string[] = [];
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const resp = await uploadFile(pendingFiles[i]);
        if (!resp.success) throw new Error('Upload failed');
        uploadedIds.push(resp.document.id);
        if (i < pendingFiles.length - 1) await new Promise(r => setTimeout(r, 400));
      }
      if (uploadedIds.length > 1) {
        setPendingBatchDocumentIds(uploadedIds);
        setBatchFolderName('Uploaded Documents');
        setShowBatchNameModal(true);
      }
      setResult({
        count: uploadedIds.length,
        filename: pendingFiles.length === 1 ? pendingFiles[0].name : undefined,
        documentIds: uploadedIds,
      });
      setPendingFiles([]);
      setPreviewDataUrl(null);
      cameraInputRef.current && (cameraInputRef.current.value = '');
      fileInputRef.current && (fileInputRef.current.value = '');
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string; response?: { status?: number } };
      let msg = err?.message ?? 'Failed to upload';
      if (msg === 'Network Error' || err?.code === 'ERR_NETWORK' || !err?.response) {
        msg = 'Cannot reach the server. On a phone: use the same Wi‑Fi as your computer and set the app\'s API URL to your computer\'s IP (e.g. http://192.168.1.x:3001) in your environment.';
      }
      setError(msg);
    } finally {
      window.clearTimeout(timeoutId);
      setUploading(false);
    }
  };

  const handleFileSelected = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setError(null);
    setResult(null);
    const valid = newFiles.filter(f => isSupportedFile(f));
    const invalid = newFiles.filter(f => !isSupportedFile(f));
    if (invalid.length > 0) {
      setError(`Unsupported: ${invalid.map(f => f.name).join(', ')}`);
    }
    setPendingFiles(prev => [...prev, ...valid]);
    const firstImage = valid.find(isImageFile);
    if (firstImage && !previewDataUrl) {
      const reader = new FileReader();
      reader.onload = () => setPreviewDataUrl(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(firstImage);
    } else if (!firstImage) setPreviewDataUrl(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleFileSelected(files);
    e.target.value = '';
  };

  const handleInputChangeLegacy = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const files = target.files ? Array.from(target.files) : [];
    if (files.length) handleFileSelected(files);
    target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleClearAll = () => {
    setPendingFiles([]);
    setPreviewDataUrl(null);
    setError(null);
    cameraInputRef.current && (cameraInputRef.current.value = '');
    fileInputRef.current && (fileInputRef.current.value = '');
  };

  const handleBatchNameSubmit = async () => {
    const name = batchFolderName.trim() || 'Uploaded Documents';
    if (pendingBatchDocumentIds.length === 0) {
      setShowBatchNameModal(false);
      setPendingBatchDocumentIds([]);
      return;
    }
    try {
      const { folders } = await getFolders();
      let folderId = folders.find((f: { name: string }) => f.name === name)?.id;
      if (!folderId) {
        const created = await createFolder({ name });
        folderId = created.folder.id;
      }
      for (const docId of pendingBatchDocumentIds) {
        await moveDocumentToFolder({ folderId, documentId: docId });
      }
    } catch (_) { /* best-effort */ }
    setShowBatchNameModal(false);
    setPendingBatchDocumentIds([]);
  };

  const handleBatchNameCancel = () => {
    setShowBatchNameModal(false);
    setPendingBatchDocumentIds([]);
  };

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => navigate('/m/docs', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [result, navigate]);

  return (
    <div>
      <div className="m-page-title">
        <h1>Scan document</h1>
      </div>

      <div className="m-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Add a document</div>
        <p style={{ color: 'rgba(15,23,42,0.7)', fontSize: 13, lineHeight: 1.4, marginBottom: 16 }}>
          Take a photo, choose an image, or pick a PDF/Office file. Same support as on web.
        </p>

        {/* Camera: image only - onChange + onInput so selection shows reliably on mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleInputChange}
          onInput={handleInputChangeLegacy}
        />
        {/* File picker: all supported types, multiple - dual handlers for better mobile support */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ALL}
          multiple
          style={{ display: 'none' }}
          onChange={handleInputChange}
          onInput={handleInputChangeLegacy}
        />

        <div className="m-scan-options">
          <button
            type="button"
            className="m-scan-opt m-btn primary"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <span className="m-scan-opt-icon">📷</span>
            <span>Take photo</span>
          </button>
          <button
            type="button"
            className="m-scan-opt m-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <span className="m-scan-opt-icon">📁</span>
            <span>Choose files</span>
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(15,23,42,0.5)', marginTop: 10 }}>
          Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, WEBP. Select any number of documents.
        </p>
      </div>

      {pendingFiles.length > 0 && !result && (
        <div className="m-card m-scan-selected-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            {pendingFiles.length} document{pendingFiles.length !== 1 ? 's' : ''} selected
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            {pendingFiles.map((file, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>{file.name}</span>
                <button type="button" className="m-btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => removePendingFile(idx)} disabled={uploading}>Remove</button>
              </li>
            ))}
          </ul>
          {previewDataUrl && pendingFiles.some(isImageFile) ? (
            <img src={previewDataUrl} alt="Preview" className="m-scan-preview-img" style={{ marginBottom: 12, maxHeight: 120 }} />
          ) : null}
          <div className="m-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="m-scan-opt m-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <span style={{ marginRight: 4 }}>+</span> Add more files
            </button>
            <button className="m-btn primary" onClick={uploadAll} disabled={uploading}>
              {uploading ? 'Uploading…' : `Upload ${pendingFiles.length} document${pendingFiles.length !== 1 ? 's' : ''}`}
            </button>
            <button className="m-btn" onClick={handleClearAll} disabled={uploading}>
              Clear all
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="m-card" style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="m-card m-scan-success">
          <div className="m-scan-complete-badge">Scan complete</div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            {result.count === 1 ? 'Document uploaded' : `${result.count} documents uploaded`}
          </div>
          <div style={{ color: 'rgba(15,23,42,0.75)', fontSize: 13, marginBottom: 12 }}>
            {result.filename ?? (result.count > 1 ? 'Grouped in Uploaded Documents. Chat, Explain, and Share work for each.' : null)}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginBottom: 12 }}>
            Ask anything from any document — answers come from all of them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.documentIds.length > 0 && (
              <a
                className="m-btn primary"
                href={`/m/chat?documents=${result.documentIds.join(',')}`}
                style={{ textDecoration: 'none' }}
              >
                Chat with these {result.count} document{result.count !== 1 ? 's' : ''}
              </a>
            )}
            <a className="m-btn" href="/m/docs" style={{ textDecoration: 'none' }}>
              View in Documents
            </a>
          </div>
        </div>
      )}

      {showBatchNameModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={handleBatchNameCancel}
        >
          <div
            className="m-card"
            style={{ maxWidth: 360, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Name this batch / folder</div>
            <p style={{ fontSize: 13, color: 'rgba(15,23,42,0.7)', marginBottom: 12 }}>
              The folder will show in your list with this name.
            </p>
            <input
              type="text"
              value={batchFolderName}
              onChange={(e) => setBatchFolderName(e.target.value)}
              placeholder="e.g. GST Q1, Vendor Invoices"
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 12,
                fontSize: 16,
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBatchNameSubmit();
                if (e.key === 'Escape') handleBatchNameCancel();
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="m-btn" onClick={handleBatchNameCancel}>
                Skip
              </button>
              <button type="button" className="m-btn primary" onClick={handleBatchNameSubmit}>
                Create folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
