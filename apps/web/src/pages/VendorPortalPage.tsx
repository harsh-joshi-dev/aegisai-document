import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, CheckCircle, AlertTriangle, Loader2, Shield,
  X, AlertCircle, Clock, RotateCcw
} from 'lucide-react';
import { getVendorPortalInfo, uploadToVendorPortal } from '../api/client';

interface RequiredDoc {
  type: string;
  label: string;
  mandatory: boolean;
  requiresAnalysis?: boolean;
  description?: string;
}

interface UploadedDoc {
  id: string;
  filename: string;
  uploaded_at: string;
  review_status: string | null;
}

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function VendorPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [portalInfo, setPortalInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; success: boolean; risk?: string; error?: string; autoAnalysis?: boolean }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const fetchPortal = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const r = await getVendorPortalInfo(token);
      setPortalInfo(r.portal);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Unable to load this upload portal. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPortal(); }, [fetchPortal]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!token || !portalInfo) return;

    const fileArr = Array.from(files);
    const validFiles: File[] = [];

    for (const file of fileArr) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadResults(prev => [...prev, { name: file.name, success: false, error: 'File too large (max 50MB)' }]);
        continue;
      }
      if (file.size === 0) {
        setUploadResults(prev => [...prev, { name: file.name, success: false, error: 'File is empty' }]);
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp'];
      if (!allowedExts.includes(ext)) {
        setUploadResults(prev => [...prev, { name: file.name, success: false, error: `Unsupported format. Allowed: ${allowedExts.join(', ')}` }]);
        continue;
      }
      validFiles.push(file);
    }

    for (const file of validFiles) {
      setUploading(true);
      try {
        const r = await uploadToVendorPortal(token, file);
        setUploadResults(prev => [...prev, { name: file.name, success: true, risk: r.document?.riskLevel, autoAnalysis: r.autoAnalysisTriggered }]);
        setPortalInfo((prev: any) => prev ? { ...prev, remainingUploads: prev.remainingUploads - 1, uploadedDocuments: [{ id: r.document.id, filename: r.document.filename, uploaded_at: new Date().toISOString(), review_status: null }, ...(prev.uploadedDocuments || [])] } : prev);
      } catch (e: any) {
        setUploadResults(prev => [...prev, { name: file.name, success: false, error: e?.response?.data?.error || 'Upload failed' }]);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (error || !portalInfo) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-subtle bg-card-hover p-8">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-main mb-2">Portal Unavailable</h2>
          <p className="text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  const requiredDocs: RequiredDoc[] = portalInfo.requiredDocuments || [];
  const uploadedDocs: UploadedDoc[] = portalInfo.uploadedDocuments || [];
  const rejectedDocs = uploadedDocs.filter(d => d.review_status === 'rejected' || d.review_status === 'needs_reupload');

  // Match uploaded docs to required
  const matchedTypes = new Set<string>();
  for (const doc of uploadedDocs) {
    const fname = doc.filename.toLowerCase();
    for (const req of requiredDocs) {
      const keywords = req.label.toLowerCase().split(/\s+/);
      if (keywords.some(kw => fname.includes(kw))) {
        matchedTypes.add(req.type);
      }
    }
  }

  const mandatoryDocs = requiredDocs.filter(d => d.mandatory);
  const mandatoryUploaded = mandatoryDocs.filter(d => matchedTypes.has(d.type)).length;
  const progressPct = requiredDocs.length > 0 ? Math.round((matchedTypes.size / requiredDocs.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-main">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <Shield size={24} className="text-main" />
          </div>
          {portalInfo.companyName && <p className="text-xs text-dim font-medium uppercase tracking-wider mb-1">{portalInfo.companyName}</p>}
          <h1 className="text-2xl font-bold text-main mb-1">Document Upload Portal</h1>
          <p className="text-sm text-muted">Welcome, <span className="text-indigo-300 font-medium">{portalInfo.vendorName}</span></p>
          {portalInfo.description && <p className="text-sm text-dim mt-2 max-w-md mx-auto">{portalInfo.description}</p>}
        </div>

        {/* Progress */}
        {requiredDocs.length > 0 && (
          <div className="rounded-2xl border border-subtle bg-card-hover p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-main">Submission Progress</h3>
              <span className="text-sm font-bold text-main">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-subtle rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-500' : progressPct > 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-dim">
              <span>{matchedTypes.size}/{requiredDocs.length} documents</span>
              <span>{mandatoryUploaded}/{mandatoryDocs.length} mandatory</span>
              <span className={portalInfo.remainingUploads <= 3 ? 'text-amber-400' : ''}>{portalInfo.remainingUploads} upload{portalInfo.remainingUploads !== 1 ? 's' : ''} remaining</span>
            </div>
          </div>
        )}

        {/* Required Documents Checklist */}
        {requiredDocs.length > 0 && (
          <div className="rounded-2xl border border-subtle bg-card-hover p-5 mb-6">
            <h3 className="text-sm font-medium text-main mb-3 flex items-center gap-2"><FileText size={14} className="text-indigo-400" /> Required Documents</h3>
            <div className="space-y-2">
              {requiredDocs.map((doc, i) => {
                const isUploaded = matchedTypes.has(doc.type);
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isUploaded ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-card-hover border border-subtle'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isUploaded ? 'bg-emerald-500/20' : 'bg-subtle'}`}>
                      {isUploaded ? <CheckCircle size={12} className="text-emerald-400" /> : <span className="w-2 h-2 rounded-full bg-dim" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isUploaded ? 'text-emerald-300' : 'text-main'}`}>{doc.label}</span>
                      {doc.mandatory && <span className="text-red-400 ml-1 text-xs">*</span>}
                      {doc.description && <p className="text-[10px] text-dim mt-0.5">{doc.description}</p>}
                    </div>
                    {isUploaded ? <span className="text-[10px] text-emerald-400 font-medium">Uploaded</span> : <span className="text-[10px] text-dim">Pending</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rejected / Re-upload */}
        {rejectedDocs.length > 0 && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 mb-6">
            <h3 className="text-sm font-medium text-red-300 mb-3 flex items-center gap-2"><RotateCcw size={14} /> Re-upload Required</h3>
            <p className="text-xs text-muted mb-3">The following documents were rejected and need to be re-uploaded:</p>
            {rejectedDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/10 mb-1">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-sm text-red-300 flex-1">{doc.filename}</span>
                <span className="text-[10px] text-red-400">{doc.review_status === 'needs_reupload' ? 'Re-upload' : 'Rejected'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload Area — always available for testing */}
        {true ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-subtle bg-card-hover hover:border-light hover:bg-card-hover'}`}
            onClick={() => document.getElementById('vendor-upload-input')?.click()}
          >
            <input id="vendor-upload-input" type="file" multiple accept={ACCEPT_TYPES} onChange={handleFileInput} className="hidden" />
            {uploading ? (
              <div>
                <Loader2 size={36} className="animate-spin text-indigo-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-main">Uploading & analyzing...</p>
                <p className="text-xs text-dim mt-1">AI is processing your document</p>
              </div>
            ) : (
              <div>
                <Upload size={36} className="text-dim mx-auto mb-3" />
                <p className="text-sm font-medium text-main mb-1">Drop files here or click to upload</p>
                <p className="text-xs text-dim">Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, WEBP (max 50MB)</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-subtle bg-subtle p-8 text-center">
            <AlertCircle size={36} className="text-dim mx-auto mb-3" />
            <p className="text-sm font-medium text-muted">Upload limit reached</p>
            <p className="text-xs text-dim mt-1">Contact the requesting organization if you need to upload more documents.</p>
          </div>
        )}

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-main mb-2">Upload Results</h3>
            {uploadResults.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${r.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                {r.success ? <CheckCircle size={16} className="text-emerald-400 shrink-0" /> : <X size={16} className="text-red-400 shrink-0" />}
                <span className="text-sm text-main flex-1 truncate">{r.name}</span>
                {r.success && r.risk && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.risk === 'Critical' ? 'bg-red-500/20 text-red-300' : r.risk === 'Warning' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{r.risk}</span>
                )}
                {r.autoAnalysis && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Auto-analysis started</span>
                )}
                {r.error && <span className="text-xs text-red-400">{r.error}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Already Uploaded */}
        {uploadedDocs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-main mb-3">Uploaded Documents ({uploadedDocs.length})</h3>
            <div className="space-y-1.5">
              {uploadedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-subtle bg-card-hover">
                  <FileText size={14} className="text-dim shrink-0" />
                  <span className="text-sm text-main flex-1 truncate">{doc.filename}</span>
                  {doc.review_status === 'approved' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Approved</span>}
                  {doc.review_status === 'rejected' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Rejected</span>}
                  {doc.review_status === 'needs_reupload' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">Re-upload</span>}
                  {!doc.review_status && <span className="text-[10px] text-dim">Processing</span>}
                  <span className="text-[10px] text-dim shrink-0 flex items-center gap-1"><Clock size={10} />{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-dim mt-12">Secure document upload powered by CA.Dynamix</p>
      </div>
    </div>
  );
}
