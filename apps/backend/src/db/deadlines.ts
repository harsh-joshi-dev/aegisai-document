import { pool } from './pgvector.js';

export interface DeadlineRow {
  id: string;
  document_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_type: string | null;
  reminder_sent: boolean;
  calendar_synced: boolean;
  severity: string;
  assignee_type: string | null;
  created_at: string;
  updated_at: string;
}

export async function insertDeadline(
  tenantId: string,
  documentId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    due_date: string;
    due_type?: string;
    severity?: string;
    assignee_type?: string;
  }
): Promise<DeadlineRow | null> {
  const result = await pool.query(
    `INSERT INTO document_deadlines (tenant_id, document_id, user_id, title, description, due_date, due_type, severity, assignee_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tenantId,
      documentId,
      userId,
      data.title,
      data.description || null,
      data.due_date,
      data.due_type || null,
      data.severity || 'Medium',
      data.assignee_type || null,
    ]
  );
  return ((result.rows[0] as unknown) as DeadlineRow) || null;
}

export async function getDeadlinesByDocument(tenantId: string, documentId: string): Promise<DeadlineRow[]> {
  const result = await pool.query(
    `SELECT * FROM document_deadlines WHERE tenant_id = $1 AND document_id = $2 ORDER BY due_date ASC`,
    [tenantId, documentId]
  );
  return (result.rows as unknown) as DeadlineRow[];
}

export async function getDeadlinesByTenant(tenantId: string, options?: { from?: string; to?: string }): Promise<DeadlineRow[]> {
  let query = `SELECT * FROM document_deadlines WHERE tenant_id = $1`;
  const params: (string | number)[] = [tenantId];
  if (options?.from) {
    params.push(options.from);
    query += ` AND due_date >= $${params.length}`;
  }
  if (options?.to) {
    params.push(options.to);
    query += ` AND due_date <= $${params.length}`;
  }
  query += ` ORDER BY due_date ASC`;
  const result = await pool.query(query, params);
  return (result.rows as unknown) as DeadlineRow[];
}

export async function markDeadlineReminderSent(tenantId: string, id: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE document_deadlines SET reminder_sent = true, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2 AND user_id = $3`,
    [tenantId, id, userId]
  );
}

export async function markDeadlineCalendarSynced(tenantId: string, id: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE document_deadlines SET calendar_synced = true, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2 AND user_id = $3`,
    [tenantId, id, userId]
  );
}

export async function deleteDeadline(tenantId: string, id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM document_deadlines WHERE tenant_id = $1 AND id = $2 AND user_id = $3`,
    [tenantId, id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
