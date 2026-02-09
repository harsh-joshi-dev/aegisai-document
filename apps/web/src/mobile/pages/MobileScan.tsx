import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFile } from '../../api/client';

export default function MobileScan() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ id: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUseCamera = useMemo(() => true, []);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const resp = await uploadFile(file);
      if (!resp.success) throw new Error('Upload failed');
      setResult({ id: resp.document.id, filename: resp.document.filename });
      setPendingFile(null);
      setCapturedDataUrl(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to upload scan');
    } finally {
      setUploading(false);
    }
  };

  const handleRetake = () => {
    setPendingFile(null);
    setCapturedDataUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // After scan completes, show success and auto-navigate to docs after a short delay
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      navigate('/m/docs', { replace: true });
    }, 2500);
    return () => clearTimeout(t);
  }, [result, navigate]);

  return (
    <div>
      <div className="m-page-title">
        <h1>Scan + OCR</h1>
      </div>

      <div className="m-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Capture a document</div>
        <div style={{ color: 'rgba(15,23,42,0.7)', fontSize: 13, lineHeight: 1.4, marginBottom: 10 }}>
          Use your phone camera. We’ll upload the image to the backend, which will OCR it during processing.
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture={canUseCamera ? 'environment' : undefined}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            if (f) {
              setPendingFile(f);
              const reader = new FileReader();
              reader.onload = () => setCapturedDataUrl(typeof reader.result === 'string' ? reader.result : null);
              reader.readAsDataURL(f);
            }
          }}
        />

        <div className="m-row">
          <button className="m-btn primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Open camera'}
          </button>
        </div>
      </div>

      {capturedDataUrl && pendingFile && !result && (
        <div className="m-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Preview</div>
          <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', marginBottom: 10 }}>
            Only upload document images (e.g. contracts, forms). If this is not a document, tap Retake.
          </p>
          <img
            src={capturedDataUrl}
            alt="Scan preview"
            style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', marginBottom: 12 }}
          />
          <div className="m-row">
            <button className="m-btn primary" onClick={() => onPick(pendingFile)} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload document'}
            </button>
            <button className="m-btn" onClick={handleRetake} disabled={uploading}>
              Retake
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

