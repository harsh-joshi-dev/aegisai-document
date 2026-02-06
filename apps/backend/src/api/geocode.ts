import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Simple in-memory cache to avoid repeated API calls
const geocodeCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate cache key from coordinates
 */
function getCacheKey(lat: number, lon: number): string {
  // Round to 4 decimal places (~11 meters precision)
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/**
 * Retry function with exponential backoff
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === maxRetries - 1;
      const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
      
      if (isLastAttempt || !isTimeout) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const waitTime = delay * Math.pow(2, i);
      console.log(`Geocoding request failed, retrying in ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Reverse geocoding - Get address from coordinates
 * This is a proxy to avoid CORS issues with OpenStreetMap Nominatim API
 */
router.get('/reverse', async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'lat and lon query parameters are required',
      });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lon as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'lat and lon must be valid numbers',
      });
    }

    // Check cache first
    const cacheKey = getCacheKey(latitude, longitude);
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached geocoding result');
      return res.json(cached.data);
    }

    // Use OpenStreetMap Nominatim API with retry logic and timeout
    const response = await retryRequest(async () => {
      return await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          params: {
            format: 'json',
            lat: latitude,
            lon: longitude,
            zoom: 10,
            addressdetails: 1,
          },
          headers: {
            'User-Agent': 'Aegis-AI/1.0', // Required by Nominatim
            'Accept': 'application/json',
          },
          timeout: 10000, // 10 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx
        }
      );
    }, 3, 1000); // 3 retries with 1s initial delay

    // Check if response is valid
    if (response.status !== 200 || !response.data) {
      throw new Error(`Nominatim API returned status ${response.status}`);
    }

    const data = response.data;
    const address = data.address || {};

    const result = {
      success: true,
      latitude,
      longitude,
      city: address.city || address.town || address.village || address.municipality || 'Unknown',
      state: address.state || address.region || 'Unknown',
      country: address.country || 'Unknown',
      fullAddress: data.display_name || `${latitude}, ${longitude}`,
    };

    // Cache the result
    geocodeCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    // Clean up old cache entries (keep cache size reasonable)
    if (geocodeCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of geocodeCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          geocodeCache.delete(key);
        }
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('Reverse geocoding error:', error.message || error);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to reverse geocode';
    let statusCode = 500;
    
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Geocoding service timeout - please try again';
      statusCode = 504; // Gateway Timeout
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Geocoding service unavailable - please try again later';
      statusCode = 503; // Service Unavailable
    } else if (error.response) {
      errorMessage = `Geocoding service error: ${error.response.status}`;
      statusCode = error.response.status >= 400 && error.response.status < 500 ? error.response.status : 500;
    }
    
    res.status(statusCode).json({
      error: 'Failed to reverse geocode',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
