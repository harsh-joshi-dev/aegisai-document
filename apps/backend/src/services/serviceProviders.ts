// Service Provider Lookup Service
// This service provides location-based service provider recommendations using real APIs

export interface ServiceProvider {
  id: string;
  name: string;
  category: 'NBFC' | 'CharteredAccountant' | 'DPDPConsultant' | 'Financial'; // Financial used when mapping from Places
  type: string;
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
  distance?: number;
  website?: string;
  placeId?: string;
}

// ULI + DPDP only: NBFC, CA, DPDP Consultant
const CATEGORY_TO_SEARCH_TERMS: Record<string, string[]> = {
  NBFC: ['NBFC', 'microfinance', 'small finance bank', 'lending company', 'loan office'],
  CharteredAccountant: ['chartered accountant', 'CA firm', 'CA office', 'audit firm'],
  DPDPConsultant: ['data protection consultant', 'privacy consultant', 'DPDP compliance'],
};

// Get service providers from Google Places API
async function getProvidersFromGooglePlaces(
  category: string,
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
            category: (category === 'NBFC' || category === 'CharteredAccountant' || category === 'DPDPConsultant' ? category : 'Financial') as ServiceProvider['category'],
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

// Fallback mock data — ULI + DPDP only: NBFC, CA, DPDP Consultant (India)
const FALLBACK_PROVIDERS: ServiceProvider[] = [
  {
    id: 'nbfc-1',
    name: 'SME Finance NBFC',
    category: 'NBFC',
    type: 'NBFC',
    phone: '+91-98765-43210',
    address: 'MG Road, Bangalore',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
    rating: 4.5,
    specialization: ['SME Lending', 'Microfinance'],
  },
  {
    id: 'nbfc-2',
    name: 'Small Finance Lending',
    category: 'NBFC',
    type: 'NBFC',
    phone: '+91-98765-43211',
    address: 'Bandra West, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    latitude: 19.0596,
    longitude: 72.8295,
    rating: 4.6,
    specialization: ['ULI Integration', 'Loan Against GST'],
  },
  {
    id: 'ca-1',
    name: 'Chartered Accountants & Co.',
    category: 'CharteredAccountant',
    type: 'Chartered Accountant',
    phone: '+91-98765-43212',
    address: 'Connaught Place, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    latitude: 28.6304,
    longitude: 77.2177,
    rating: 4.8,
    specialization: ['GST', 'ITR Verification', 'Audit'],
  },
  {
    id: 'ca-2',
    name: 'Tax & Audit Firm',
    category: 'CharteredAccountant',
    type: 'CA Firm',
    phone: '+91-98765-43213',
    address: 'Anna Salai, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 13.0827,
    longitude: 80.2707,
    rating: 4.7,
    specialization: ['Due Diligence', 'Financial Consistency'],
  },
  {
    id: 'dpdp-1',
    name: 'DPDP Compliance Advisors',
    category: 'DPDPConsultant',
    type: 'DPDP Consultant',
    phone: '+91-98765-43214',
    address: 'Salt Lake, Kolkata',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    latitude: 22.5749,
    longitude: 88.4339,
    rating: 4.9,
    specialization: ['Data Principal Rights', 'Consent Audit', 'Data Localisation'],
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

export type ServiceProviderCategory = 'NBFC' | 'CharteredAccountant' | 'DPDPConsultant' | 'None';

export async function getServiceProviders(
  category: ServiceProviderCategory,
  userLocation: Location,
  limit: number = 5
): Promise<ServiceProvider[]> {
  if (category === 'None') {
    return [];
  }

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

// Get all providers near a location — ULI + DPDP only
export async function getAllNearbyProviders(
  userLocation: Location,
  radiusKm: number = 50,
  limit: number = 10
): Promise<ServiceProvider[]> {
  const allCategories: ServiceProviderCategory[] = ['NBFC', 'CharteredAccountant', 'DPDPConsultant'];
  const allProviders: ServiceProvider[] = [];
  for (const category of allCategories) {
    const providers = await getProvidersFromGooglePlaces(category, userLocation, radiusKm * 1000);
    allProviders.push(...providers);
  }
  if (allProviders.length > 0) {
    const unique = Array.from(new Map(allProviders.map(p => [p.id, p])).values());
    unique.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return unique.slice(0, limit);
  }
  const providers = FALLBACK_PROVIDERS.map((provider) => ({
    ...provider,
    distance: calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      provider.latitude,
      provider.longitude
    ),
  }));
  const nearby = providers.filter((p) => (p.distance || 0) <= radiusKm);
  nearby.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  return nearby.slice(0, limit);
}
