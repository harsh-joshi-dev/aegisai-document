import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFile } from '../../api/client';

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ id: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (!isSupportedFile(file)) {
      setError(`Unsupported file type. Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, WEBP`);
      return;
    }
    setUploading(true);
    // Fallback: ensure we never leave "Uploading" stuck if the request hangs (e.g. slow mobile network)
    const timeoutId = window.setTimeout(() => setUploading(false), 120000);
    try {
      const resp = await uploadFile(file);
      if (!resp.success) throw new Error('Upload failed');
      setUploading(false); // Clear immediately on success so UI updates before navigation
      setResult({ id: resp.document.id, filename: resp.document.filename });
      setPendingFile(null);
      setPreviewDataUrl(null);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to upload';
      setError(msg);
    } finally {
      window.clearTimeout(timeoutId);
      setUploading(false);
    }
  };

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    setError(null);
    setPendingFile(file);
    if (isImageFile(file)) {
      const reader = new FileReader();
      reader.onload = () => setPreviewDataUrl(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(file);
    } else {
      setPreviewDataUrl(null);
    }
  };

  const handleRetake = () => {
    setPendingFile(null);
    setPreviewDataUrl(null);
    setError(null);
    cameraInputRef.current && (cameraInputRef.current.value = '');
    fileInputRef.current && (fileInputRef.current.value = '');
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

        {/* Camera: image only */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
        />
        {/* File picker: all supported types (image, PDF, doc, xls, etc.) */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ALL}
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
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
            <span>Choose image, PDF or document</span>
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'rgba(15,23,42,0.5)', marginTop: 10 }}>
          Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, WEBP
        </p>
      </div>

      {pendingFile && !result && (
        <div className="m-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Preview</div>
          {previewDataUrl ? (
            <>
              <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginBottom: 10 }}>
                Only upload document images. If this is not a document, tap Choose another.
              </p>
              <img
                src={previewDataUrl}
                alt="Preview"
                style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', marginBottom: 12 }}
              />
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(15,23,42,0.8)', marginBottom: 12 }}>
              <strong>{pendingFile.name}</strong>
              <br />
              <span style={{ color: 'rgba(15,23,42,0.5)' }}>{(pendingFile.size / 1024).toFixed(1)} KB</span>
            </p>
          )}
          <div className="m-row">
            <button className="m-btn primary" onClick={() => onPick(pendingFile)} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload document'}
            </button>
            <button className="m-btn" onClick={handleRetake} disabled={uploading}>
              Choose another
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
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Document uploaded</div>
          <div style={{ color: 'rgba(15,23,42,0.75)', fontSize: 13, marginBottom: 12 }}>
            {result.filename}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginBottom: 12 }}>
            Taking you to Documents…
          </p>
          <a className="m-btn primary" href="/m/docs" style={{ textDecoration: 'none' }}>
            View in Documents
          </a>
        </div>
      )}
    </div>
  );
}
