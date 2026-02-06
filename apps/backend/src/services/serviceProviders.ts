// Service Provider Lookup Service
// This service provides location-based service provider recommendations using real APIs

export interface ServiceProvider {
  id: string;
  name: string;
  category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical';
  type: string; // e.g., "Lawyer", "Advocate", "Accountant", "Consultant", "Doctor", "Clinic"
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  rating?: number;
  specialization?: string[];
  distance?: number; // in km
  website?: string;
  placeId?: string;
}

// Map document categories to Google Places search terms
const CATEGORY_TO_SEARCH_TERMS: Record<string, string[]> = {
  Legal: ['lawyer', 'attorney', 'law firm', 'advocate', 'legal services'],
  Financial: ['accountant', 'financial advisor', 'tax consultant', 'CPA', 'financial services'],
  Compliance: ['compliance consultant', 'regulatory consultant', 'compliance services'],
  Operational: ['business consultant', 'operations consultant', 'business advisor'],
  Medical: ['doctor', 'physician', 'clinic', 'medical center', 'hospital', 'healthcare provider', 'pharmacy'],
};

// Get service providers from Google Places API
async function getProvidersFromGooglePlaces(
  category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical',
  location: Location,
  radius: number = 5000 // 5km default
): Promise<ServiceProvider[]> {
  const { config } = await import('../config/env.js');
  const apiKey = config.google.placesApiKey;
  
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_PLACES_API_KEY not set. Using fallback data.');
    return [];
  }

  const searchTerms = CATEGORY_TO_SEARCH_TERMS[category] || [category.toLowerCase()];
  const providers: ServiceProvider[] = [];

  try {
    // Search for each term
    for (const term of searchTerms.slice(0, 2)) { // Limit to 2 terms to avoid rate limits
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(term)} near ${location.latitude},${location.longitude}&radius=${radius}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json() as {
        status: string;
        results?: Array<{
          place_id: string;
          name: string;
          formatted_address: string;
          geometry: {
            location: { lat: number; lng: number };
          };
          rating?: number;
          types?: string[];
        }>;
      };

      if (data.status === 'OK' && data.results) {
        for (const place of data.results.slice(0, 5)) { // Limit to 5 per term
          // Get place details for phone number
          let phone = 'N/A';
          let website = undefined;
          
          try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,international_phone_number&key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json() as {
              status: string;
              result?: {
                formatted_phone_number?: string;
                international_phone_number?: string;
                website?: string;
              };
            };
            
            if (detailsData.status === 'OK' && detailsData.result) {
              phone = detailsData.result.formatted_phone_number || 
                      detailsData.result.international_phone_number || 
                      'N/A';
              website = detailsData.result.website;
            }
          } catch (e) {
            console.warn('Failed to get place details:', e);
          }

          // Parse address
          const addressParts = place.formatted_address?.split(',') || [];
          const city = addressParts.length > 1 ? addressParts[addressParts.length - 3]?.trim() || '' : '';
          const state = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() || '' : '';
          const country = addressParts.length > 0 ? addressParts[addressParts.length - 1]?.trim() || '' : '';

          const provider: ServiceProvider = {
            id: place.place_id,
            name: place.name,
            category: category,
            type: place.types?.[0]?.replace(/_/g, ' ') || term,
            phone: phone,
            address: place.formatted_address || '',
            city: city,
            state: state,
            country: country,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            rating: place.rating,
            distance: calculateDistance(
              location.latitude,
              location.longitude,
              place.geometry.location.lat,
              place.geometry.location.lng
            ),
            website: website,
            placeId: place.place_id,
          };

          providers.push(provider);
        }
      }
    }

    // Remove duplicates and sort by distance
    const uniqueProviders = Array.from(
      new Map(providers.map(p => [p.id, p])).values()
    );
    uniqueProviders.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return uniqueProviders;
  } catch (error) {
    console.error('Error fetching from Google Places API:', error);
    return [];
  }
}

