import { useMemo, useRef, useState } from 'react';
import { uploadFile } from '../../api/client';

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*);base64/);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const byteString = atob(base64);
  const array = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) array[i] = byteString.charCodeAt(i);
  return new File([array], filename, { type: mime });
}

export default function MobileScan() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ id: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUseCamera = useMemo(() => {
    // On mobile browsers, file input with capture is the most reliable way
    return true;
  }, []);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const resp = await uploadFile(file);
      if (!resp.success) throw new Error('Upload failed');
      setResult({ id: resp.document.id, filename: resp.document.filename });
    } catch (e: any) {
      setError(e?.message || 'Failed to upload scan');
    } finally {
      setUploading(false);
    }
  };

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
          onChange={async (e) => {
            const f = e.target.files?.[0] || null;
            if (f) {
              const reader = new FileReader();
              reader.onload = () => setCapturedDataUrl(typeof reader.result === 'string' ? reader.result : null);
              reader.readAsDataURL(f);
            }
            await onPick(f);
          }}
        />

        <div className="m-row">
          <button className="m-btn primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Open camera'}
          </button>
          {capturedDataUrl && (
            <button
              className="m-btn"
              onClick={() => {
                const file = dataUrlToFile(capturedDataUrl, `scan-${Date.now()}.jpg`);
                onPick(file);
              }}
              disabled={uploading}
            >
              Re-upload
            </button>
          )}
        </div>
      </div>

      {capturedDataUrl && (
        <div className="m-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Preview</div>
          <img
            src={capturedDataUrl}
            alt="Scan preview"
            style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)' }}
          />
        </div>
      )}

      {error && (
        <div className="m-card" style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="m-card">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Uploaded</div>
          <div style={{ color: 'rgba(15,23,42,0.75)', fontSize: 13, marginBottom: 10 }}>
            {result.filename}
          </div>
          <div className="m-row">
            <a className="m-btn primary" href={`/m/docs`} style={{ textDecoration: 'none' }}>
              View in Documents
            </a>
            <a className="m-btn" href={`/chat`} style={{ textDecoration: 'none' }}>
              Ask in Chat
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

