import React, { useState } from 'react';
import { uploadFile, uploadTextDocument, UploadResponse } from '../api/client';
import './FileUploader.css';

interface FileUploaderProps {
  onUploadSuccess?: (response: UploadResponse) => void;
}

interface UploadProgress {
  filename: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  result?: UploadResponse;
  error?: string;
}

export default function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'files' | 'text'>('files');
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // Supported file types
  const supportedTypes = [
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
  
  const supportedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;
    
    // Validate file types
    const invalidFiles = selectedFiles.filter(file => {
      const isValidType = supportedTypes.includes(file.type) || 
        supportedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      return !isValidType;
    });
    
    if (invalidFiles.length > 0) {
      setError(
        `Invalid file type(s): ${invalidFiles
          .map(f => f.name)
          .join(', ')}. Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, WEBP`
      );
      return;
    }
    
    setFiles(prev => [...prev, ...selectedFiles]);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    if (droppedFiles.length === 0) return;
    
    // Validate file types
    const invalidFiles = droppedFiles.filter(file => {
      const isValidType = supportedTypes.includes(file.type) || 
        supportedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      return !isValidType;
    });
    
    if (invalidFiles.length > 0) {
      setError(
        `Invalid file type(s): ${invalidFiles
          .map(f => f.name)
          .join(', ')}. Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, WEBP`
      );
      return;
    }
    
    setFiles(prev => [...prev, ...droppedFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setError(null);
    setSuccessMessage(null);

    if (mode === 'files') {
      if (files.length === 0) {
        setError('Please select at least one file');
        return;
      }

      setUploading(true);
      setUploadProgress(files.map(f => ({ filename: f.name, status: 'pending' as const })));

      const newProgress: UploadProgress[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          newProgress[i] = { filename: file.name, status: 'uploading', progress: 0 };
          setUploadProgress([...newProgress]);

          try {
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            const response = await uploadFile(file);
            newProgress[i] = {
              filename: file.name,
              status: 'success',
              progress: 100,
              result: response,
            };

            if (onUploadSuccess) {
              onUploadSuccess(response);
            }
          } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Upload failed';
            newProgress[i] = {
              filename: file.name,
              status: 'error',
              error: errorMessage,
            };
          }

          setUploadProgress([...newProgress]);
        }

        setFiles([]);
        setUploadProgress([]);

        // Check if all uploads were successful after all files are processed
        const allSuccess = newProgress.every(p => p.status === 'success');
        const hasErrors = newProgress.some(p => p.status === 'error');
        
        if (allSuccess && newProgress.length > 0 && !hasErrors) {
          const count = newProgress.length;
          setSuccessMessage(`${count} document${count > 1 ? 's' : ''} successfully added!`);
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to upload files');
      } finally {
        setUploading(false);
      }
      return;
    }

    if (mode === 'text') {
      if (!textContent.trim()) {
        setError('Please paste some text to upload');
        return;
      }

      setUploading(true);
      try {
        const response = await uploadTextDocument(textTitle.trim(), textContent);
        if (onUploadSuccess) onUploadSuccess(response);
        setSuccessMessage('Document successfully added!');
        setTimeout(() => setSuccessMessage(null), 5000);
        setTextTitle('');
        setTextContent('');
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to upload text');
      } finally {
        setUploading(false);
      }
      return;
    }

  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return (
          <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="2"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeWidth="2"/>
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="2"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeWidth="2"/>
          </svg>
        );
      case 'xls':
      case 'xlsx':
        return (
          <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="2"/>
            <path d="M14 2v6h6M12 18v-4M8 18v-4M16 12H8" strokeWidth="2"/>
          </svg>
        );
      default:
        return (
          <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="2"/>
            <path d="M14 2v6h6" strokeWidth="2"/>
          </svg>
        );
    }
  };

  return (
    <div className="file-uploader">
      <div className="upload-card">
        <div className="upload-header">
          <div className="upload-header-content">
            <svg className="upload-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <h2>Upload Documents</h2>
              <p className="subtitle">
                Upload files, paste raw text, or import emails. Supports PDF, Office docs, images (OCR), and Gmail text.
              </p>
            </div>
          </div>

          <div className="upload-mode-tabs">
            <button
              type="button"
              className={`mode-tab ${mode === 'files' ? 'active' : ''}`}
              onClick={() => setMode('files')}
            >
              Files
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'text' ? 'active' : ''}`}
              onClick={() => setMode('text')}
            >
              Text
            </button>
          </div>
        </div>

        {mode === 'files' && (
        <div className="upload-area">
          <div
            className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-input"
              className="file-input"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
            />
            <label htmlFor="file-input" className="file-label">
              <div className="drop-zone-content">
                <svg className="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="drop-zone-text">
                  <span className="drop-zone-main">Choose files or drag and drop</span>
                  <span className="drop-zone-sub">PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, WEBP</span>
                </div>
              </div>
            </label>
          </div>
        </div>
        )}

        {mode === 'text' && (
          <div className="text-upload-area">
            <input
              type="text"
              className="text-title-input"
              placeholder="Optional title for this text document"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
            />
            <textarea
              className="text-content-input"
              placeholder="Paste or type your text here..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={8}
            />
          </div>
        )}


        {mode === 'files' && files.length > 0 && (
          <div className="selected-files">
            <div className="selected-files-header">
              <span className="selected-files-count">{files.length} file{files.length > 1 ? 's' : ''} selected</span>
              <button onClick={() => setFiles([])} className="clear-all-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Clear All
              </button>
            </div>
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-item-icon">{getFileIcon(file.name)}</div>
                  <div className="file-item-info">
                    <div className="file-item-name">{file.name}</div>
                    <div className="file-item-size">{formatFileSize(file.size)}</div>
                  </div>
                  <button onClick={() => removeFile(index)} className="file-item-remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="upload-error">
            <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {successMessage && (
          <div className="upload-success">
            <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {successMessage}
          </div>
        )}

        {uploadProgress.length > 0 && (
          <div className="upload-progress-section">
            {uploadProgress.map((progress, index) => (
              <div key={index} className={`progress-item ${progress.status}`}>
                <div className="progress-item-header">
                  <div className="progress-item-info">
                    {progress.status === 'uploading' && (
                      <svg className="progress-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32">
                          <animate attributeName="stroke-dasharray" values="0 32;16 16;0 32;0 32" dur="1.5s" repeatCount="indefinite"/>
                          <animate attributeName="stroke-dashoffset" values="0;-16;-32;-32" dur="1.5s" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                    )}
                    {progress.status === 'success' && (
                      <svg className="progress-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {progress.status === 'error' && (
                      <svg className="progress-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                    <span className="progress-filename">{progress.filename}</span>
                  </div>
                  {progress.status === 'error' && progress.error && (
                    <span className="progress-error">{progress.error}</span>
                  )}
                </div>
                {progress.status === 'uploading' && (
                  <div className="progress-bar-wrapper">
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${progress.progress || 0}%` }}></div>
                    </div>
                    <div className="progress-status-text">
                      <svg className="progress-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32">
                          <animate attributeName="stroke-dasharray" values="0 32;16 16;0 32;0 32" dur="1.5s" repeatCount="indefinite"/>
                          <animate attributeName="stroke-dashoffset" values="0;-16;-32;-32" dur="1.5s" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                      <span>Processing...</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={
            uploading ||
            (mode === 'files' && files.length === 0) ||
            (mode === 'text' && !textContent.trim())
          }
          className="upload-button"
        >
          {uploading ? (
            <>
              <svg className="button-icon spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32">
                  <animate attributeName="stroke-dasharray" values="0 32;16 16;0 32;0 32" dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="stroke-dashoffset" values="0;-16;-32;-32" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Upload & Process
            </>
          )}
        </button>
      </div>

    </div>
  );
}
