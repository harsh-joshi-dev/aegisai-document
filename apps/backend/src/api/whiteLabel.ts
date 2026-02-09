/**
 * White-Labeling API
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getTenant,
  getTenantByDomain,
  createTenant,
  updateTenantBranding,
} from '../whiteLabel/tenant.js';
import { requireRole } from '../rbac/middleware.js';

const router = Router();

/**
 * Get tenant branding (public endpoint)
 */
router.get('/branding', async (req: Request, res: Response) => {
  try {
    // Get tenant from domain or default
    const domain = req.get('host')?.split(':')[0];
    const tenant = domain 
      ? await getTenantByDomain(domain)
      : await getTenant(req.headers['x-tenant-id'] as string || 'default');

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    res.json({
      success: true,
      branding: tenant.branding,
    });
  } catch (error) {
    console.error('Get branding error:', error);
    res.status(500).json({
      error: 'Failed to get branding',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Update tenant branding (admin only)
 */
router.put('/branding', /* requireRole('admin'), */ async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId || req.headers['x-tenant-id'] as string;
    const branding = z.object({
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      companyName: z.string().optional(),
      faviconUrl: z.string().url().optional(),
      customCss: z.string().optional(),
    }).parse(req.body);

    const updated = await updateTenantBranding(tenantId, branding);

    if (!updated) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    res.json({
      success: true,
      branding: updated.branding,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Update branding error:', error);
    res.status(500).json({
      error: 'Failed to update branding',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create tenant (admin only)
 */
router.post('/tenants', /* requireRole('admin'), */ async (req: Request, res: Response) => {
  try {
    const tenantData = z.object({
      name: z.string().min(1),
      domain: z.string().optional(),
      branding: z.object({
        logoUrl: z.string().url().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        companyName: z.string().optional(),
        faviconUrl: z.string().url().optional(),
        customCss: z.string().optional(),
      }).optional(),
      settings: z.object({
        allowCustomBranding: z.boolean().optional(),
        maxUsers: z.number().optional(),
        features: z.array(z.string()).optional(),
      }).optional(),
    }).parse(req.body);

    const tenant = await createTenant({
      name: tenantData.name,
      domain: tenantData.domain,
      branding: tenantData.branding || {},
      settings: {
        allowCustomBranding: tenantData.settings?.allowCustomBranding ?? true,
        maxUsers: tenantData.settings?.maxUsers,
        features: tenantData.settings?.features ?? ['all'],
      },
    });

    res.json({
      success: true,
      tenant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Create tenant error:', error);
    res.status(500).json({
      error: 'Failed to create tenant',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