// Fallback mock data (used when API key is not available)
const FALLBACK_PROVIDERS: ServiceProvider[] = [
  // Legal - Lawyers & Advocates
  {
    id: '1',
    name: 'John Smith Law Firm',
    category: 'Legal',
    type: 'Lawyer',
    phone: '+1-555-0101',
    email: 'john.smith@lawfirm.com',
    address: '123 Main Street, Suite 200',
    city: 'San Francisco',
    state: 'California',
    country: 'USA',
    latitude: 37.7749,
    longitude: -122.4194,
    rating: 4.8,
    specialization: ['Contract Law', 'Corporate Law', 'Employment Law'],
  },
  {
    id: '2',
    name: 'Sarah Johnson Legal Services',
    category: 'Legal',
    type: 'Advocate',
    phone: '+1-555-0102',
    email: 'sarah.j@legal.com',
    address: '456 Market Street',
    city: 'San Francisco',
    state: 'California',
    country: 'USA',
    latitude: 37.7849,
    longitude: -122.4094,
    rating: 4.9,
    specialization: ['Contract Law', 'Intellectual Property'],
  },
  {
    id: '3',
    name: 'Michael Chen & Associates',
    category: 'Legal',
    type: 'Lawyer',
    phone: '+1-555-0103',
    address: '789 Broadway',
    city: 'New York',
    state: 'New York',
    country: 'USA',
    latitude: 40.7128,
    longitude: -74.0060,
    rating: 4.7,
    specialization: ['Corporate Law', 'M&A'],
  },
  // Financial - Accountants & Financial Advisors
  {
    id: '4',
    name: 'ABC Financial Advisors',
    category: 'Financial',
    type: 'Financial Advisor',
    phone: '+1-555-0201',
    email: 'contact@abcfina.com',
    address: '321 Financial District',
    city: 'San Francisco',
    state: 'California',
    country: 'USA',
    latitude: 37.7949,
    longitude: -122.4000,
    rating: 4.6,
    specialization: ['Tax Planning', 'Investment Advisory'],
  },
  {
    id: '5',
    name: 'XYZ Accounting Services',
    category: 'Financial',
    type: 'Accountant',
    phone: '+1-555-0202',
    address: '654 Business Park',
    city: 'New York',
    state: 'New York',
    country: 'USA',
    latitude: 40.7028,
    longitude: -74.0160,
    rating: 4.8,
    specialization: ['Tax Preparation', 'Audit Services'],
  },
  // Compliance - Compliance Consultants
  {
    id: '6',
    name: 'Compliance Experts Inc.',
    category: 'Compliance',
    type: 'Compliance Consultant',
    phone: '+1-555-0301',
    email: 'info@complianceexperts.com',
    address: '987 Compliance Center',
    city: 'San Francisco',
    state: 'California',
    country: 'USA',
    latitude: 37.8049,
    longitude: -122.4100,
    rating: 4.9,
    specialization: ['GDPR', 'SOC 2', 'HIPAA'],
  },
  // Operational - Business Consultants
  {
    id: '7',
    name: 'Operational Excellence Group',
    category: 'Operational',
    type: 'Business Consultant',
    phone: '+1-555-0401',
    address: '147 Operations Hub',
    city: 'San Francisco',
    state: 'California',
    country: 'USA',
    latitude: 37.8149,
    longitude: -122.4200,
    rating: 4.7,
    specialization: ['Process Optimization', 'Risk Management'],
  },
  // Medical - Doctors & Healthcare Providers
  {
    id: 'med-1',
    name: 'City Medical Center',
    category: 'Medical',
    type: 'Medical Clinic',
    phone: '+1-555-0501',
    email: 'info@citymedical.com',
    address: '789 Health Avenue',
    city: 'New York',
    state: 'New York',
    country: 'USA',
    latitude: 40.7128,
    longitude: -74.0060,
    rating: 4.8,
    specialization: ['General Medicine', 'Prescription Review'],
  },
  {
    id: 'med-2',
    name: 'Dr. Smith Family Practice',
    category: 'Medical',
    type: 'Family Doctor',
    phone: '+1-555-0502',
    email: 'contact@drsmith.com',
    address: '456 Medical Plaza',
    city: 'San Francisco',
    state: 'California',
    country: 'USA',
    latitude: 37.7849,
    longitude: -122.4094,
    rating: 4.9,
    specialization: ['Family Medicine', 'Prescription Management'],
  },
  {
    id: 'med-3',
    name: 'HealthCare Plus Clinic',
    category: 'Medical',
    type: 'Healthcare Provider',
    phone: '+1-555-0503',
    address: '321 Wellness Drive',
    city: 'Los Angeles',
    state: 'California',
    country: 'USA',
    latitude: 34.0522,
    longitude: -118.2437,
    rating: 4.7,
    specialization: ['Primary Care', 'Medical Consultation'],
  },
];

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

export async function getServiceProviders(
  category: 'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'None',
  userLocation: Location,
  limit: number = 5
): Promise<ServiceProvider[]> {
  if (category === 'None') {
    return [];
  }

  // Try to get real data from Google Places API first
  const realProviders = await getProvidersFromGooglePlaces(category, userLocation);
  
  if (realProviders.length > 0) {
    console.log(`✅ Found ${realProviders.length} real providers from Google Places API`);
    return realProviders.slice(0, limit);
  }

  // Fallback to mock data if API is not available
  console.log('⚠️  Using fallback providers (Google Places API not available)');
  let providers = FALLBACK_PROVIDERS.filter((p) => p.category === category);

  // Calculate distances and sort by proximity
  providers = providers.map((provider) => ({
    ...provider,
    distance: calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      provider.latitude,
      provider.longitude
    ),
  }));

  // Sort by distance (closest first)
  providers.sort((a, b) => (a.distance || 0) - (b.distance || 0));

  // Return top N providers
  return providers.slice(0, limit);
}

// Get all providers near a location (for fallback)
export async function getAllNearbyProviders(
  userLocation: Location,
  radiusKm: number = 50,
  limit: number = 10
): Promise<ServiceProvider[]> {
  // Try to get real data for all categories
  const allCategories: Array<'Legal' | 'Financial' | 'Compliance' | 'Operational' | 'Medical'> = 
    ['Legal', 'Financial', 'Compliance', 'Operational', 'Medical'];
  
  const allProviders: ServiceProvider[] = [];
  
  for (const category of allCategories) {
    const providers = await getProvidersFromGooglePlaces(category, userLocation, radiusKm * 1000);
    allProviders.push(...providers);
  }

  if (allProviders.length > 0) {
    // Remove duplicates and sort
    const unique = Array.from(new Map(allProviders.map(p => [p.id, p])).values());
    unique.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return unique.slice(0, limit);
  }

  // Fallback to mock data
  const providers = FALLBACK_PROVIDERS.map((provider) => ({
    ...provider,
    distance: calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      provider.latitude,
      provider.longitude
    ),
  }));

  // Filter by radius
  const nearby = providers.filter((p) => (p.distance || 0) <= radiusKm);

  // Sort by distance
  nearby.sort((a, b) => (a.distance || 0) - (b.distance || 0));

  return nearby.slice(0, limit);
}
