import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDocuments, Document, explainDocument, getFolders, Folder, renameDocument, type FinanceToolId } from '../api/client';
import { formatConfidence } from '../utils/confidence';
import ServiceProviderModal from './ServiceProviderModal';
import DocumentExplanationModal from './DocumentExplanationModal';
import ShareDocumentModal from './ShareDocumentModal';
import ChatModal from './ChatModal';
import WhatIfSimulator from './WhatIfSimulator';
import VoiceMode from './VoiceMode';
import TrustScore from './TrustScore';
import AgentSwarm from './AgentSwarm';
import FolderManager from './FolderManager';
import FinanceToolsModal from './FinanceToolsModal';
import './DocumentList.css';

export interface DocumentListProps {
  searchQuery?: string;
  compact?: boolean;
  /** When set, open Finance Tools modal with this tool and documents preselected (e.g. from Upload page). */
  openFinanceTool?: { toolId: FinanceToolId; documentIds: string[] };
  onFinanceToolsClose?: () => void;
}

export default function DocumentList(props: DocumentListProps = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedDocumentForShare, setSelectedDocumentForShare] = useState<Document | null>(null);
  const [selectedDocumentForChat, setSelectedDocumentForChat] = useState<Document | null>(null);
  const [explanationData, setExplanationData] = useState<{
    documentName: string;
    explanation: string;
    riskLevel: 'Critical' | 'Warning' | 'Normal';
    riskCategory?: string;
  } | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);
  const [selectedDocumentForWhatIf, setSelectedDocumentForWhatIf] = useState<Document | null>(null);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [selectedDocumentsForVoice, setSelectedDocumentsForVoice] = useState<Document[]>([]);
  const [isTrustScoreOpen, setIsTrustScoreOpen] = useState(false);
  const [selectedDocumentForTrustScore, setSelectedDocumentForTrustScore] = useState<Document | null>(null);
  const [isAgentSwarmOpen, setIsAgentSwarmOpen] = useState(false);
  const [selectedDocumentForAgentSwarm, setSelectedDocumentForAgentSwarm] = useState<Document | null>(null);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const infoTooltipRef = useRef<HTMLDivElement>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedRiskLevelFilter, setSelectedRiskLevelFilter] = useState<string>('all');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState<string>('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [folderSummaryExpanded, setFolderSummaryExpanded] = useState(true);
  const documentsGridRef = useRef<HTMLDivElement>(null);
  const [isFinanceToolsOpen, setIsFinanceToolsOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (props.openFinanceTool?.documentIds?.length && props.openFinanceTool?.toolId) {
      setIsFinanceToolsOpen(true);
    }
  }, [props.openFinanceTool?.toolId, props.openFinanceTool?.documentIds?.length]);

  useEffect(() => {
    loadDocuments();
    loadFolders();
  }, []);

  useEffect(() => {
    const folderId = searchParams.get('folder');
    if (folderId) setSelectedFolderFilter(folderId);
  }, [searchParams]);

  const loadFolders = async () => {
    try {
      const response = await getFolders();
      setFolders(response.folders);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        infoTooltipRef.current &&
        !infoTooltipRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.info-button')
      ) {
        setShowInfoTooltip(false);
      }
    };

    if (showInfoTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showInfoTooltip]);

  const visibleDocuments = useMemo(() => {
    let filtered = documents;

    // Apply search query
    const q = (searchQuery || props.searchQuery || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((d) => (d.filename || '').toLowerCase().includes(q));
    }

    // Apply folder filter
    if (selectedFolderFilter !== 'all') {
      if (selectedFolderFilter === 'none') {
        filtered = filtered.filter((d) => !d.folderId);
      } else {
        filtered = filtered.filter((d) => d.folderId === selectedFolderFilter);
      }
    }

    // Apply category filter
    if (selectedCategoryFilter !== 'all') {
      filtered = filtered.filter((d) => {
        if (selectedCategoryFilter === 'none') {
          return !d.riskCategory || d.riskCategory === 'None';
        }
        return d.riskCategory === selectedCategoryFilter;
      });
    }

    // Apply risk level filter
    if (selectedRiskLevelFilter !== 'all') {
      filtered = filtered.filter((d) => d.riskLevel === selectedRiskLevelFilter);
    }

    return filtered;
  }, [documents, searchQuery, props.searchQuery, selectedFolderFilter, selectedCategoryFilter, selectedRiskLevelFilter]);

  const getFolderName = (folderId: string | null | undefined): string => {
    if (!folderId) return '';
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : '';
  };

  const documentsInSelectedFolder = useMemo(() => {
    if (selectedFolderFilter === 'all' || selectedFolderFilter === 'none') return [];
    const q = (searchQuery || props.searchQuery || '').trim().toLowerCase();
    let list = documents.filter((d) => d.folderId === selectedFolderFilter);
    if (q) list = list.filter((d) => (d.filename || '').toLowerCase().includes(q));
    return list;
  }, [documents, selectedFolderFilter, searchQuery, props.searchQuery]);

  const folderSummary = useMemo(() => {
    if (selectedFolderFilter === 'all' || selectedFolderFilter === 'none' || documentsInSelectedFolder.length === 0) return null;
    const critical = documentsInSelectedFolder.filter((d) => d.riskLevel === 'Critical');
    const warning = documentsInSelectedFolder.filter((d) => d.riskLevel === 'Warning');
    const normal = documentsInSelectedFolder.filter((d) => d.riskLevel === 'Normal');
    return {
      folderName: getFolderName(selectedFolderFilter),
      critical: critical.length,
      warning: warning.length,
      normal: normal.length,
      total: documentsInSelectedFolder.length,
      needAttention: critical.length + warning.length,
      byStatus: { Critical: critical, Warning: warning, Normal: normal } as const,
    };
  }, [selectedFolderFilter, documentsInSelectedFolder, folders]);

  const RISK_ORDER: Record<string, number> = { Critical: 0, Warning: 1, Normal: 2 };
  const displayDocuments = useMemo(() => {
    if (selectedFolderFilter !== 'all' && selectedFolderFilter !== 'none') {
      return [...visibleDocuments].sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 2) - (RISK_ORDER[b.riskLevel] ?? 2));
    }
    return visibleDocuments;
  }, [visibleDocuments, selectedFolderFilter]);

  const handleStartRename = (document: Document) => {
    setEditingDocumentId(document.id);
    setEditingFilename(document.filename);
  };

  const handleCancelRename = () => {
    setEditingDocumentId(null);
    setEditingFilename('');
  };

  const handleSaveRename = async (documentId: string) => {
    if (!editingFilename.trim()) {
      setError('Filename cannot be empty');
      return;
    }

    try {
      await renameDocument(documentId, editingFilename.trim());
      setEditingDocumentId(null);
      setEditingFilename('');
      await loadDocuments();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to rename document');
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDocuments();
      setDocuments(response.documents);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleChatWithDocument = (document: Document) => {
    // Open chat modal with document
    setSelectedDocumentForChat(document);
    setIsChatModalOpen(true);
  };

  const handleShowProviders = (document: Document) => {
    // Show providers for Critical documents OR if category is set
    if (document.riskLevel === 'Critical' || (document.riskCategory && document.riskCategory !== 'None')) {
      setSelectedDocument(document);
      setIsModalOpen(true);
    }
  };
  
  // Determine category for service providers
  const getProviderCategory = (document: Document): 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical' | 'None' => {
    if (document.riskCategory && document.riskCategory !== 'None') {
      return document.riskCategory as 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical' | 'None';
    }
    
    // For Critical documents without category, infer from filename
    if (document.riskLevel === 'Critical') {
      const filename = document.filename?.toLowerCase() || '';
      if (filename.includes('prescription') || filename.includes('medical') || filename.includes('doctor') || filename.includes('health')) {
        return 'Medical';
      } else if (filename.includes('contract') || filename.includes('legal') || filename.includes('agreement')) {
        return 'Legal';
      } else if (filename.includes('financial') || filename.includes('tax') || filename.includes('invoice')) {
        return 'Financial';
      } else {
        return 'Legal'; // Default for Critical documents
      }
    }
    
    return 'None';
  };

  const handleShareDocument = (document: Document) => {
    setSelectedDocumentForShare(document);
    setIsShareModalOpen(true);
  };

  const handleExplainDocument = async (doc: Document) => {
    setLoadingExplanation(true);
    try {
      const explanation = await explainDocument({
        documentId: doc.id,
        language: 'en',
      });
      setExplanationData({
        documentName: doc.filename,
        explanation: explanation.explanation,
        riskLevel: doc.riskLevel as 'Critical' | 'Warning' | 'Normal',
        riskCategory: doc.riskCategory,
      });
      setIsExplanationModalOpen(true);
    } catch (err: any) {
      console.error('Failed to get explanation:', err);
      alert('Failed to generate explanation. Please try again.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  /** Two-line explanation for why the document is in this risk status (shown on card). */
  const getStatusExplanation = (doc: Document): string => {
    const cat = doc.riskCategory && doc.riskCategory !== 'None' ? doc.riskCategory : null;
    if (doc.riskLevel === 'Critical') {
      if (cat === 'Legal') return 'Contains high-risk legal clauses (e.g. uncapped liability, broad indemnity) that may expose the organization.';
      if (cat === 'Financial') return 'Identified financial risks such as unclear pricing, missing terms, or compliance gaps that need review.';
      if (cat === 'Compliance') return 'Compliance or regulatory concerns detected. Recommended for legal or compliance review before signing.';
      if (cat === 'Operational') return 'Operational or contractual risks identified that could impact delivery, SLAs, or obligations.';
      return 'High-risk content detected. Professional review recommended before proceeding.';
    }
    if (doc.riskLevel === 'Warning') {
      if (cat) return `Moderate risk in ${cat} category. Review suggested to address potential issues.`;
      return 'Some concerns detected. Worth a quick review to ensure nothing is missed.';
    }
    if (cat) return `Classified as ${cat}. No significant risks flagged; standard review applies.`;
    return 'No significant risks detected. Document appears to be in good order.';
  };

  const getRiskBadgeClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical':
        return 'risk-critical';
      case 'Warning':
        return 'risk-warning';
      default:
        return 'risk-normal';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="document-list">
        <div className="loading">
          <svg className="loading-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32">
              <animate attributeName="stroke-dasharray" values="0 32;16 16;0 32;0 32" dur="1.5s" repeatCount="indefinite"/>
              <animate attributeName="stroke-dashoffset" values="0;-16;-32;-32" dur="1.5s" repeatCount="indefinite"/>
            </circle>
          </svg>
          Loading documents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-list">
        <div className="error-message">
          <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
        <button onClick={loadDocuments} className="retry-button">
          <svg className="retry-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 12a9 9 0 0118 0M21 12a9 9 0 00-18 0" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 3v6m0 6v6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="document-list">
      <FolderManager
        documents={documents}
        onDocumentMoved={loadDocuments}
        onOpenFolder={(folderId) => {
          setSelectedFolderFilter(folderId);
          setSearchParams({ folder: folderId });
        }}
      />
      <div className="document-list-header">
        <div className="header-content">
          <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="2"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeWidth="2"/>
          </svg>
          <h3>Uploaded Documents ({documents.length})</h3>
        </div>
        <div className="header-actions">
          <div className="info-button-wrapper">
            <button
              onClick={() => setShowInfoTooltip(!showInfoTooltip)}
              className="info-button"
              title="Document information"
              aria-label="Show document information"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showInfoTooltip && (
              <div className="info-tooltip" ref={infoTooltipRef}>
                <div className="tooltip-header">
                  <h4>Document Information</h4>
                  <button
                    className="tooltip-close"
                    onClick={() => setShowInfoTooltip(false)}
                    aria-label="Close"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div className="tooltip-content">
                  <div className="tooltip-section">
                    <h5>Risk Level Tags</h5>
                    <div className="tag-info">
                      <div className="tag-info-item">
                        <span className="risk-badge risk-critical">CRITICAL</span>
                        <p>High-risk documents requiring immediate attention. May contain sensitive legal, financial, or compliance issues.</p>
                      </div>
                      <div className="tag-info-item">
                        <span className="risk-badge risk-warning">WARNING</span>
                        <p>Documents with potential risks or concerns that should be reviewed carefully.</p>
                      </div>
                      <div className="tag-info-item">
                        <span className="risk-badge risk-normal">NORMAL</span>
                        <p>Standard documents with no significant risks detected.</p>
                      </div>
                    </div>
                  </div>
                  <div className="tooltip-section">
                    <h5>Action Buttons</h5>
                    <div className="button-info-list">
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Chat</span>
                        </div>
                        <p>Ask questions and get AI-powered answers about your document</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Explain</span>
                        </div>
                        <p>Get a detailed explanation of the document in your preferred language</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Share</span>
                        </div>
                        <p>Share document via social media or copy link</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
                            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">What If</span>
                        </div>
                        <p>Simulate consequences of different actions or scenarios</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Voice</span>
                        </div>
                        <p>Ask questions using voice - AI will respond verbally</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3v18h18M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Trust Score</span>
                        </div>
                        <p>View overall document trustworthiness score and analysis</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Agent Swarm</span>
                        </div>
                        <p>Deploy autonomous AI agents to analyze and extract key information</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Check Missing</span>
                        </div>
                        <p>Identify missing elements and what should be present in the document</p>
                      </div>
                      <div className="button-info-item">
                        <div className="button-info-header">
                          <svg className="button-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="button-info-name">Solution Providers</span>
                        </div>
                        <p>Find professional service providers near you (shown for Critical documents)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {!props.compact && (
            <>
              <button
                type="button"
                onClick={() => setIsFinanceToolsOpen(true)}
                className="finance-tools-header-btn"
                title="Tax, reconciliation, fraud detection & more"
              >
                <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Finance & Tax Tools
              </button>
              <button onClick={loadDocuments} className="refresh-button" title="Refresh list">
                <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 12a9 9 0 0118 0M21 12a9 9 0 00-18 0" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 3v6m0 6v6" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters — only show when there are documents */}
      {documents.length > 0 && (
        <div className={`document-filters ${props.compact ? 'document-filters-mobile' : ''}`}>
          {props.compact && (
            <div className="document-filters-mobile-icons">
              <button
                type="button"
                className={`m-filter-icon-btn ${showMobileSearch ? 'active' : ''}`}
                onClick={() => setShowMobileSearch((s) => !s)}
                aria-label="Toggle search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Search</span>
              </button>
              <button
                type="button"
                className={`m-filter-icon-btn ${showMobileFilters ? 'active' : ''}`}
                onClick={() => setShowMobileFilters((s) => !s)}
                aria-label="Toggle filters"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Filters</span>
              </button>
            </div>
          )}
          {(showMobileSearch || !props.compact) && (
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          )}
          {(showMobileFilters || !props.compact) && (
          <div className="filter-group">
            <div className="filter-item">
              <label htmlFor="folder-filter" className="filter-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Folder
              </label>
              <select
                id="folder-filter"
                value={selectedFolderFilter}
                onChange={(e) => setSelectedFolderFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Folders</option>
                <option value="none">Root (No Folder)</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="category-filter" className="filter-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Category
              </label>
              <select
                id="category-filter"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                <option value="none">No Category</option>
                <option value="Legal">Legal</option>
                <option value="Financial">Financial</option>
                <option value="Compliance">Compliance</option>
                <option value="Operational">Operational</option>
                <option value="Medical">Medical</option>
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="risk-level-filter" className="filter-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Risk Level
              </label>
              <select
                id="risk-level-filter"
                value={selectedRiskLevelFilter}
                onChange={(e) => setSelectedRiskLevelFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Risk Levels</option>
                <option value="Critical">Critical</option>
                <option value="Warning">Warning</option>
                <option value="Normal">Normal</option>
              </select>
            </div>
          </div>
          )}
          {folderSummary && (
            <div className="folder-summary-card">
              <div className="folder-summary-header">
                <div className="folder-summary-title">
                  <svg className="folder-summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{folderSummary.folderName}</span>
                </div>
                <button
                  type="button"
                  className="folder-summary-toggle"
                  onClick={() => setFolderSummaryExpanded((e) => !e)}
                  aria-expanded={folderSummaryExpanded}
                >
                  {folderSummaryExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div className="folder-summary-stats">
                <div className="folder-stat critical">
                  <span className="folder-stat-value">{folderSummary.critical}</span>
                  <span className="folder-stat-label">Critical</span>
                </div>
                <div className="folder-stat warning">
                  <span className="folder-stat-value">{folderSummary.warning}</span>
                  <span className="folder-stat-label">Warning</span>
                </div>
                <div className="folder-stat normal">
                  <span className="folder-stat-value">{folderSummary.normal}</span>
                  <span className="folder-stat-label">Normal</span>
                </div>
                <div className="folder-stat total">
                  <span className="folder-stat-value">{folderSummary.total}</span>
                  <span className="folder-stat-label">Total</span>
                </div>
                {folderSummary.needAttention > 0 && (
                  <div className="folder-stat need-attention">
                    <span className="folder-stat-value">{folderSummary.needAttention}</span>
                    <span className="folder-stat-label">Need attention</span>
                  </div>
                )}
              </div>
              <div className="folder-summary-quick-filters">
                <button
                  type="button"
                  className={`folder-filter-chip ${selectedRiskLevelFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedRiskLevelFilter('all')}
                >
                  All ({folderSummary.total})
                </button>
                {folderSummary.critical > 0 && (
                  <button
                    type="button"
                    className={`folder-filter-chip critical ${selectedRiskLevelFilter === 'Critical' ? 'active' : ''}`}
                    onClick={() => setSelectedRiskLevelFilter(selectedRiskLevelFilter === 'Critical' ? 'all' : 'Critical')}
                  >
                    Critical ({folderSummary.critical})
                  </button>
                )}
                {folderSummary.warning > 0 && (
                  <button
                    type="button"
                    className={`folder-filter-chip warning ${selectedRiskLevelFilter === 'Warning' ? 'active' : ''}`}
                    onClick={() => setSelectedRiskLevelFilter(selectedRiskLevelFilter === 'Warning' ? 'all' : 'Warning')}
                  >
                    Warning ({folderSummary.warning})
                  </button>
                )}
                {folderSummary.normal > 0 && (
                  <button
                    type="button"
                    className={`folder-filter-chip normal ${selectedRiskLevelFilter === 'Normal' ? 'active' : ''}`}
                    onClick={() => setSelectedRiskLevelFilter(selectedRiskLevelFilter === 'Normal' ? 'all' : 'Normal')}
                  >
                    Normal ({folderSummary.normal})
                  </button>
                )}
              </div>
              {folderSummaryExpanded && (
                <div className="folder-summary-by-status">
                  <p className="folder-summary-by-status-title">Documents by status</p>
                  {(['Critical', 'Warning', 'Normal'] as const).map((status) =>
                    folderSummary.byStatus[status].length > 0 ? (
                      <div key={status} className={`folder-status-group ${status.toLowerCase()}`}>
                        <span className="folder-status-label">{status}</span>
                        <ul className="folder-status-doc-list">
                          {folderSummary.byStatus[status].map((doc) => (
                            <li key={doc.id}>
                              <button
                                type="button"
                                className="folder-doc-link"
                                onClick={() => documentsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                              >
                                {doc.filename}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  )}
                </div>
              )}
              <div className="folder-summary-actions">
                <button
                  type="button"
                  className="folder-open-docs-btn"
                  onClick={() => documentsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Open documents
                </button>
              </div>
            </div>
          )}
          {selectedFolderFilter !== 'all' && selectedFolderFilter !== 'none' && visibleDocuments.length > 0 && (
            <div className="folder-actions-bar">
              <p className="folder-actions-hint">
                Use these with the whole folder, or use Chat / Explain / Share / What If / Voice / Trust Score / Agent Swarm on each document below.
              </p>
              <div className="folder-actions-buttons">
                <Link
                  to={`/chat?documents=${visibleDocuments.map((d) => d.id).join(',')}`}
                  className="chat-folder-cta-link"
                >
                  Chat with all {visibleDocuments.length} in folder
                </Link>
                <button
                  type="button"
                  className="chat-folder-cta-link voice-folder-btn"
                  onClick={() => {
                    setSelectedDocumentsForVoice(visibleDocuments);
                    setIsVoiceModeOpen(true);
                  }}
                >
                  Voice with all {visibleDocuments.length} in folder
                </button>
                <button
                  type="button"
                  className="chat-folder-cta-link voice-folder-btn"
                  onClick={() => {
                    setIsFinanceToolsOpen(true);
                  }}
                >
                  Finance & Tax Tools ({visibleDocuments.length} docs)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {visibleDocuments.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="2"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeWidth="2"/>
          </svg>
          <p>{documents.length === 0 ? 'No documents uploaded yet.' : 'No results.'}</p>
          <p className="hint">{documents.length === 0 ? 'Upload a file to get started!' : 'Try a different search.'}</p>
        </div>
      ) : (
        <div className="documents-grid" ref={documentsGridRef}>
          {displayDocuments.map((doc) => (
            <div
              key={doc.id}
              className="document-card"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', doc.id);
              }}
            >
              <div className="document-card-header">
                {editingDocumentId === doc.id ? (
                  <div className="document-rename-input-wrapper">
                    <input
                      type="text"
                      value={editingFilename}
                      onChange={(e) => setEditingFilename(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveRename(doc.id);
                        } else if (e.key === 'Escape') {
                          handleCancelRename();
                        }
                      }}
                      onBlur={() => handleSaveRename(doc.id)}
                      className="document-rename-input"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename(doc.id)}
                      className="rename-save-btn"
                      title="Save"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelRename}
                      className="rename-cancel-btn"
                      title="Cancel"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
                        <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="document-filename-wrapper">
                    <div 
                      className="document-filename" 
                      title={doc.filename}
                      onDoubleClick={() => handleStartRename(doc)}
                    >
                      {doc.filename.length > 40 
                        ? doc.filename.substring(0, 40) + '...' 
                        : doc.filename}
                    </div>
                    <button
                      onClick={() => handleStartRename(doc)}
                      className="rename-button"
                      title="Rename document"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                )}
                <span className={`risk-badge ${getRiskBadgeClass(doc.riskLevel)}`}>
                  {doc.riskLevel}
                </span>
              </div>
              
              <div className="document-card-body">
                <p className="document-status-explanation">{getStatusExplanation(doc)}</p>
                <div className="document-meta">
                  {doc.folderId && (
                    <div className="meta-item folder-meta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="meta-label">Folder:</span>
                      <span className="meta-value folder-name">{getFolderName(doc.folderId)}</span>
                    </div>
                  )}
                  <div className="meta-item">
                    <span className="meta-label">Uploaded:</span>
                    <span className="meta-value">{formatDate(doc.uploadedAt)}</span>
                  </div>
                  {doc.riskCategory && doc.riskCategory !== 'None' && (
                    <div className="meta-item">
                      <span className="meta-label">Category:</span>
                      <span className="meta-value">{doc.riskCategory}</span>
                    </div>
                  )}
                  {doc.riskConfidence !== undefined && (
                    <div className="meta-item">
                      <span className="meta-label">Confidence:</span>
                      <span className="meta-value">{formatConfidence(doc.riskConfidence)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="document-card-actions">
                <button
                  onClick={() => handleChatWithDocument(doc)}
                  className="chat-button"
                  title="Chat with this document"
                >
                  <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeWidth="2"/>
                  </svg>
                  Chat
                </button>
                <button
                  onClick={() => handleExplainDocument(doc)}
                  className="explain-button"
                  title="Listen to document explanation"
                  disabled={loadingExplanation}
                >
                  {loadingExplanation ? (
                    <>
                      <svg className="button-icon spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32">
                          <animate attributeName="stroke-dasharray" values="0 32;16 16;0 32;0 32" dur="1.5s" repeatCount="indefinite"/>
                          <animate attributeName="stroke-dashoffset" values="0;-16;-32;-32" dur="1.5s" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeWidth="2"/>
                      </svg>
                      Explain
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleShareDocument(doc)}
                  className="share-button"
                  title="Share document"
                >
                  <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Share
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentForWhatIf(doc);
                    setIsWhatIfOpen(true);
                  }}
                  className="what-if-button"
                  title="What If Simulator"
                >
                  <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <path d="M12 16v-4M12 8h.01" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  What If
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentsForVoice([doc]);
                    setIsVoiceModeOpen(true);
                  }}
                  className="voice-button"
                  title="Voice-First Mode"
                >
                  <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeWidth="2"/>
                  </svg>
                  Voice
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentForTrustScore(doc);
                    setIsTrustScoreOpen(true);
                  }}
                  className="trust-score-button"
                  title="Document Trust Score"
                >
                  <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 3v18h18M7 16l4-4 4 4 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Trust Score
                </button>
                <button
                  onClick={() => {
                    setSelectedDocumentForAgentSwarm(doc);
                    setIsAgentSwarmOpen(true);
                  }}
                  className="agent-swarm-button"
                  title="Autonomous Agent Swarm"
                >
                  <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Agent Swarm
                </button>
                {(doc.riskLevel === 'Critical' || (doc.riskCategory && doc.riskCategory !== 'None')) && (
                  <button
                    onClick={() => handleShowProviders(doc)}
                    className="provider-button"
                    title="Find solution providers"
                  >
                    <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Solution Providers
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Provider Modal */}
      {selectedDocument && (
        <ServiceProviderModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDocument(null);
          }}
          category={getProviderCategory(selectedDocument)}
          riskExplanation={
            selectedDocument.riskCategory && selectedDocument.riskCategory !== 'None'
              ? `This document has been classified as ${selectedDocument.riskCategory} based on its content and risk analysis.`
              : selectedDocument.riskLevel === 'Critical'
              ? `This document has been classified as Critical risk level. Professional review is recommended.`
              : undefined
          }
          documentName={selectedDocument.filename}
        />
      )}

      {/* Document Explanation Modal */}
      {explanationData && (
        <DocumentExplanationModal
          isOpen={isExplanationModalOpen}
          onClose={() => {
            setIsExplanationModalOpen(false);
            setExplanationData(null);
          }}
          documentName={explanationData.documentName}
          explanation={explanationData.explanation}
          riskLevel={explanationData.riskLevel}
          riskCategory={explanationData.riskCategory}
        />
      )}

      {/* Share Document Modal */}
      {selectedDocumentForShare && (
        <ShareDocumentModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setSelectedDocumentForShare(null);
          }}
          document={selectedDocumentForShare}
          companyName="Aegis AI"
        />
      )}

      {/* Chat Modal */}
      {selectedDocumentForChat && (
        <ChatModal
          isOpen={isChatModalOpen}
          onClose={() => {
            setIsChatModalOpen(false);
            setSelectedDocumentForChat(null);
          }}
          document={selectedDocumentForChat}
        />
      )}

      {/* What If Simulator */}
      {selectedDocumentForWhatIf && (
        <WhatIfSimulator
          isOpen={isWhatIfOpen}
          onClose={() => {
            setIsWhatIfOpen(false);
            setSelectedDocumentForWhatIf(null);
          }}
          documentId={selectedDocumentForWhatIf.id}
          documentName={selectedDocumentForWhatIf.filename}
        />
      )}

      {/* Voice Mode */}
      <VoiceMode
        isOpen={isVoiceModeOpen}
        onClose={() => {
          setIsVoiceModeOpen(false);
          setSelectedDocumentsForVoice([]);
        }}
        documentIds={selectedDocumentsForVoice.map(d => d.id)}
      />

      {/* Trust Score */}
      {selectedDocumentForTrustScore && (
        <TrustScore
          isOpen={isTrustScoreOpen}
          documentId={selectedDocumentForTrustScore.id}
          documentName={selectedDocumentForTrustScore.filename}
          onClose={() => {
            setIsTrustScoreOpen(false);
            setSelectedDocumentForTrustScore(null);
          }}
        />
      )}

      {/* Agent Swarm */}
      {selectedDocumentForAgentSwarm && (
        <AgentSwarm
          isOpen={isAgentSwarmOpen}
          onClose={() => {
            setIsAgentSwarmOpen(false);
            setSelectedDocumentForAgentSwarm(null);
          }}
          documentId={selectedDocumentForAgentSwarm.id}
          documentName={selectedDocumentForAgentSwarm.filename}
        />
      )}

      {/* Finance & Tax Tools */}
      <FinanceToolsModal
        isOpen={isFinanceToolsOpen}
        onClose={() => {
          setIsFinanceToolsOpen(false);
          props.onFinanceToolsClose?.();
        }}
        documents={documents}
        preselectedDocumentIds={
          props.openFinanceTool?.documentIds?.length
            ? props.openFinanceTool.documentIds
            : selectedFolderFilter !== 'all' && selectedFolderFilter !== 'none' && visibleDocuments.length > 0
              ? visibleDocuments.map((d) => d.id)
              : []
        }
        initialToolId={props.openFinanceTool?.toolId}
      />
    </div>
  );
}
