import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChatUI from '../components/ChatUI';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const [preselectedDocumentIds, setPreselectedDocumentIds] = useState<string[]>([]);

  useEffect(() => {
    // Get document IDs from URL query params
    const docParam = searchParams.get('documents');
    if (docParam) {
      // Support comma-separated document IDs
      const docIds = docParam.split(',').filter(id => id.trim().length > 0);
      setPreselectedDocumentIds(docIds);
    }
  }, [searchParams]);

  return (
    <div>
      <ChatUI preselectedDocumentIds={preselectedDocumentIds} />
    </div>
  );
}
