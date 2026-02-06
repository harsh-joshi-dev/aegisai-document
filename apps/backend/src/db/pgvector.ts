import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
});

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: {
    page?: number;
    chunkIndex: number;
    startChar?: number;
    endChar?: number;
  };
}

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create extension if not exists (gracefully handle if pgvector not installed)
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✅ pgvector extension enabled');
    } catch (error: any) {
      if (error.message?.includes('vector.control')) {
        console.warn('⚠️  pgvector extension not installed. Vector search will not work, but app will function normally.');
      } else {
        throw error;
      }
    }
    
    // Initialize compliance tables
    const { initializeAuditLogs } = await import('../compliance/auditLog.js');
    await initializeAuditLogs();
    
    // Initialize white-label tables
    const { initializeTenants } = await import('../whiteLabel/tenant.js');
    await initializeTenants();
    
    // Initialize folders
    const { initializeFolders } = await import('../api/folders.js');
    await initializeFolders();
    
    // Create session table for express-session (if not exists)
    // This matches the schema expected by connect-pg-simple
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS session (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
      `);
      console.log('✅ Session table created/verified');
    } catch (error: any) {
      // Table might already exist or be created by connect-pg-simple
      console.log('Note: Session table check:', error.message);
    }
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        picture TEXT,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        welcome_email_sent BOOLEAN DEFAULT false
      );
    `);
    
    // Add welcome_email_sent column if it doesn't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;
      `);
    } catch (error: any) {
      console.log('Note: welcome_email_sent column check:', error.message);
    }

    // Create documents table with user_id
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        risk_level VARCHAR(20) DEFAULT 'Normal',
        risk_category VARCHAR(50),
        risk_confidence DECIMAL(5,2),
        version_number INTEGER DEFAULT 1,
        parent_document_id UUID REFERENCES documents(id),
        metadata JSONB DEFAULT '{}'::jsonb,
        file_data BYTEA,
        file_type VARCHAR(50)
      );
    `);
    
    // Add file storage columns if they don't exist
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS file_data BYTEA;
      `);
    } catch (error: any) {
      console.log('Note: file_data column check:', error.message);
    }
    
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS file_type VARCHAR(50);
      `);
    } catch (error: any) {
      console.log('Note: file_type column check:', error.message);
    }
    
    // Add user_id column if it doesn't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      `);
    } catch (error: any) {
      console.log('Note: user_id column check:', error.message);
    }
    
    // Add missing columns if they don't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50);
      `);
    } catch (error: any) {
      // Column might already exist, ignore
      console.log('Note: risk_category column check:', error.message);
    }
    
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS risk_confidence DECIMAL(5,2);
      `);
    } catch (error: any) {
      console.log('Note: risk_confidence column check:', error.message);
    }
    
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
      `);
    } catch (error: any) {
      console.log('Note: version_number column check:', error.message);
    }
    
    try {
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id);
      `);
    } catch (error: any) {
      console.log('Note: parent_document_id column check:', error.message);
    }
    
    // Check if pgvector is available
    const hasPgvector = await checkPgvectorAvailable();
    
    // Create document_chunks table with vector column (or JSONB if pgvector not available)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          embedding ${hasPgvector ? 'vector(1536)' : 'JSONB'},
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // If pgvector is available, migrate existing JSONB embeddings to vector type
      if (hasPgvector) {
        try {
          // Check if embedding column is JSONB (old format)
          const colCheck = await client.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'document_chunks' 
            AND column_name = 'embedding';
          `);
          
          if (colCheck.rows.length > 0 && colCheck.rows[0].data_type === 'jsonb') {
            console.log('🔄 Migrating embeddings from JSONB to vector type...');
            // Drop old index if it exists (might be on wrong type)
            try {
              await client.query('DROP INDEX IF EXISTS document_chunks_embedding_idx;');
            } catch (e) {
              // Ignore if index doesn't exist
            }
            
            // Clear old JSONB data and convert column to vector type
            // Old documents will need to be re-uploaded for vector embeddings
            await client.query(`
              ALTER TABLE document_chunks 
              ALTER COLUMN embedding TYPE vector(1536) 
              USING NULL;
            `);
            console.log('✅ Migration complete. Note: Old documents need to be re-uploaded for vector embeddings.');
          }
        } catch (migError: any) {
          // If migration fails, try to alter column type directly
          if (migError.message?.includes('cannot cast') || migError.message?.includes('does not exist')) {
            console.warn('⚠️  Cannot migrate existing JSONB embeddings. Clearing old data and converting column.');
            // Drop old index first
            try {
              await client.query('DROP INDEX IF EXISTS document_chunks_embedding_idx;');
            } catch (e) {
              // Ignore
            }
            // Drop and recreate column
            try {
              await client.query('ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;');
              await client.query('ALTER TABLE document_chunks ADD COLUMN embedding vector(1536);');
            } catch (e) {
              console.warn('⚠️  Column migration failed, but table structure is OK for new inserts');
            }
          } else {
            throw migError;
          }
        }
      }
      
      // Create index for vector similarity search (only if vector type exists)
      if (hasPgvector) {
        try {
          // Drop old index if it exists (might be on wrong type)
          await client.query('DROP INDEX IF EXISTS document_chunks_embedding_idx;');
          
          await client.query(`
            CREATE INDEX document_chunks_embedding_idx 
            ON document_chunks 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
          `);
          console.log('✅ Vector index created successfully');
        } catch (error: any) {
          // Index creation fails if pgvector not available - that's OK
          if (error.message?.includes('type "vector" does not exist') ||
              error.message?.includes('access method "ivfflat" does not exist') ||
              error.message?.includes('does not accept data type')) {
            console.warn('⚠️  Skipping vector index:', error.message);
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      // If vector type not available, create table without vector column
      if (error.message?.includes('type "vector" does not exist')) {
        console.warn('⚠️  Creating table without vector column (pgvector not available)');
        await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          embedding JSONB,
          chunk_index INTEGER DEFAULT 0,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `);
      } else {
        throw error;
      }
    }
    
    // Add chunk_index column if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE document_chunks 
        ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;
      `);
    } catch (error: any) {
      console.log('Note: chunk_index column check:', error.message);
    }
    
    // Create index on document_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx 
      ON document_chunks(document_id);
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function insertDocument(
  filename: string,
  userId: string,
  metadata: Record<string, any> = {},
  riskCategory?: string,
  riskConfidence?: number,
  versionNumber: number = 1,
  parentDocumentId?: string,
  fileData?: Buffer,
  fileType?: string
) {
  const client = await pool.connect();
  try {
    // Check which columns exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name IN ('parent_document_id', 'file_data', 'file_type')
    `);
    
    const existingColumns = columnCheck.rows.map((r: any) => r.column_name);
    const hasParentDocId = existingColumns.includes('parent_document_id');
    const hasFileData = existingColumns.includes('file_data');
    const hasFileType = existingColumns.includes('file_type');
    
    // Build query dynamically based on available columns
    let columns = 'filename, user_id, metadata, risk_category, risk_confidence, version_number';
    let values = '$1, $2, $3, $4, $5, $6';
    let params: any[] = [filename, userId, JSON.stringify(metadata), riskCategory || null, riskConfidence || null, versionNumber];
    let paramIndex = 7;
    
    if (hasParentDocId && parentDocumentId) {
      columns += ', parent_document_id';
      values += `, $${paramIndex}`;
      params.push(parentDocumentId);
      paramIndex++;
    }
    
    if (hasFileData && fileData) {
      columns += ', file_data';
      values += `, $${paramIndex}`;
      params.push(fileData);
      paramIndex++;
    }
    
    if (hasFileType && fileType) {
      columns += ', file_type';
      values += `, $${paramIndex}`;
      params.push(fileType);
      paramIndex++;
    }
    
    const result = await client.query(
      `INSERT INTO documents (${columns}) 
       VALUES (${values}) 
       RETURNING id, filename, uploaded_at, risk_level, risk_category, risk_confidence, version_number;`,
      params
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Cache for pgvector availability check
let pgvectorAvailable: boolean | null = null;

async function checkPgvectorAvailable(): Promise<boolean> {
  if (pgvectorAvailable !== null) {
    return pgvectorAvailable;
  }
  
  const client = await pool.connect();
  try {
    // Check if vector type exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'vector'
      ) as exists;
    `);
    pgvectorAvailable = result.rows[0].exists;
    return pgvectorAvailable;
  } catch (error) {
    pgvectorAvailable = false;
    return false;
  } finally {
    client.release();
  }
}

// Helper function to sanitize text for PostgreSQL UTF-8 encoding
function sanitizeText(text: string): string {
  // Remove null bytes and other invalid UTF-8 sequences
  return text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove other control characters
    .trim();
}

export async function insertChunks(
  documentId: string,
  chunks: Array<{ content: string; embedding: number[]; metadata: Record<string, any> }>
) {
  const client = await pool.connect();
  try {
    const hasPgvector = await checkPgvectorAvailable();
    await client.query('BEGIN');
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Sanitize content to remove invalid UTF-8 sequences
      const sanitizedContent = sanitizeText(chunk.content);
      
      const chunkIndex = chunk.metadata?.chunkIndex ?? i;
      
      if (hasPgvector) {
        // Use vector type if pgvector is available
        await client.query(
          `INSERT INTO document_chunks (document_id, content, embedding, metadata, chunk_index) 
           VALUES ($1, $2, $3::vector, $4, $5)`,
          [documentId, sanitizedContent, JSON.stringify(chunk.embedding), JSON.stringify(chunk.metadata), chunkIndex]
        );
      } else {
        // Use JSONB if pgvector is not available
        await client.query(
          `INSERT INTO document_chunks (document_id, content, embedding, metadata, chunk_index) 
           VALUES ($1, $2, $3, $4, $5)`,
          [documentId, sanitizedContent, JSON.stringify(chunk.embedding), JSON.stringify(chunk.metadata), chunkIndex]
        );
      }
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.3,
  documentIds?: string[]
) {
  const hasPgvector = await checkPgvectorAvailable();
  
  // Always try text search first for documents without embeddings, then vector if available
  // This ensures we get results even if embeddings are missing
  
  // Step 1: Try to get chunks with vector embeddings (if pgvector available)
  if (hasPgvector) {
    try {
      let query = `SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.metadata,
          d.filename,
          d.risk_level,
          d.risk_category,
          1 - (dc.embedding <=> $1::vector) as similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.embedding IS NOT NULL`;
      
      const params: any[] = [JSON.stringify(queryEmbedding)];
      let paramIndex = 2;

      if (documentIds && documentIds.length > 0) {
        query += ` AND dc.document_id = ANY($${paramIndex})`;
        params.push(documentIds);
        paramIndex++;
      }

      // Lower threshold for better results
      query += ` AND 1 - (dc.embedding <=> $1::vector) > $${paramIndex}`;
      params.push(threshold);
      paramIndex++;

      query += ` ORDER BY dc.embedding <=> $1::vector LIMIT $${paramIndex}`;
      params.push(limit);
      
      const result = await pool.query(query, params);
      
      // If we got results from vector search, return them
      if (result.rows.length > 0) {
        console.log(`✅ Found ${result.rows.length} chunks using vector search`);
        return result.rows.map(row => ({
          id: row.id,
          documentId: row.document_id,
          content: row.content,
          metadata: row.metadata,
          filename: row.filename,
          riskLevel: row.risk_level,
          riskCategory: row.risk_category,
          similarity: parseFloat(row.similarity),
        }));
      }
    } catch (error) {
      console.warn('Vector search failed, falling back to text search:', error);
    }
  }
  
  // Step 2: Fallback to text search for ALL chunks (not just NULL embeddings)
  // This ensures we always return results if chunks exist
  console.log('⚠️  Using text search fallback (no vector embeddings or vector search failed)');
  return await searchByTextFallback('', limit, documentIds);
}

// Fallback text search for documents without embeddings or when vector search fails
async function searchByTextFallback(
  searchText: string = '',
  limit: number = 5,
  documentIds?: string[]
) {
  // Get ALL chunks (not just NULL embeddings) - this ensures we return results
  // We'll prioritize chunks without embeddings, but include all if needed
  let query = `SELECT 
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      d.filename,
      d.risk_level,
      d.risk_category,
      CASE 
        WHEN dc.embedding IS NULL THEN 0.6
        ELSE 0.4
      END as similarity
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE 1=1`; // Get all chunks, not just NULL embeddings
  
  const params: any[] = [];
  let paramIndex = 1;

  if (documentIds && documentIds.length > 0) {
    query += ` AND dc.document_id = ANY($${paramIndex})`;
    params.push(documentIds);
    paramIndex++;
  }

  // Order by: NULL embeddings first (higher priority), then by creation date
  query += ` ORDER BY 
      CASE WHEN dc.embedding IS NULL THEN 0 ELSE 1 END,
      dc.created_at DESC 
    LIMIT $${paramIndex}`;
  params.push(limit);
  
  const result = await pool.query(query, params);
  
  console.log(`📄 Text fallback found ${result.rows.length} chunks`);
  
  if (result.rows.length === 0) {
    console.warn('⚠️  No chunks found in database. Document may not have been processed correctly.');
  }
  
  return result.rows.map(row => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    metadata: row.metadata,
    filename: row.filename,
    riskLevel: row.risk_level,
    riskCategory: row.risk_category,
    similarity: parseFloat(row.similarity),
  }));
}

export async function updateDocumentRiskLevel(
  documentId: string, 
  riskLevel: 'Critical' | 'Warning' | 'Normal',
  riskCategory?: string,
  riskConfidence?: number
) {
  const result = await pool.query(
    `UPDATE documents SET risk_level = $1, risk_category = $3, risk_confidence = $4 WHERE id = $2 RETURNING id, risk_level, risk_category, risk_confidence;`,
    [riskLevel, documentId, riskCategory || null, riskConfidence || null]
  );
  return result.rows[0];
}

export async function updateDocumentFilename(
  documentId: string,
  userId: string,
  newFilename: string
) {
  const result = await pool.query(
    `UPDATE documents SET filename = $1 WHERE id = $2 AND user_id = $3 RETURNING id, filename;`,
    [newFilename, documentId, userId]
  );
  return result.rows[0];
}

export async function getDocuments(filters?: {
  riskLevel?: string;
  riskCategory?: string;
  documentIds?: string[];
}) {
  // Check if columns exist first
  const client = await pool.connect();
  try {
    // Get column info
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name IN ('risk_category', 'risk_confidence', 'version_number')
    `);
    
    const existingColumns = columnCheck.rows.map((r: any) => r.column_name);
    const hasRiskCategory = existingColumns.includes('risk_category');
    const hasRiskConfidence = existingColumns.includes('risk_confidence');
    const hasVersionNumber = existingColumns.includes('version_number');
    
    // Build SELECT query with only existing columns
    let selectColumns = 'id, filename, uploaded_at, risk_level, metadata';
    if (hasRiskCategory) selectColumns += ', risk_category';
    if (hasRiskConfidence) selectColumns += ', risk_confidence';
    if (hasVersionNumber) selectColumns += ', version_number';
    // Always include folder_id if it exists (it should after folder migration)
    selectColumns += ', folder_id';
    
    let query = `SELECT ${selectColumns} FROM documents WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.riskLevel) {
      query += ` AND risk_level = $${paramIndex}`;
      params.push(filters.riskLevel);
      paramIndex++;
    }

    if (filters?.riskCategory && hasRiskCategory) {
      query += ` AND risk_category = $${paramIndex}`;
      params.push(filters.riskCategory);
      paramIndex++;
    }

    if (filters?.documentIds && filters.documentIds.length > 0) {
      query += ` AND id = ANY($${paramIndex})`;
      params.push(filters.documentIds);
      paramIndex++;
    }

    if (filters?.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    query += ` ORDER BY uploaded_at DESC`;

    const result = await client.query(query, params);
    
    // Normalize results to always include these fields (null if column doesn't exist)
    return result.rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      uploaded_at: row.uploaded_at,
      risk_level: row.risk_level,
      risk_category: hasRiskCategory ? row.risk_category : null,
      risk_confidence: hasRiskConfidence ? row.risk_confidence : null,
      version_number: hasVersionNumber ? row.version_number : 1,
      folder_id: row.folder_id || null,
      metadata: row.metadata || {},
    }));
  } finally {
    client.release();
  }
}

export async function getDocument(documentId: string) {
  const result = await pool.query(
    `SELECT id, filename, uploaded_at, risk_level, metadata FROM documents WHERE id = $1;`,
    [documentId]
  );
  return result.rows[0] || null;
}

/**
 * Get document content (from chunks)
 */
export async function getDocumentContent(documentId: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT content FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [documentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Combine all chunks
    return result.rows.map((row: any) => row.content).join('\n\n');
  } finally {
    client.release();
  }
}
