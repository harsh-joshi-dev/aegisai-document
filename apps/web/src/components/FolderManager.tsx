import { useState, useEffect } from 'react';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  moveDocumentToFolder,
  removeDocumentFromFolder,
  Folder,
} from '../api/client';
import './FolderManager.css';

interface FolderManagerProps {
  documents: Array<{ id: string; filename: string; folderId?: string | null }>;
  onDocumentMoved?: () => void;
  /** When user clicks "Open" on a folder, show it in the main list and optionally sync URL */
  onOpenFolder?: (folderId: string) => void;
}

export default function FolderManager({ documents, onDocumentMoved, onOpenFolder }: FolderManagerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [_draggedDocument, _setDraggedDocument] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFolders();
      setFolders(response.folders);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createFolder({ name: newFolderName.trim() });
      setNewFolderName('');
      setShowCreateModal(false);
      await loadFolders();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFolder = async (folderId: string) => {
    if (!editFolderName.trim()) {
      setError('Folder name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateFolder(folderId, { name: editFolderName.trim() });
      setEditingFolder(null);
      setEditFolderName('');
      await loadFolders();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update folder');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? Documents will be moved to root.')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteFolder(folderId);
      await loadFolders();
      if (onDocumentMoved) onDocumentMoved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete folder');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const documentId = e.dataTransfer.getData('text/plain');
    if (!documentId) return;

    setLoading(true);
    setError(null);
    try {
      if (folderId) {
        await moveDocumentToFolder({ folderId, documentId });
      } else {
        // Find current folder
        const doc = documents.find(d => d.id === documentId);
        if (doc?.folderId) {
          await removeDocumentFromFolder(doc.folderId, documentId);
        }
      }
      if (onDocumentMoved) onDocumentMoved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to move document');
    } finally {
      setLoading(false);
    }
  };

  const [showDocumentSelector, setShowDocumentSelector] = useState<string | null>(null);
  const [selectedDocumentsForFolder, setSelectedDocumentsForFolder] = useState<Set<string>>(new Set());

  const handleAddDocumentsToFolder = async (folderId: string) => {
    if (selectedDocumentsForFolder.size === 0) return;

    setLoading(true);
    setError(null);
    try {
      const promises = Array.from(selectedDocumentsForFolder).map(docId =>
        moveDocumentToFolder({ folderId, documentId: docId })
      );
      await Promise.all(promises);
      setSelectedDocumentsForFolder(new Set());
      setShowDocumentSelector(null);
      if (onDocumentMoved) onDocumentMoved();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to add documents');
    } finally {
      setLoading(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocumentsForFolder(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const getDocumentsInFolder = (folderId: string) => {
    return documents.filter(doc => doc.folderId === folderId);
  };

  const getUnfolderedDocuments = () => {
    return documents.filter(doc => !doc.folderId);
  };

  return (
    <div className="folder-manager">
      <div className="folder-manager-header">
        <h3>Folders</h3>
        <button
          className="add-folder-button"
          onClick={() => setShowCreateModal(true)}
          title="Create New Folder"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Add Folder
        </button>
      </div>

      {error && (
        <div className="folder-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {error}
        </div>
      )}

      <div className="folders-list">
        {/* Root/Unfoldered Documents */}
        <div
          className="folder-item root"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className="folder-header">
            <svg className="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="folder-name">Root ({getUnfolderedDocuments().length})</span>
          </div>
        </div>

        {/* User Created Folders */}
        {folders.map(folder => {
          const folderDocs = getDocumentsInFolder(folder.id);
          const isExpanded = expandedFolders.has(folder.id);
          const isEditing = editingFolder?.id === folder.id;

          return (
            <div
              key={folder.id}
              className="folder-item"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div className="folder-header">
                <button
                  className="folder-toggle"
                  onClick={() => toggleFolder(folder.id)}
                  disabled={folderDocs.length === 0}
                >
                  <svg
                    className={`folder-chevron ${isExpanded ? 'expanded' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <svg className="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isEditing ? (
                  <input
                    type="text"
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    onBlur={() => handleUpdateFolder(folder.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateFolder(folder.id);
                      } else if (e.key === 'Escape') {
                        setEditingFolder(null);
                        setEditFolderName('');
                      }
                    }}
                    className="folder-edit-input"
                    autoFocus
                  />
                ) : (
                  <span
                    className="folder-name"
                    onDoubleClick={() => {
                      setEditingFolder(folder);
                      setEditFolderName(folder.name);
                    }}
                  >
                    {folder.name} ({folderDocs.length})
                  </span>
                )}
                <div className="folder-actions">
                  {onOpenFolder && folderDocs.length > 0 && (
                    <button
                      className="folder-action-btn open"
                      onClick={() => onOpenFolder(folder.id)}
                      title="Open folder and view summary"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Open
                    </button>
                  )}
                  <button
                    className="folder-action-btn add"
                    onClick={() => {
                      setShowDocumentSelector(folder.id);
                      setSelectedDocumentsForFolder(new Set());
                    }}
                    title="Add Documents to Folder"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="folder-action-btn"
                    onClick={() => {
                      setEditingFolder(folder);
                      setEditFolderName(folder.name);
                    }}
                    title="Rename Folder"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="folder-action-btn delete"
                    onClick={() => handleDeleteFolder(folder.id)}
                    title="Delete Folder"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {isExpanded && folderDocs.length > 0 && (
                <div className="folder-documents">
                  {folderDocs.map(doc => (
                    <div
                      key={doc.id}
                      className="folder-document-item"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', doc.id);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="document-name">{doc.filename}</span>
                      <button
                        className="remove-from-folder-btn"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await removeDocumentFromFolder(folder.id, doc.id);
                            if (onDocumentMoved) onDocumentMoved();
                          } catch (err: any) {
                            setError(err.response?.data?.message || err.message || 'Failed to remove document');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        title="Remove from folder"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Document Selector Modal */}
      {showDocumentSelector && (
        <div className="folder-modal-overlay" onClick={() => setShowDocumentSelector(null)}>
          <div className="folder-modal document-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="folder-modal-header">
              <h3>Add Documents to Folder</h3>
              <button className="modal-close" onClick={() => setShowDocumentSelector(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="folder-modal-content">
              <div className="document-selector-list">
                {documents
                  .filter(doc => doc.folderId !== showDocumentSelector)
                  .map(doc => (
                    <label key={doc.id} className="document-selector-item">
                      <input
                        type="checkbox"
                        checked={selectedDocumentsForFolder.has(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                      />
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="document-selector-name">{doc.filename}</span>
                    </label>
                  ))}
                {documents.filter(doc => doc.folderId !== showDocumentSelector).length === 0 && (
                  <div className="no-documents-message">
                    <p>No documents available to add to this folder.</p>
                  </div>
                )}
              </div>
              <div className="folder-modal-actions">
                <button className="cancel-btn" onClick={() => setShowDocumentSelector(null)}>
                  Cancel
                </button>
                <button
                  className="create-btn"
                  onClick={() => handleAddDocumentsToFolder(showDocumentSelector)}
                  disabled={loading || selectedDocumentsForFolder.size === 0}
                >
                  {loading ? 'Adding...' : `Add ${selectedDocumentsForFolder.size} Document${selectedDocumentsForFolder.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="folder-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="folder-modal" onClick={(e) => e.stopPropagation()}>
            <div className="folder-modal-header">
              <h3>Create New Folder</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="folder-modal-content">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  } else if (e.key === 'Escape') {
                    setShowCreateModal(false);
                  }
                }}
                className="folder-name-input"
                autoFocus
              />
              <div className="folder-modal-actions">
                <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button className="create-btn" onClick={handleCreateFolder} disabled={loading || !newFolderName.trim()}>
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
