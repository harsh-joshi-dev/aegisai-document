import { useState, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { getServiceProviders, ServiceProvider } from '../api/client';
import './ServiceProviderModal.css';

interface ServiceProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical' | 'None';
  riskExplanation?: string;
  documentName?: string;
}

export default function ServiceProviderModal({
  isOpen,
  onClose,
  category,
  riskExplanation,
  documentName,
}: ServiceProviderModalProps) {
  const { location: userLocation, loading: locationLoading, error: locationError, requestLocation } = useLocation();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && category && category !== 'None' && userLocation) {
      fetchProviders();
    }
  }, [isOpen, category, userLocation]);

  const fetchProviders = async () => {
    if (!userLocation) {
      setError('Location not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getServiceProviders(category, userLocation);
      setProviders(response.providers);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch service providers');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Legal':
        return '⚖️';
      case 'Financial':
        return '💰';
      case 'Compliance':
        return '✅';
      case 'Operational':
        return '⚙️';
      default:
        return '📋';
    }
  };

  const getCategoryDescription = (cat: string) => {
    switch (cat) {
      case 'Legal':
        return 'Find qualified lawyers and legal advocates in your area';
      case 'Financial':
        return 'Connect with accountants and financial advisors nearby';
      case 'Compliance':
        return 'Locate compliance consultants and experts';
      case 'Operational':
        return 'Discover business consultants and operational advisors';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <h2>
              {getCategoryIcon(category)} {category} Solution Providers
            </h2>
            <p className="modal-subtitle">{getCategoryDescription(category)}</p>
            {documentName && (
              <p className="document-name">📄 {documentName}</p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {riskExplanation && (
          <div className="modal-reasoning">
            <h4>Why {category}?</h4>
            <p>{riskExplanation}</p>
          </div>
        )}

        {locationError && (
          <div className="location-warning">
            ⚠️ {locationError}
            <button onClick={requestLocation} className="retry-location-button">
              🔄 Try Again
            </button>
          </div>
        )}

        {locationLoading && (
          <div className="location-loading">
            📍 Detecting your location...
          </div>
        )}

        {loading && (
          <div className="loading-providers">
            <div className="spinner"></div>
            <p>Finding service providers near you...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && providers.length > 0 && (
          <div className="providers-section">
            <div className="providers-header">
              <h3>Recommended Providers ({providers.length})</h3>
              <button onClick={fetchProviders} className="refresh-providers">
                🔄 Refresh
              </button>
            </div>
            <div className="providers-grid">
              {providers.map((provider) => (
                <div key={provider.id} className="provider-card">
                  <div className="provider-header">
                    <h5>{provider.name}</h5>
                    {provider.rating && (
                      <div className="provider-rating">
                        ⭐ {provider.rating}
                      </div>
                    )}
                  </div>
                  <div className="provider-type">{provider.type}</div>
                  
                  {provider.specialization && provider.specialization.length > 0 && (
                    <div className="provider-specialization">
                      <strong>Specializes in:</strong>
                      <div className="specialization-tags">
                        {provider.specialization.map((spec, idx) => (
                          <span key={idx} className="tag">{spec}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="provider-contact">
                    <div className="contact-item">
                      <span className="contact-icon">📞</span>
                      <a href={`tel:${provider.phone}`} className="contact-link">
                        {provider.phone}
                      </a>
                    </div>
                    {provider.email && (
                      <div className="contact-item">
                        <span className="contact-icon">✉️</span>
                        <a href={`mailto:${provider.email}`} className="contact-link">
                          {provider.email}
                        </a>
                      </div>
                    )}
                    <div className="contact-item">
                      <span className="contact-icon">📍</span>
                      <span className="contact-text">
                        {provider.address}, {provider.city}, {provider.state}
                      </span>
                    </div>
                    {provider.distance !== undefined && (
                      <div className="contact-item">
                        <span className="contact-icon">📏</span>
                        <span className="contact-text">
                          {provider.distance} km away
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="provider-actions">
                    <a 
                      href={`tel:${provider.phone}`} 
                      className="call-button"
                    >
                      📞 Call Now
                    </a>
                    {provider.email && (
                      <a 
                        href={`mailto:${provider.email}`} 
                        className="email-button"
                      >
                        ✉️ Email
                      </a>
                    )}
                    {provider.website && (
                      <a 
                        href={provider.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="website-button"
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

        {!loading && !error && providers.length === 0 && userLocation && (
          <div className="no-providers">
            <p>No service providers found in your area for this category.</p>
            <button onClick={fetchProviders} className="retry-button">
              🔄 Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
