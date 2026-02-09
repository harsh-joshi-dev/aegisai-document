import { pool } from './pgvector.js';

/** Set high for unlimited uploads; can be lowered later for quotas */
export const MAX_DOCUMENTS_PER_USER = 999_999;

/**
 * Check if user has reached document limit
 */
export async function checkDocumentLimit(userId: string): Promise<{
  allowed: boolean;
  currentCount: number;
  maxCount: number;
  remaining: number;
}> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM documents WHERE user_id = $1`,
      [userId]
    );

    const currentCount = parseInt(String((result.rows[0] as Record<string, unknown>).count), 10);
    const allowed = currentCount < MAX_DOCUMENTS_PER_USER;
    const remaining = Math.max(0, MAX_DOCUMENTS_PER_USER - currentCount);

    return {
      allowed,
      currentCount,
      maxCount: MAX_DOCUMENTS_PER_USER,
      remaining,
    };
  } finally {
    client.release();
  }
}

/**
 * Get user's document count
 */
export async function getUserDocumentCount(userId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM documents WHERE user_id = $1`,
      [userId]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>).count), 10);
  } finally {
    client.release();
  }
}
