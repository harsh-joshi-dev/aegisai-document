import { useState, useEffect } from 'react';
import { Document } from '../api/client';
import './ShareDocumentModal.css';

interface ShareDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  companyName?: string;
}

export default function ShareDocumentModal({
  isOpen,
  onClose,
  document,
  companyName = 'Aegis AI',
}: ShareDocumentModalProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Generate shareable URL (you can customize this based on your domain)
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/document/${document.id}`;
      setShareUrl(url);
    }
  }, [isOpen, document.id]);

  if (!isOpen) return null;

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

  // Generate share text with summary
  const generateShareText = () => {
    const riskInfo = document.riskLevel !== 'Normal'
      ? `Risk Level: ${document.riskLevel}${document.riskCategory ? ` (${document.riskCategory})` : ''}`
      : 'Risk Level: Normal';

    const confidenceVal = document.riskConfidence;
    const confidence = confidenceVal != null
      ? `Confidence: ${typeof confidenceVal === 'number' && confidenceVal <= 1 ? Math.round(confidenceVal * 100) : confidenceVal}%`
      : '';

    return `📄 Document Analysis: ${document.filename}\n\n${riskInfo}${confidence ? `\n${confidence}` : ''}\n\nAnalyzed by ${companyName} - Intelligent Document Analysis Platform\n\nView details: ${shareUrl}`;
  };

  const shareText = generateShareText();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please copy manually.');
    }
  };

  const handleShare = (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      email: `mailto:?subject=Document Analysis: ${encodeURIComponent(document.filename)}&body=${encodedText}`,
    };

    const url = shareUrls[platform];
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-header-content">
            <svg className="share-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Share Document</h2>
          </div>
          <button className="share-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="share-document-info">
          <div className="share-document-header">
            <h3>{document.filename}</h3>
            <span className={`risk-badge ${getRiskBadgeClass(document.riskLevel)}`}>
              {document.riskLevel}
            </span>
          </div>
        </div>

        <div className="share-options">
          <h4>Share via Social Media</h4>
          <div className="social-share-buttons">
            <button
              className="share-button twitter"
              onClick={() => handleShare('twitter')}
              title="Share on Twitter"
            >
              <svg className="share-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
              </svg>
              <span>Twitter</span>
            </button>
            <button
              className="share-button facebook"
              onClick={() => handleShare('facebook')}
              title="Share on Facebook"
            >
              <svg className="share-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
              </svg>
              <span>Facebook</span>
            </button>
            <button
              className="share-button linkedin"
              onClick={() => handleShare('linkedin')}
              title="Share on LinkedIn"
            >
              <svg className="share-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
              <span>LinkedIn</span>
            </button>
            <button
              className="share-button whatsapp"
              onClick={() => handleShare('whatsapp')}
              title="Share on WhatsApp"
            >
              <svg className="share-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>WhatsApp</span>
            </button>
            <button
              className="share-button telegram"
              onClick={() => handleShare('telegram')}
              title="Share on Telegram"
            >
              <svg className="share-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span>Telegram</span>
            </button>
            <button
              className="share-button email"
              onClick={() => handleShare('email')}
              title="Share via Email"
            >
              <svg className="share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Email</span>
            </button>
          </div>
        </div>

        <div className="share-link-section">
          <h4>Copy Link</h4>
          <div className="link-copy-container">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="share-link-input"
            />
            <button
              className={`copy-link-button ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="share-preview">
          <h4>Preview</h4>
          <div className="share-preview-content">
            <p>{shareText}</p>
          </div>
        </div>

        <div className="share-footer">
          <p className="powered-by">
            Powered by <strong>{companyName}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
