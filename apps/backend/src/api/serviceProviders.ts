import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getServiceProviders, getAllNearbyProviders, Location } from '../services/serviceProviders.js';

const router = Router();

const serviceProviderRequestSchema = z.object({
  category: z.enum(['Legal', 'Financial', 'Compliance', 'Operational', 'Medical', 'None']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

// Get service providers based on document category and user location
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = serviceProviderRequestSchema.parse(req.body);
    
    const userLocation: Location = {
      latitude: validated.latitude,
      longitude: validated.longitude,
    };
    
    const providers = await getServiceProviders(
      validated.category,
      userLocation,
      validated.limit
    );
    
    res.json({
      success: true,
      category: validated.category,
      location: userLocation,
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        phone: p.phone,
        email: p.email,
        address: p.address,
        city: p.city,
        state: p.state,
        country: p.country,
        rating: p.rating,
        specialization: p.specialization,
        distance: Math.round((p.distance || 0) * 10) / 10, // Round to 1 decimal
      })),
      count: providers.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Service provider lookup error:', error);
    res.status(500).json({
      error: 'Failed to fetch service providers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get all nearby providers (fallback)
router.post('/nearby', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusKm: z.number().min(1).max(500).optional().default(50),
      limit: z.number().int().min(1).max(20).optional().default(10),
    });
    
    const validated = schema.parse(req.body);
    
    const userLocation: Location = {
      latitude: validated.latitude,
      longitude: validated.longitude,
    };
    
    const providers = await getAllNearbyProviders(
      userLocation,
      validated.radiusKm,
      validated.limit
    );
    
    res.json({
      success: true,
      location: userLocation,
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        type: p.type,
        phone: p.phone,
        email: p.email,
        address: p.address,
        city: p.city,
        state: p.state,
        country: p.country,
        rating: p.rating,
        specialization: p.specialization,
        distance: Math.round((p.distance || 0) * 10) / 10,
      })),
      count: providers.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Nearby providers lookup error:', error);
    res.status(500).json({
      error: 'Failed to fetch nearby providers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
