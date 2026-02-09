import { useState, useRef, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { sendChatMessage, ChatResponse, getDocuments, Document } from '../api/client';
import { supportedLanguages } from '../utils/language';
import { formatConfidence } from '../utils/confidence';
import './ChatUI.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatResponse['citations'];
  sources?: string[];
  confidence?: number;
  serviceProviders?: ChatResponse['serviceProviders'];
}

interface ChatUIProps {
  preselectedDocumentIds?: string[];
}

export default function ChatUI({ preselectedDocumentIds = [] }: ChatUIProps) {
  const { location: userLocation } = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(preselectedDocumentIds);
  // const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [isDocumentDropdownOpen, setIsDocumentDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const documentDropdownRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load documents on mount
    loadDocuments();
  }, []);

  useEffect(() => {
    // Set preselected documents if provided
    if (preselectedDocumentIds.length > 0) {
      setSelectedDocumentIds(preselectedDocumentIds);
    }
  }, [preselectedDocumentIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (documentDropdownRef.current && !documentDropdownRef.current.contains(event.target as Node)) {
        setIsDocumentDropdownOpen(false);
      }
    };

    if (isDocumentDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDocumentDropdownOpen]);

  const toggleDocumentSelection = (docId: string) => {
    if (docId === '') {
      // "All Documents" option
      setSelectedDocumentIds([]);
    } else {
      setSelectedDocumentIds(prev => {
        if (prev.includes(docId)) {
          return prev.filter(id => id !== docId);
        } else {
          return [...prev, docId];
        }
      });
    }
  };

  const getSelectedDocumentsText = () => {
    if (selectedDocumentIds.length === 0) {
      return 'All Documents';
    }
    if (selectedDocumentIds.length === 1) {
      const doc = documents.find(d => d.id === selectedDocumentIds[0]);
      return doc ? doc.filename : '1 document selected';
    }
    return `${selectedDocumentIds.length} documents selected`;
  };

  const loadDocuments = async () => {
    // setLoadingDocuments(true);
    try {
      const response = await getDocuments();
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      // setLoadingDocuments(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage({
        question: input,
        language: selectedLanguage,
        topK: 5,
        documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        userLocation: userLocation || undefined,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        sources: response.sources,
        confidence: response.confidence,
        serviceProviders: response.serviceProviders,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.response?.data?.error || error.message || 'Failed to get response'}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-ui">
      <div className="chat-header">
        <div className="header-title-section">
          <h2>💬 Chat with Documents</h2>
          <p className="header-subtitle">Ask questions document-by-document or page-by-page; select one or multiple documents below.</p>
        </div>
        <div className="header-controls">
          <div className="document-selector" ref={documentDropdownRef}>
            
            <div className="document-dropdown-wrapper">
              <button
                type="button"
                className="document-dropdown-button"
                onClick={() => setIsDocumentDropdownOpen(!isDocumentDropdownOpen)}
                aria-expanded={isDocumentDropdownOpen}
              >
                <span className="dropdown-text">{getSelectedDocumentsText()}</span>
                <span className={`dropdown-arrow ${isDocumentDropdownOpen ? 'open' : ''}`}>▼</span>
              </button>
              {isDocumentDropdownOpen && (
                <div className="document-dropdown-menu">
                  <div className="dropdown-menu-header">
                    <span>Select documents to chat with</span>
                    {selectedDocumentIds.length > 0 && (
                      <button
                        type="button"
                        className="clear-selection-btn"
                        onClick={() => setSelectedDocumentIds([])}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="dropdown-menu-list">
                    <div
                      className={`dropdown-menu-item ${selectedDocumentIds.length === 0 ? 'selected' : ''}`}
                      onClick={() => toggleDocumentSelection('')}
                    >
                      <span className="checkbox">
                        {selectedDocumentIds.length === 0 && '✓'}
                      </span>
                      <span className="item-text">All Documents</span>
                    </div>
                    {documents.map(doc => {
                      const isSelected = selectedDocumentIds.includes(doc.id);
                      const riskBadgeClass = doc.riskLevel === 'Critical' ? 'risk-critical' :
                        doc.riskLevel === 'Warning' ? 'risk-warning' : 'risk-normal';
                      return (
                        <div
                          key={doc.id}
                          className={`dropdown-menu-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleDocumentSelection(doc.id)}
                        >
                          <span className="checkbox">{isSelected && '✓'}</span>
                          <span className="item-text">{doc.filename}</span>
                          <span className={`risk-badge-small ${riskBadgeClass}`}>{doc.riskLevel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {selectedDocumentIds.length > 0 && (
              <div className="selected-docs-chips">
                {selectedDocumentIds.slice(0, 3).map(docId => {
                  const doc = documents.find(d => d.id === docId);
                  return doc ? (
                    <span key={docId} className="doc-chip">
                      {doc.filename}
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => toggleDocumentSelection(docId)}
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
                {selectedDocumentIds.length > 3 && (
                  <span className="doc-chip more">+{selectedDocumentIds.length - 3} more</span>
                )}
              </div>
            )}
          </div>
          <div className="language-selector">
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="language-select"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <h3 className="empty-state-title">Ask questions about your uploaded documents</h3>
           <div className="empty-state-suggestions">
              <div className="suggestion-chip">💡 Try asking: "What are the main risks?"</div>
              <div className="suggestion-chip">📊 Try asking: "Summarize this document"</div>
              <div className="suggestion-chip">🔍 Try asking: "Find key terms"</div>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-content">
              {message.content}
            </div>

            {message.role === 'assistant' && message.confidence !== undefined && (
              <div className="message-confidence">
                <strong>Confidence:</strong> {formatConfidence(message.confidence)}
              </div>
            )}

            {message.role === 'assistant' && message.serviceProviders && message.serviceProviders.providers.length > 0 && (
              <div className="service-providers-in-chat">
                <div className="providers-header-chat">
                  <h4>🏢 {message.serviceProviders.message}</h4>
                  <p className="providers-subtitle">Here are recommended professionals near you:</p>
                </div>
                <div className="providers-list-chat">
                  {message.serviceProviders.providers.map((provider) => (
                    <div key={provider.id} className="provider-card-chat">
                      <div className="provider-header-chat">
                        <h5>{provider.name}</h5>
                        {provider.rating && (
                          <span className="provider-rating-chat">⭐ {provider.rating}</span>
                        )}
                      </div>
                      <div className="provider-type-chat">{provider.type}</div>
                      <div className="provider-contact-chat">
                        <a href={`tel:${provider.phone}`} className="contact-link-chat">
                          📞 {provider.phone}
                        </a>
                        {provider.email && (
                          <a href={`mailto:${provider.email}`} className="contact-link-chat">
                            ✉️ {provider.email}
                          </a>
                        )}
                        <div className="contact-text-chat">
                          📍 {provider.address}, {provider.city}
                        </div>
                        {provider.distance !== undefined && (
                          <div className="contact-text-chat">
                            📏 {provider.distance} km away
                          </div>
                        )}
                      </div>
                      <div className="provider-actions-chat">
                        <a href={`tel:${provider.phone}`} className="action-button-chat call">
                          📞 Call
                        </a>
                        {provider.email && (
                          <a href={`mailto:${provider.email}`} className="action-button-chat email">
                            ✉️ Email
                          </a>
                        )}
                        {provider.website && (
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-button-chat website"
                          >
                            🌐 Website
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
              <div className="message-sources">
                <strong>Sources:</strong> {message.sources.join(', ')}
              </div>
            )}

            {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
              <details className="citations">
                <summary>View Citations ({message.citations.length})</summary>
                <div className="citations-list">
                  {message.citations.map((citation, idx) => (
                    <div key={idx} className="citation-item">
                      <div className="citation-header">
                        <span className="citation-filename">{citation.filename}</span>
                        <span className="citation-similarity">
                          {citation.confidence !== undefined
                            ? `${formatConfidence(citation.confidence)} confidence`
                            : `${(citation.similarity * 100).toFixed(1)}% match`}
                        </span>
                      </div>
                      <div className="citation-content">{citation.content}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about your documents..."
          className="chat-input"
          rows={3}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="send-button"
        >
          Send
        </button>
      </div>
    </div>
  );
}
