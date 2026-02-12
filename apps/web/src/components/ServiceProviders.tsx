import { useState, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { getServiceProviders, ServiceProvider, Location as APILocation, type ServiceProviderCategory } from '../api/client';
import './ServiceProviders.css';

interface ServiceProvidersProps {
  category: ServiceProviderCategory;
  riskExplanation?: string;
  onLocationDetected?: (location: APILocation) => void;
}

export default function ServiceProviders({ 
  category, 
  riskExplanation,
  onLocationDetected 
}: ServiceProvidersProps) {
  const { location: userLocation, loading: locationLoading, error: locationError, requestLocation } = useLocation();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category && category !== 'None' && userLocation) {
      fetchProviders();
    }
  }, [category, userLocation]);

  const fetchProviders = async () => {
    if (!userLocation) {
      setError('Location not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (onLocationDetected && userLocation) {
        onLocationDetected(userLocation);
      }

      // Fetch service providers with real location
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
      case 'NBFC':
        return '🏦';
      case 'CharteredAccountant':
        return '📒';
      case 'DPDPConsultant':
        return '🔒';
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
        return 'Legal documents require professional legal review. Connect with qualified lawyers and advocates in your area.';
      case 'Financial':
        return 'Financial documents may need expert analysis. Find accountants and financial advisors nearby.';
      case 'Compliance':
        return 'Compliance issues require specialized expertise. Locate compliance consultants in your region.';
      case 'Operational':
        return 'Operational risks may need business consulting. Discover operational experts near you.';
      case 'Medical':
        return 'Medical documents like prescriptions may need professional review. Find doctors, clinics, and healthcare providers near you.';
      default:
        return '';
    }
  };

  if (category === 'None' || !category) {
    return null;
  }

  return (
    <div className="service-providers">
      <div className="service-providers-header">
        <div className="category-info">
          <h3>
            {getCategoryIcon(category)} {category} Document Support
          </h3>
          <p className="category-description">{getCategoryDescription(category)}</p>
        </div>
        {riskExplanation && (
          <div className="risk-reasoning">
            <h4>Why this category?</h4>
            <p>{riskExplanation}</p>
          </div>
        )}
      </div>

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
        <div className="providers-list">
          <h4>Recommended Service Providers ({providers.length})</h4>
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
  );
}
