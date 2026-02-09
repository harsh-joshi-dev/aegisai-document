/**
 * White-Labeling System
 * Multi-tenant support with custom branding
 */
import { pool } from '../db/pgvector.js';

export interface Tenant {
  id: string;
  name: string;
  domain?: string; // Custom domain
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
    faviconUrl?: string;
    customCss?: string;
  };
  settings: {
    allowCustomBranding: boolean;
    maxUsers?: number;
    features: string[]; // Enabled features
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Initialize tenants table
 */
export async function initializeTenants(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE,
        branding JSONB DEFAULT '{}'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add tenant_id to documents table
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
    `);

    console.log('✅ Tenants table initialized');
  } catch (error) {
    console.error('Error initializing tenants:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get tenant by ID
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const result = await pool.query(
    'SELECT * FROM tenants WHERE id = $1',
    [tenantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    domain: row.domain as string | undefined,
    branding: (row.branding as Record<string, unknown>) || {},
    settings: (row.settings as Tenant['settings']) || { allowCustomBranding: true, features: ['all'] },
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

/**
 * Get tenant by domain
 */
export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  const result = await pool.query(
    'SELECT * FROM tenants WHERE domain = $1',
    [domain]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    domain: row.domain as string | undefined,
    branding: (row.branding as Record<string, unknown>) || {},
    settings: (row.settings as Tenant['settings']) || { allowCustomBranding: true, features: ['all'] },
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

/**
 * Create tenant
 */
export async function createTenant(tenantData: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
  const result = await pool.query(
    `INSERT INTO tenants (name, domain, branding, settings)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      tenantData.name,
      tenantData.domain,
      JSON.stringify(tenantData.branding),
      JSON.stringify(tenantData.settings),
    ]
  );

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    domain: row.domain as string | undefined,
    branding: row.branding as Record<string, unknown>,
    settings: (row.settings as Tenant['settings']) || { allowCustomBranding: true, features: ['all'] },
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

/**
 * Update tenant branding
 */
export async function updateTenantBranding(
  tenantId: string,
  branding: Partial<Tenant['branding']>
): Promise<Tenant | null> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  const updatedBranding = { ...tenant.branding, ...branding };
  
  const result = await pool.query(
    `UPDATE tenants 
     SET branding = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(updatedBranding), tenantId]
  );

  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    domain: row.domain as string | undefined,
    branding: row.branding as Record<string, unknown>,
    settings: (row.settings as Tenant['settings']) || { allowCustomBranding: true, features: ['all'] },
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

/**
 * Get default tenant (for single-tenant deployments)
 */
export async function getDefaultTenant(): Promise<Tenant> {
  const result = await pool.query('SELECT * FROM tenants LIMIT 1');
  
  if (result.rows.length > 0) {
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      name: row.name as string,
      domain: row.domain as string | undefined,
      branding: (row.branding as Record<string, unknown>) || {},
      settings: (row.settings as Tenant['settings']) || { allowCustomBranding: true, features: ['all'] },
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  // Create default tenant
  return await createTenant({
    name: 'Default',
    branding: {},
    settings: {
      allowCustomBranding: true,
      features: ['all'],
    },
  });
}
