import DocumentList from '../../components/DocumentList';

export default function MobileDocs() {
  return (
    <div>
      <div className="m-page-title">
        <h1>Documents</h1>
      </div>
      <DocumentList compact={true} />
    </div>
  );
}
