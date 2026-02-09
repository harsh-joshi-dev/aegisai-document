import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Location as APILocation, API_BASE_URL } from '../api/client';

interface LocationContextType {
  location: APILocation | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<APILocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Try to get city/state from reverse geocoding via backend proxy
        try {
          // Use backend API to avoid CORS issues
          const response = await fetch(
            `${API_BASE_URL}/api/geocode/reverse?lat=${latitude}&lon=${longitude}`.replace(/([^:])\/+/g, '$1/'),
            {
              method: 'GET',
              credentials: 'include',
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            const locationData: APILocation = {
              latitude,
              longitude,
              city: data.city,
              state: data.state,
              country: data.country,
            };
            setLocation(locationData);
          } else {
            // If reverse geocoding fails, just use coordinates
            setLocation({
              latitude,
              longitude,
            });
          }
        } catch (e) {
          // If reverse geocoding fails, just use coordinates
          console.warn('Reverse geocoding failed, using coordinates only:', e);
          setLocation({
            latitude,
            longitude,
          });
        }
        
        setLoading(false);
      },
      (error) => {
        setError(`Location error: ${error.message}`);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  };

  useEffect(() => {
    // Request location when app loads (non-blocking)
    // Don't block app initialization if location fails
    requestLocation().catch((err) => {
      console.warn('Location request failed:', err);
      setLoading(false);
      setError('Location access denied or unavailable');
    });
  }, []);

  return (
    <LocationContext.Provider value={{ location, loading, requestLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
