# Aegis AI — Product Documentation

> **Decision Intelligence Platform for Modern Finance**

Aegis AI is a full-stack document intelligence and risk analysis platform designed for financial operations teams. It processes uploaded documents (invoices, bank statements, GST returns, P&L statements, and more), extracts structured financial data, classifies risk, and provides an AI-powered workspace for approvals, compliance, and vendor management.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Authentication & Multi-Tenancy](#authentication--multi-tenancy)
4. [Document Pipeline](#document-pipeline)
5. [Risk Intelligence Engine](#risk-intelligence-engine)
6. [AI Agent Swarm](#ai-agent-swarm)
7. [RAG Chat System](#rag-chat-system)
8. [Vendor Portal & Management](#vendor-portal--management)
9. [Approval Workflow](#approval-workflow)
10. [Compliance & Audit](#compliance--audit)
11. [Frontend Application](#frontend-application)
12. [API Reference](#api-reference)
13. [Database Schema](#database-schema)
14. [Configuration](#configuration)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Frontend                            │
│   Auth · Dashboard · Documents · Vendor Portal · Rules · Chat    │
└──────────────────────┬───────────────────────────────────────────┘
                       │  Axios + JWT / Session
┌──────────────────────▼───────────────────────────────────────────┐
│                     Express Backend (Node.js)                     │
│                                                                   │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌────────────────┐   │
│  │  Upload  │  │  Risk     │  │  Agent   │  │  RAG / Chat    │   │
│  │ Pipeline │  │  Engine   │  │  Swarm   │  │  (LangChain)   │   │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───────┬────────┘   │
│       │              │             │                │             │
│  ┌────▼──────────────▼─────────────▼────────────────▼──────────┐ │
│  │              PostgreSQL + pgvector                           │ │
│  │  documents · chunks · embeddings · risk_signals · rules     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐   │
│  │  Redis   │  │  BullMQ  │  │  OpenAI (GPT-4o-mini +       │   │
│  │  Cache   │  │  Queue   │  │  text-embedding-3-small)     │   │
│  └──────────┘  └──────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Monorepo structure** managed by npm workspaces:

```
aegis-ai/
├── apps/
│   ├── backend/    # Express API server
│   └── web/        # React SPA (Vite + Tailwind v4)
├── docs/           # Documentation
└── package.json    # Root workspace config
```

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL 14+ with pgvector extension |
| Queue | BullMQ + Redis (IORedis) |
| AI / LLM | OpenAI GPT-4o-mini via LangChain |
| Embeddings | OpenAI text-embedding-3-small (1536 dimensions) |
| Auth | Passport.js (Google OAuth 2.0) + JWT + sessions |
| File parsing | pdf-parse, mammoth (DOCX), xlsx, tesseract.js (OCR) |
| Email | Nodemailer (SMTP) |
| Scheduling | node-cron (alerts, DPDP compliance) |
| Validation | Zod |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v6 |
| Charts | Recharts |
| Icons | Lucide React |
| Animation | Framer Motion |
| HTTP | Axios (with offline queue) |

---

## Authentication & Multi-Tenancy

### Authentication Flow

1. User clicks "Continue with Google" on the auth page
2. Frontend redirects to `GET /api/auth/google` (Passport Google OAuth)
3. Google callback issues a one-time token and redirects to the frontend with `?auth_token=`
4. Frontend calls `POST /api/auth/token-exchange` to exchange the token for a server-side session and a JWT (30-day expiry)
5. Subsequent requests carry the JWT via `Authorization: Bearer` header or use the session cookie

### Multi-Tenancy (Workspaces)

Every authenticated request is scoped to a **workspace** (tenant):

- **Tenants table** stores workspace id, name, domain, branding, and settings
- **Tenant memberships** link users to tenants with roles: `owner`, `admin`, `reviewer`, `viewer`
- `requireWorkspaceContext` middleware resolves the active tenant from the session (or the user's default tenant) and attaches `req.workspace = { tenantId, role }` to every request
- Users can switch workspaces via `POST /api/workspaces/select`
- All document, folder, rule, risk, and approval data is isolated per tenant

### Role-Based Access Control

| Role | Permissions |
|------|------------|
| **Owner** | Full access: upload, approve/reject, manage rules, settings, users, delete data |
| **Admin** | Same as Owner within the workspace |
| **Reviewer** | View documents, approve/reject, add comments |
| **Viewer** | Read-only access to documents and dashboards |

---

## Document Pipeline

When a document is uploaded, it goes through a multi-stage processing pipeline:

```
Upload (PDF/DOCX/XLSX/Image/Text)
   │
   ▼
1. Parse → extract raw text (pdf-parse / mammoth / xlsx / tesseract OCR)
   │
   ▼
2. Classify → AI risk classification (Critical / Warning / Normal)
   │         with category (Legal, Financial, Compliance, Operational, Other)
   │
   ▼
3. Extract → structured financial data extraction (regex + heuristics)
   │         document type, vendor, amounts, GST, dates, invoice numbers
   │
   ▼
4. Summarize → AI-generated financial summary (GPT-4o-mini)
   │
   ▼
5. Risk Score → financial risk scoring based on extracted data
   │
   ▼
6. Chunk → split text into overlapping chunks for RAG
   │
   ▼
7. Embed → generate vector embeddings (text-embedding-3-small, 1536d)
   │
   ▼
8. Auto-Folder → optionally assign to vendor-based folder
   │
   ▼
9. Store → document + chunks + embeddings persisted to PostgreSQL
```

### Supported Upload Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| Single file | `POST /api/upload` | PDF, DOCX, XLSX, images (with OCR) |
| Bulk upload | `POST /api/upload/bulk` | 10–100 files, async BullMQ processing |
| Text paste | `POST /api/upload/text` | Raw text as virtual document |
| Email body | `POST /api/upload/email` | Email content as document |
| Vendor portal | `POST /api/vendor-links/portal/:token/upload` | Public vendor upload |

### Document Types Detected

Invoice, Bank Statement, GST Return, Profit & Loss, Balance Sheet, Tax Return, Contract/Agreement, Identity Document (Aadhaar, PAN), Purchase Order, Receipt, Credit Note, Salary Slip, and more.

### Financial Data Extraction

The extraction service pulls structured data from documents without LLM dependency (regex + heuristics):

- Document type classification
- Invoice number, date, due date
- Vendor name and GSTIN
- Total amount, taxable amount, GST breakdown (CGST/SGST/IGST)
- Currency detection (INR default)
- Line items and key dates

---

## Risk Intelligence Engine

The Risk Engine computes a unified risk score (0–100) for each document by aggregating signals from multiple sources.

### Architecture

```
Document
   │
   ├──► Rule Engine ────────► Risk Signals (rule_violation)
   ├──► Pattern Detection ──► Risk Signals (pattern, anomaly)
   └──► AI Analysis ────────► Risk Signals (ai_finding)
   │
   ▼
Aggregator → weighted score + level + recommendations
   │
   ▼
Risk Result (persisted)
```

### Risk Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0–30 | **Safe** | No significant issues |
| 31–60 | **Review** | Requires manual review |
| 61–80 | **High** | Significant risk factors |
| 81–100 | **Critical** | Immediate attention needed |

### Dynamic Rules (V2)

Workspace admins can create custom rules that generate risk signals:

| Rule Type | Example | Signal Generated |
|-----------|---------|-----------------|
| **Threshold** | `amount > 500000` | Flags documents exceeding amount limits |
| **Required Field** | `gst` | Flags documents missing mandatory fields |
| **Consistency** | `gst valid`, `amount > 0` | Validates data integrity |
| **Time-based** | Configurable time constraints | Flags timing anomalies |

### Pattern Detection

Cross-document pattern analysis across the tenant:

- **Duplicate amounts** across vendors (high-value)
- **Rapid amount increases** (2x+ previous maximum for the same vendor)
- **First high-value transactions** with new vendors
- **Vendor memory** tracking (running statistics per vendor: count, mean, variance, last amount)

### Vendor Insights

Per-document vendor analysis stored in `document_insights`:
- Consistency score and risk score per vendor
- Risk reasons and recommendations
- Detected patterns (stored in `pattern_events`)

---

## AI Agent Swarm

The Agent Swarm runs a multi-agent pipeline on any document for deep analysis:

```
Orchestrator
   │
   ├─ 1. Extractor Agent     → terms, dates, obligations, parties, amounts
   ├─ 2. Risk Analyst Agent   → current risks, predicted risks, score, recommendations
   ├─ 3. Compliance Agent     → regulatory compliance analysis
   ├─ 4. Negotiation Agent    → negotiation strategy generation
   └─ 5. Action Agent         → actionable next-steps plan
```

**Endpoint:** `POST /api/agent-swarm`

Returns a unified `AgentSwarmResult` with per-agent status, execution time, and combined insights. Additional specialized agents include `dueDiligenceReportAgent` and `negotiationPrep`.

---

## RAG Chat System

The Retrieval-Augmented Generation system enables natural-language Q&A over uploaded documents.

### Flow

1. User sends a question via `POST /api/chat`
2. Question is embedded using `text-embedding-3-small`
3. `searchSimilarChunks` finds the top-K most relevant chunks (cosine similarity via pgvector)
4. Retrieved chunks are passed as context to GPT-4o-mini
5. Response includes: answer, confidence score, citations (document ID, filename, content snippet, similarity score)

### Features

- **Scoped queries**: optionally restrict to specific document IDs
- **Multi-language**: responses in user's preferred language
- **Quick questions**: `POST /api/chat/quick-questions` generates suggested questions for a document
- **Document explanation**: multi-level explanation (simple / detailed / technical)
- **Location-aware**: optional user location context for region-specific answers
- **Service provider suggestions**: for "next steps" queries, appends relevant local service providers

---

## Vendor Portal & Management

A complete vendor document collection and review workflow.

### Vendor Links

Internal users create **vendor links** — secure, tokenized URLs for external vendors to submit documents.

| Feature | Description |
|---------|-------------|
| **Templates** | Predefined document checklists: Contractor, Vendor, Employee, Custom |
| **Bulk creation** | Create multiple vendor links at once |
| **Progress tracking** | Real-time submission progress (mandatory/optional docs) |
| **Folder status** | `pending` → `under_review` → `verified` / `rejected` |
| **Lock/Unlock** | Lock submissions once review starts |
| **Reminders** | Send email reminders to vendors |
| **Per-document review** | Approve, reject, or request re-upload per document |
| **Comments** | Threaded comments on vendor link |
| **Activity log** | Full audit trail of all actions |

### Public Vendor Portal

Vendors access `GET /vendor-portal/:token` (no authentication required):

- View required documents checklist
- Upload files via drag-and-drop
- See submission progress and review status per document
- Re-upload rejected documents

### Vendor Analysis

- `POST /api/vendor-links/:linkId/analyze` — Run comprehensive vendor document analysis (missing docs, mismatches, format errors, fraud indicators, cross-document consistency)
- `POST /api/vendor-links/:linkId/financial-analysis` — Aggregate financial data across all vendor documents (revenue, expenses, profit, tax summaries, untraced items, monthly trends)
- `POST /api/vendor-links/:linkId/reprocess` — Re-run extraction, summary, and risk scoring on all vendor documents

---

## Approval Workflow

Documents follow a structured approval lifecycle:

```
Uploaded → Pending Review → Approved / Rejected / Info Requested
                                          │
                                          ▼
                                  Info Submitted → Pending Review (cycle)
```

### Actions

| Action | Endpoint | Who |
|--------|----------|-----|
| Approve | `POST /api/documents/:id/approve` | Owner, Admin, Reviewer |
| Reject | `POST /api/documents/:id/reject` | Owner, Admin, Reviewer (with notes) |
| Request Info | `POST /api/documents/:id/request-info` | Owner, Admin, Reviewer |
| Bulk Approve | Via frontend (calls approve per document) | Owner, Admin |
| Bulk Reject | Via frontend (calls reject per document) | Owner, Admin |

All approval actions are recorded in the `approvals` table and audit log.

---

## Compliance & Audit

### Audit Logging

Every significant action is recorded:
- Document uploads, approvals, rejections, deletions
- Rule changes, workspace settings updates
- Vendor link lifecycle events
- Compliance exports and data deletion

**Endpoint:** `GET /api/compliance/audit-logs` (with filters)

### GDPR Compliance

| Endpoint | Purpose |
|----------|---------|
| `POST /api/compliance/gdpr/export` | Export all user data |
| `POST /api/compliance/gdpr/delete` | Delete all user data (right to erasure) |

### DPDP (India Digital Personal Data Protection)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/compliance/dpdp/delete` | Auto-deletion after retention period (default 90 days) |
| `POST /api/compliance/dpdp/rights` | Data principal rights requests (access/correction/erasure) |
| `GET /api/compliance/dpdp/rights` | List rights requests |
| `POST /api/compliance/dpdp/transfer-blocker` | Check if data transfer to a country is allowed |

### Compliance Dashboard

`GET /api/compliance/metrics` — Aggregated compliance health metrics
`GET /api/compliance/report` — Period-based compliance report

### Automated Enforcement

- `node-cron` job for DPDP auto-deletion based on retention policies
- Alert scheduling for risk monitoring

---

## Frontend Application

### Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | HomePage | Landing page with feature overview and demo |
| `/auth` | AuthPage | Google OAuth login |
| `/onboarding` | OnboardingPage | Workspace setup and team invitation |
| `/dashboard` | DecisionDashboardPage | KPI cards, risk charts, activity timeline, approval queue |
| `/documents` | DocumentsPage | Document list with filters, bulk actions, archive |
| `/document/:id` | DocumentDetailPage | Document preview, risk analysis, approval actions, tabs (Overview, Issues, Data, Activity) |
| `/vendor-links` | VendorLinksPage | Vendor link management, creation, bulk import |
| `/vendor-links/:linkId` | VendorLinkDetailPage | Vendor detail with issues, financials, documents, comments, audit tabs |
| `/vendor-portal/:token` | VendorPortalPage | Public vendor upload portal |
| `/rules` | RulesPage | Risk rules engine (create threshold/required/consistency rules) |
| `/reports` | ReportsPage | Report generation (PDF/CSV), report history |
| `/users` | UsersPage | Team management, invite members |
| `/settings` | SettingsPage | Workspace settings (assignment strategy, SLA, escalation) |

### Dashboard Features

- **KPI Cards**: Total processed, pending review, SLA breached, high-risk count
- **Risk Distribution**: Donut chart and bar chart (Recharts)
- **Activity Timeline**: Recent document events
- **My Queue**: Documents assigned to the current user
- **Critical Alerts**: High-risk items requiring immediate attention

### Document Detail

- **PDF/Image Preview**: Inline viewer with issue pin overlay
- **Decision Panel**: One-click approve, reject, or request info
- **Risk Score**: Unified score with breakdown of risk signals
- **Tabs**: Overview (AI summary, mismatches, recommendations), Issues, Extracted Data, Activity

### State Management

| Store | Purpose |
|-------|---------|
| `AuthProvider` | User session, JWT, login/logout |
| `WorkspaceProvider` | Active workspace, role, workspace list |
| `StoreProvider` | Documents, rules, users, activity, notifications, audit |
| `ToastProvider` | Toast notifications |

### UI Design

- Dark theme (`#030304` background) with indigo/purple accent glows
- Sidebar navigation with workspace switcher
- Premium card styling with noise texture
- Responsive layout with mobile hamburger sidebar
- Offline-capable with request queue for non-upload operations

---

## API Reference

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| POST | `/api/auth/token-exchange` | Exchange one-time token for session + JWT |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Logout |

### Workspaces
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workspaces` | List user's workspaces |
| POST | `/api/workspaces/select` | Switch active workspace |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload single file |
| POST | `/api/upload/bulk` | Bulk upload (10–100 files) |
| POST | `/api/upload/text` | Upload text content |
| POST | `/api/upload/email` | Upload email body |
| GET | `/api/documents` | List documents (workspace-scoped) |
| GET | `/api/documents/:id` | Document detail |
| GET | `/api/documents/:id/content` | Document text content |
| GET | `/api/documents/:id/file` | Original file download |
| GET | `/api/documents/:id/status` | Processing status |
| GET | `/api/documents/:id/risk` | Risk analysis result |
| GET | `/api/documents/:id/analysis` | Full analysis (document + risk) |
| PUT | `/api/documents/:id/rename` | Rename document |
| DELETE | `/api/documents/:id` | Delete document |
| POST | `/api/documents/:id/approve` | Approve document |
| POST | `/api/documents/:id/reject` | Reject document |
| POST | `/api/documents/:id/request-info` | Request additional info |

### Folders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/folders` | List folders with document counts |
| POST | `/api/folders` | Create folder |
| PUT | `/api/folders/:id` | Rename folder |
| DELETE | `/api/folders/:id` | Delete folder |
| POST | `/api/folders/:id/documents/:docId` | Move document to folder |
| DELETE | `/api/folders/:id/documents/:docId` | Remove document from folder |
| POST | `/api/folders/organize-by-year` | Auto-organize into FY folders |
| POST | `/api/folders/organize-by-vendor` | Auto-organize into vendor folders |

### Chat & AI
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | RAG query (question, language, topK, documentIds) |
| POST | `/api/chat/quick-questions` | Generate suggested questions |
| POST | `/api/explain` | Document explanation |
| POST | `/api/what-if` | What-if scenario simulation |
| POST | `/api/trust-score` | Document trust scoring |
| POST | `/api/scam-score` | Scam likelihood scoring |
| POST | `/api/finance-tools` | Financial analysis tools |
| POST | `/api/action-intelligence` | AI-powered action recommendations |
| POST | `/api/financial-impact` | Financial impact analysis |
| POST | `/api/agent-swarm` | Run multi-agent analysis |

### Risk & Rules
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/risk/analyze-ai` | AI-powered risk analysis |
| GET | `/api/rules` | List custom rules |
| POST | `/api/rules` | Create custom rule |
| PUT | `/api/rules/:id` | Update rule |
| DELETE | `/api/rules/:id` | Delete rule |
| POST | `/api/rules/evaluate` | Evaluate rules against text |
| GET | `/api/rules/v2` | List dynamic rules (V2) |
| POST | `/api/rules/v2` | Create dynamic rule |
| PUT | `/api/rules/v2/:id` | Update dynamic rule |
| DELETE | `/api/rules/v2/:id` | Delete dynamic rule |

### Vendor Portal
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vendor-links` | List vendor links (with filters) |
| POST | `/api/vendor-links` | Create vendor link |
| POST | `/api/vendor-links/bulk` | Bulk create vendor links |
| GET | `/api/vendor-links/templates` | List document templates |
| POST | `/api/vendor-links/templates` | Create template |
| GET | `/api/vendor-links/:id` | Vendor link detail |
| POST | `/api/vendor-links/:id/analyze` | Run vendor analysis |
| POST | `/api/vendor-links/:id/financial-analysis` | Run financial analysis |
| POST | `/api/vendor-links/:id/reprocess` | Re-process all documents |
| POST | `/api/vendor-links/:id/review` | Set folder review status |
| POST | `/api/vendor-links/:id/documents/:docId/review` | Per-document review |
| POST | `/api/vendor-links/:id/comments` | Add comment |
| POST | `/api/vendor-links/:id/lock` | Lock submissions |
| POST | `/api/vendor-links/:id/unlock` | Unlock submissions |
| POST | `/api/vendor-links/:id/remind` | Send reminder |
| GET | `/api/vendor-links/:id/report` | Audit report |
| GET | `/api/vendor-links/portal/:token` | Public portal info |
| POST | `/api/vendor-links/portal/:token/upload` | Public vendor upload |

### Compliance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/compliance/metrics` | Compliance dashboard metrics |
| GET | `/api/compliance/report` | Compliance report |
| GET | `/api/compliance/audit-logs` | Audit logs |
| POST | `/api/compliance/gdpr/export` | GDPR data export |
| POST | `/api/compliance/gdpr/delete` | GDPR data deletion |
| POST | `/api/compliance/dpdp/delete` | DPDP auto-deletion |
| POST | `/api/compliance/dpdp/rights` | DPDP rights request |
| GET | `/api/compliance/dpdp/rights` | List DPDP rights |
| POST | `/api/compliance/dpdp/transfer-blocker` | Transfer country check |

### Other
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/report` | Generate audit summary report |
| GET | `/api/dashboard` | Dashboard health metrics |
| POST | `/api/compare` | Compare financial documents |
| POST | `/api/negotiation` | Negotiation preparation |
| POST | `/api/drafts` | Generate document draft |
| POST | `/api/share-summary` | Share document summary |
| POST | `/api/policy-matcher` | Match policy with contract |
| GET | `/api/deadlines` | List deadlines |
| POST | `/api/deadlines` | Create deadline |
| GET | `/api/insights` | AI insights |
| POST | `/api/voice` | Voice query |
| GET | `/health` | Health check |

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, email, name, picture, google_id) |
| `tenants` | Workspaces (id, name, domain, branding, settings) |
| `tenant_memberships` | User ↔ Workspace mapping with roles |
| `session` | Express session store (connect-pg-simple) |

### Document Tables

| Table | Purpose |
|-------|---------|
| `documents` | All uploaded documents with metadata, extracted data, risk scores, processing status, folder assignment, vendor name |
| `document_chunks` | Text chunks with vector embeddings (1536d) for RAG |
| `folders` | Workspace-scoped folder organization |
| `approvals` | Document approval status and reviewer notes |
| `comparisons` | Saved document comparison results |
| `audit_reports` | Generated audit report content |

### Risk Tables

| Table | Purpose |
|-------|---------|
| `risk_signals` | Individual risk signals per document (type, severity, confidence, weight, explanation) |
| `risk_results` | Aggregated risk score and level per document |
| `dynamic_rules` | Workspace-scoped configurable risk rules |
| `custom_rules` | Legacy custom rules (pattern/keyword/prompt based) |

### Vendor Tables

| Table | Purpose |
|-------|---------|
| `vendor_links` | Vendor portal links with token, status, template, contact info |
| `vendor_link_comments` | Comments on vendor links |
| `vendor_link_activity` | Vendor link activity/audit log |
| `vendor_document_status` | Per-document review status within vendor links |
| `vendor_memory` | Running vendor statistics (count, mean, variance, last amount) |

### Analytics Tables

| Table | Purpose |
|-------|---------|
| `document_insights` | Per-document vendor insights (consistency score, risk reasons, patterns) |
| `pattern_events` | Detected cross-document patterns and anomalies |

### Extensions

- **pgcrypto** — UUID generation (`gen_random_uuid()`)
- **vector** (pgvector) — Vector similarity search for embeddings; falls back to JSONB if unavailable

---

## Configuration

### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/aegis_ai` | Yes | PostgreSQL connection string |
| `REDIS_URL` | `redis://127.0.0.1:6379` | No | Redis for BullMQ queues |
| `OPENAI_API_KEY` | — | Yes | OpenAI API key for LLM + embeddings |
| `GOOGLE_CLIENT_ID` | — | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Yes | Google OAuth client secret |
| `SESSION_SECRET` | `aegis-ai-secret-key-change-in-production` | Yes (change) | Session encryption + JWT fallback |
| `PORT` | `3001` | No | Backend server port |
| `NODE_ENV` | `development` | No | Environment mode |
| `FRONTEND_URL` | `http://localhost:5173` | No | Frontend base URL (no trailing slash) |
| `BACKEND_URL` | `http://localhost:3001` | No | Backend base URL (OAuth callbacks) |
| `CORS_ORIGIN` | (derived from FRONTEND_URL) | No | Allowed CORS origin |
| `SMTP_HOST` | — | No | SMTP server for emails |
| `SMTP_PORT` | — | No | SMTP port |
| `SMTP_USER` | — | No | SMTP username |
| `SMTP_PASSWORD` | — | No | SMTP password |
| `FROM_EMAIL` | — | No | Sender email address |
| `GOOGLE_PLACES_API_KEY` | — | No | Google Places (geocode) |
| `SARVAM_API_KEY` | — | No | Sarvam AI (voice/vision) |
| `ULI_BASE_URL` | ULI sandbox | No | India Unified Lending Interface |
| `ULI_CLIENT_ID` | — | No | ULI client credentials |
| `ULI_CLIENT_SECRET` | — | No | ULI client credentials |
| `DPDP_APPROVED_COUNTRIES` | `IN` | No | DPDP transfer whitelist |

### Running Locally

```bash
# Install all dependencies
npm run install:all

# Set up environment
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your credentials

# Ensure PostgreSQL is running with pgvector
# CREATE EXTENSION IF NOT EXISTS vector;

# Start both backend and frontend
npm run dev
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

### Build

```bash
npm run build
# Backend: apps/backend/dist/
# Frontend: apps/web/dist/
```
