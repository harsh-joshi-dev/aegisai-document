import { useState } from 'react';
import DocumentList from '../../components/DocumentList';

export default function MobileDocs() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      <div className="m-page-title">
        <h1>Documents</h1>
      </div>

      <div className="m-card m-search-card">
        <div className="m-search-label">Search</div>
        <input
          type="text"
          className="m-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by filename..."
        />
      </div>

      <DocumentList searchQuery={searchQuery} compact={true} />
    </div>
  );
}
