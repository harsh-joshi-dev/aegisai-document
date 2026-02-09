import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ChatUI from '../../components/ChatUI';

export default function MobileChat() {
  const [searchParams] = useSearchParams();
  const [preselectedDocumentIds, setPreselectedDocumentIds] = useState<string[]>([]);

  useEffect(() => {
    const docParam = searchParams.get('documents');
    if (docParam) {
      const docIds = docParam.split(',').filter((id) => id.trim().length > 0);
      setPreselectedDocumentIds(docIds);
    }
  }, [searchParams]);

  return (
    <div>
      <div className="m-page-title">
        <h1>Chat</h1>
      </div>
      <div className="m-chat-wrapper">
        <ChatUI preselectedDocumentIds={preselectedDocumentIds} />
      </div>
    </div>
  );
}
