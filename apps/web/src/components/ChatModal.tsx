import { useState, useRef, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { sendChatMessage, ChatResponse, Document, getDocumentContent, getQuickQuestions } from '../api/client';
import { supportedLanguages, getLanguageName } from '../utils/language';
import { formatConfidence } from '../utils/confidence';
import './ChatModal.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatResponse['citations'];
  sources?: string[];
  confidence?: number;
  serviceProviders?: ChatResponse['serviceProviders'];
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
}

export default function ChatModal({ isOpen, onClose, document }: ChatModalProps) {
  const { location: userLocation } = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [loadingContent, setLoadingContent] = useState(true);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load document content when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDocumentContent();
    }
  }, [isOpen, document.id]);

  const loadDocumentContent = async () => {
    setLoadingContent(true);
    setPdfError(false);
    try {
      // Load text content as fallback (always available from chunks)
      const response = await getDocumentContent(document.id);
      setDocumentContent(response.content);
    } catch (error) {
      console.error('Failed to load document content:', error);
      setDocumentContent(null);
    } finally {
      setLoadingContent(false);
    }
  };

  const handlePdfError = () => {
    // If PDF fails to load, show text content as fallback
    setPdfError(true);
    setLoadingContent(false);
  };

  // Initialize with a welcome message and load quick questions when modal opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Generate a contextual welcome message based on document
      generateWelcomeMessage();

      // Load quick questions
      loadQuickQuestions();
    }
  }, [isOpen, document.filename]);

  const generateWelcomeMessage = () => {
    // Simple welcome message - will be enhanced by quick questions
    const welcomeMessage: Message = {
      role: 'assistant',
      content: `Hey there! I've loaded "${document.filename}" and I'm ready to help you understand it. What would you like to know?`,
    };
    setMessages([welcomeMessage]);
  };

  const loadQuickQuestions = async () => {
    try {
      const response = await getQuickQuestions(document.id);
      setQuickQuestions(response.questions || []);
    } catch (error) {
      console.error('Failed to load quick questions:', error);
      // Fallback questions based on document type
      const filename = document.filename.toLowerCase();
      if (filename.includes('appointment') || filename.includes('prescription')) {
        setQuickQuestions([
          `Summarize this ${document.filename}`,
          'What should I bring along for this appointment?',
          'What details confirm my payment is complete?',
          'When is my next appointment?',
          'What are the important instructions?'
        ]);
      } else {
        setQuickQuestions([
          `Summarize this ${document.filename}`,
          'What are the key points?',
          'What should I do next?',
          'What are the important details?',
          'Explain the main content'
        ]);
      }
    } finally {
      // Done
    }
  };

  // Reset messages and content when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setDocumentContent(null);
    }
  }, [isOpen]);

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
        documentIds: [document.id],
        userLocation: userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined,
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
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.response?.data?.error || error.message || 'Unknown error'}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <h2>Chat with Document</h2>
          <button className="chat-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="chat-modal-content">
          {/* Left Side - Document Viewer */}
          <div className="chat-modal-document-viewer">
            {loadingContent ? (
              <div className="document-loading">
                <div className="loading-spinner"></div>
                <p>Loading document...</p>
              </div>
            ) : pdfError ? (
              <div className="document-text-viewer">
                <div className="document-text-content">
                  {documentContent ? documentContent.split('\n').map((paragraph, index) => (
                    paragraph.trim() && (
                      <p key={index} className="document-paragraph">
                        {paragraph}
                      </p>
                    )
                  )) : (
                    <div className="document-error">
                      <p>PDF file not available for this document.</p>
                      <p className="error-hint">This document was uploaded before file storage was enabled. Please re-upload the document to view it as PDF.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="document-pdf-viewer">
                <object
                  data={`${import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:3001')}/api/documents/${document.id}/file#toolbar=0&navpanes=0`}
                  type="application/pdf"
                  className="pdf-object"
                  title={document.filename}
                  onError={handlePdfError}
                >
                  <iframe
                    src={`${import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:3001')}/api/documents/${document.id}/file#toolbar=0&navpanes=0&scrollbar=1`}
                    className="pdf-iframe"
                    title={document.filename}
                    onError={handlePdfError}
                    onLoad={(e) => {
                      // Check if iframe loaded an error page (JSON response)
                      setTimeout(() => {
                        try {
                          const iframe = e.currentTarget;
                          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                          if (iframeDoc) {
                            const bodyText = iframeDoc.body?.innerText || '';
                            if (bodyText.includes('"error"') || bodyText.includes('not found') || bodyText.includes('not available')) {
                              handlePdfError();
                            }
                          }
                        } catch (err) {
                          // Cross-origin - can't check, assume it's loading
                        }
                      }, 500);
                    }}
                  />
                </object>
              </div>
            )}
          </div>

          {/* Right Side - Chat Interface */}
          <div className="chat-modal-chat-panel">
            <div className="chat-panel-header">
              <div className="language-selector-inline">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="language-select-small"
                >
                  {supportedLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {getLanguageName(lang.code)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="chat-messages-container">
              {messages.length === 0 && (
                <div className="chat-empty-state">
                  <div className="empty-state-icon">💬</div>
                  <div className="empty-state-title">Start a conversation</div>
                  <div className="empty-state-hint">Ask me anything about this document</div>
                  <div className="suggestion-chips">
                    <button
                      className="suggestion-chip"
                      onClick={() => handleSuggestionClick('Summarize this document')}
                    >
                      📋 Summarize this document
                    </button>
                    <button
                      className="suggestion-chip"
                      onClick={() => handleSuggestionClick('What are the key points?')}
                    >
                      🔑 What are the key points?
                    </button>
                    <button
                      className="suggestion-chip"
                      onClick={() => handleSuggestionClick('Explain the main content')}
                    >
                      💡 Explain the main content
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  {message.role === 'assistant' && index === 0 && (
                    <div className="ai-avatar">A</div>
                  )}
                  <div className="chat-message-content-wrapper">
                    <div className="chat-message-content">
                      {message.content}
                    </div>

                    {/* Show quick questions after first assistant message */}
                    {message.role === 'assistant' && index === 0 && quickQuestions.length > 0 && (
                      <div className="quick-questions-section">
                        <div className="quick-questions-buttons">
                          {quickQuestions.slice(0, 3).map((question, qIndex) => (
                            <button
                              key={qIndex}
                              className={`quick-question-btn ${qIndex === 0 ? 'primary' : 'secondary'}`}
                              onClick={() => handleSuggestionClick(question)}
                              disabled={loading}
                            >
                              {qIndex === 0 && <span className="question-icon">✓</span>}
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.role === 'assistant' && message.confidence !== undefined && (
                      <div className="message-confidence">
                        Confidence: {formatConfidence(message.confidence)}
                      </div>
                    )}
                  </div>

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

                  {message.role === 'assistant' && message.serviceProviders && (
                    <div className="service-providers-in-chat">
                      <div className="providers-header-chat">
                        <h4>{message.serviceProviders.message}</h4>
                        <p className="providers-subtitle">Category: {message.serviceProviders.category}</p>
                      </div>
                      <div className="providers-list-chat">
                        {message.serviceProviders.providers.slice(0, 3).map((provider) => (
                          <div key={provider.id} className="provider-card-chat">
                            <div className="provider-header-chat">
                              <h5>{provider.name}</h5>
                              {provider.rating && (
                                <div className="provider-rating-chat">⭐ {provider.rating}</div>
                              )}
                            </div>
                            <div className="provider-type-chat">{provider.type}</div>
                            <div className="provider-contact-chat">
                              {provider.phone && (
                                <div>
                                  <strong>Phone:</strong>{' '}
                                  <a href={`tel:${provider.phone}`} className="contact-link-chat">
                                    {provider.phone}
                                  </a>
                                </div>
                              )}
                              {provider.address && (
                                <div className="contact-text-chat">
                                  <strong>Address:</strong> {provider.address}, {provider.city}, {provider.state}
                                </div>
                              )}
                            </div>
                            <div className="provider-actions-chat">
                              {provider.phone && (
                                <a
                                  href={`tel:${provider.phone}`}
                                  className="action-button-chat call"
                                >
                                  📞 Call
                                </a>
                              )}
                              {provider.email && (
                                <a
                                  href={`mailto:${provider.email}`}
                                  className="action-button-chat email"
                                >
                                  ✉️ Email
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="chat-message assistant">
                  <div className="chat-message-content">
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
                placeholder="Ask a question about this document..."
                className="chat-input"
                rows={2}
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
        </div>
      </div>
    </div>
  );
}
