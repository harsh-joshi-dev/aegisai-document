/**
 * DB schema for Aegis feature tables: deadlines, comments, risk clauses, policy matches, cases.
 */
import { pool } from './pgvector.js';

export async function initializeFeaturesSchema() {
  const client = await pool.connect();
  try {
    // Document deadlines/obligations (from extractor or manual)
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_deadlines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        due_type VARCHAR(50),
        reminder_sent BOOLEAN DEFAULT false,
        calendar_synced BOOLEAN DEFAULT false,
        severity VARCHAR(20) DEFAULT 'Medium',
        assignee_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_deadlines_document_id ON document_deadlines(document_id);
      CREATE INDEX IF NOT EXISTS idx_document_deadlines_user_due ON document_deadlines(user_id, due_date);
    `);

    // Internal comments/notes on documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        mentions UUID[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
    `);

    // Risk clauses (red/amber/green) per document - stored after analysis
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_risk_clauses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        severity VARCHAR(20) NOT NULL,
        clause_text TEXT NOT NULL,
        context_start INTEGER,
        context_end INTEGER,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_risk_clauses_document_id ON document_risk_clauses(document_id);
    `);

    // Cases: group documents for multi-document understanding
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_case_documents (
        case_id UUID NOT NULL REFERENCES document_cases(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (case_id, document_id)
      );
    `);

    // Policy documents (for policy vs contract matching)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // India SME Lending: Loan applications (ULI + DPDP)
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        uli_consent_id VARCHAR(255) NOT NULL,
        data_principal_id VARCHAR(100) NOT NULL,
        documents JSONB NOT NULL DEFAULT '{}',
        consistency_score INTEGER,
        risk_flags JSONB DEFAULT '[]',
        deletion_due_date DATE NOT NULL,
        audit_trail JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_loan_applications_user ON loan_applications(user_id);
      CREATE INDEX IF NOT EXISTS idx_loan_applications_deletion ON loan_applications(deletion_due_date);
      CREATE INDEX IF NOT EXISTS idx_loan_applications_data_principal ON loan_applications(data_principal_id);
    `);

    console.log('✅ Features schema (deadlines, comments, risk clauses, cases, policies, loan_applications) initialized');
  } catch (error) {
    console.error('Error initializing features schema:', error);
    throw error;
  } finally {
    client.release();
  }
}
