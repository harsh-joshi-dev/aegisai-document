import { useState } from 'react';
import FileUploader from '../components/FileUploader';
import DocumentList from '../components/DocumentList';
import { UploadResponse } from '../api/client';
import './upload.css';

export default function UploadPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = (response: UploadResponse) => {
    console.log('Upload successful:', response);
    // Refresh document list after upload
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="upload-page">
      <FileUploader onUploadSuccess={handleUploadSuccess} />
      <DocumentList key={refreshKey} />
    </div>
  );
}
