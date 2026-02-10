# Aegis AI – Implementation Summary

This document describes what has been implemented in the Aegis AI project: features, APIs, and architecture.

---

## 1. Overview

**Aegis AI** is an offline-first intelligent document and operations assistant. It uses **RAG (Retrieval-Augmented Generation)** to answer questions from uploaded documents with citations and risk classification. The system includes a **Node.js/Express backend**, a **React (Vite) web app**, a **Python FastAPI integration API**, and **mobile-responsive** and **mobile-shell** flows.

---

## 2. Tech Stack

| Layer        | Technology |
|-------------|------------|
| Backend     | Node.js, TypeScript, Express, LangChain, pgvector, PostgreSQL, Passport (Google OAuth), express-session (PG store) |
| Frontend    | React 18, TypeScript, Vite, React Router, Axios, Recharts |
| Database    | PostgreSQL with pgvector extension |
| Integrations| Python FastAPI (API keys, jobs, webhooks) |

---

## 3. Backend APIs (Express)

All API routes are under `/api/`. Authentication uses session-based Google OAuth; many routes use `requireAuth`.

### 3.1 Auth
- **GET** `/api/auth/google` – Initiate Google OAuth
- **GET** `/api/auth/google/callback` – OAuth callback
- **GET** `/api/auth/me` – Current user (requires auth)
- **POST** `/api/auth/logout` – Logout

### 3.2 Documents & Upload
- **POST** `/api/upload` – Upload file (PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, WEBP). Parsing, chunking, embeddings, risk classification, document-type classification, rules evaluation, per-user document limits.
- **POST** `/api/upload/text` – Ingest raw text as a document
- **POST** `/api/upload/email` – Ingest document from email
- **GET** `/api/documents` – List user’s documents
- **PUT** `/api/documents/:documentId/rename` – Rename document
- **GET** `/api/documents/:documentId/shared` – Get shared document (public link)

### 3.3 Chat & RAG
- **POST** `/api/chat` – RAG Q&A over selected documents; returns answer, confidence, citations, and optional service-provider suggestions when the user asks for “next steps” or help.
- **POST** `/api/chat/quick-questions` – Pre-generated quick questions for a document

### 3.4 Explain, Translate, Geocode
- **POST** `/api/explain` – Explain document or section (auth)
- **POST** `/api/translate` – Translate content (auth)
- **GET** `/api/geocode/reverse` – Reverse geocode (lat/lng → address)

### 3.5 Compare & Rules
- **POST** `/api/compare` – Compare two documents (upload + analysis)
- **POST** `/api/rules` – Create rule
- **GET** `/api/rules` – List rules
- **GET** `/api/rules/:ruleId` – Get rule
- **PUT** `/api/rules/:ruleId` – Update rule
- **DELETE** `/api/rules/:ruleId` – Delete rule
- **POST** `/api/rules/evaluate` – Evaluate rules (e.g. on document)

### 3.6 Templates & Negotiation
- **POST** `/api/templates/generate` – Generate document from template
- **POST** `/api/negotiation/prepare` – Prepare negotiation (strategy, talking points)

### 3.7 Analytics, Dashboard, Benchmarking
- **GET** `/api/analytics/trends` – Risk/usage trends
- **GET** `/api/analytics/exposure` – Exposure metrics
- **GET** `/api/dashboard/health` – Dashboard health (auth)
- **GET** `/api/benchmarking/compare` – Benchmark comparison

### 3.8 Redaction & Compliance
- **POST** `/api/redaction/redact` – Redact PII/sensitive content
- **POST** `/api/redaction/sanitize` – Sanitize for analysis
- **GET** `/api/compliance/metrics` – Compliance metrics
- **GET** `/api/compliance/report` – Compliance report
- **GET** `/api/compliance/audit-logs` – Audit logs
- **POST** `/api/compliance/gdpr/export` – GDPR data export
- **POST** `/api/compliance/gdpr/delete` – GDPR delete
- **POST** `/api/compliance/retention/enforce` – Enforce retention

### 3.9 SSO & White-label
- **GET** `/api/sso/saml/metadata` – SAML metadata
- **POST** `/api/sso/saml/callback` – SAML callback
- **GET** `/api/sso/oidc/authorize` – OIDC authorize
- **GET** `/api/sso/oidc/callback` – OIDC callback
- **GET** `/api/white-label/branding` – Tenant branding
- **PUT** `/api/white-label/branding` – Update branding
- **POST** `/api/white-label/tenants` – Create tenant

### 3.10 Alerts & Reports
- **POST** `/api/alerts/check` – Check/trigger alerts
- **GET** `/api/alerts/pending` – Pending alerts
- **POST** `/api/alerts/:alertId/sent` – Mark alert sent
- **POST** `/api/reports/generate` – Generate report

### 3.11 Service Providers & Location
- **POST** `/api/service-providers` – Get providers by category (Legal, Financial, Compliance, etc.) and lat/lng
- **POST** `/api/service-providers/nearby` – Get nearby providers by lat/lng and radius

### 3.12 What-If, Voice, Trust Score
- **POST** `/api/what-if` – What-if scenario (auth)
- **POST** `/api/voice/query` – Voice query (auth)
- **POST** `/api/trust-score` – Compute trust score (auth)

### 3.13 Agent Swarm
- **POST** `/api/agent-swarm` – Run multi-agent analysis on a document (extractor, risk analyst, compliance, negotiation, action plan). Optional `userParty` and `jurisdictions`.

### 3.14 Mobile
- **POST** `/api/mobile/push/subscribe` – Push subscription (auth)
- **POST** `/api/mobile/webauthn/challenge` – WebAuthn challenge (auth)
- **POST** `/api/mobile/webauthn/verify` – WebAuthn verify (auth)

### 3.15 Folders & Verification & Completeness
- **GET** `/api/folders` – List folders (auth)
- **POST** `/api/folders` – Create folder (auth)
- **PUT** `/api/folders/:folderId` – Update folder (auth)
- **DELETE** `/api/folders/:folderId` – Delete folder (auth)
- **POST** `/api/folders/:folderId/documents/:documentId` – Add document to folder (auth)
- **DELETE** `/api/folders/:folderId/documents/:documentId` – Remove document from folder (auth)
- **POST** `/api/folders/organize-by-year` – Auto-organize by year (auth)
- **POST** `/api/verify/:documentId` – Verify document (auth)
- **POST** `/api/completeness/:documentId` – Document completeness check (auth)

### 3.16 Finance Tools
- **GET** `/api/finance-tools/list` – List available finance tools (auth)
- **POST** `/api/finance-tools/run` – Run a finance tool (e.g. bank/credit card statements analysis) (auth)

### 3.17 Health
- **GET** `/health` – Backend health check (no auth)

---

## 4. Core Backend Services

- **Document parsing** – PDF (pdf-parse, pdf2pic), DOC/DOCX (mammoth), XLS/XLSX (xlsx), images (Tesseract OCR). Optional on-prem LLM.
- **Chunker** – Text chunking with overlap for RAG.
- **Embeddings** – OpenAI (or configurable) embeddings; stored in pgvector.
- **RAG** – Similarity search over chunks, QA prompt, LLM (e.g. gpt-4o-mini). Citations and confidence; optional service-provider suggestions for “next steps” questions.
- **Classifier** – Document risk level (Critical, Warning, Normal) and confidence.
- **Document type classifier** – Document type and financial year extraction.
- **Rules engine** – User-defined rules evaluated on upload; stored in DB.
- **Redaction/sanitizer** – PII/sensitive data handling (e.g. Presidio-style).
- **Agent swarm** – Orchestrator running: Extractor, Risk Analyst, Compliance, Negotiation Prep, Action Plan agents.
- **Service providers** – Category + location-based provider lookup (Legal, Financial, Compliance, Operational, Medical).
- **Email** – SMTP (e.g. welcome email, document notifications); config verified at startup.
- **Compliance** – Audit logging, GDPR export/delete, retention enforcement.
- **White-label** – Tenant and branding support.

---

## 5. Database (PostgreSQL + pgvector)

- **pgvector** – Vector extension for embeddings.
- **session** – Express session store (connect-pg-simple).
- **users** – id, email, name, picture, google_id, welcome_email_sent.
- **documents** – id, user_id, filename, uploaded_at, risk_level, risk_category, risk_confidence, version_number, parent_document_id, metadata, file_data, file_type, folder_id, etc.
- **chunks** – document chunks with vector embeddings.
- **folders** – user folders and folder–document associations.
- **Rules, templates, tenants, audit logs** – as used by the above APIs.

---

## 6. Web App (React + Vite)

### 6.1 Routes (authenticated)
- **/** – Upload page (FileUploader, DocumentList, FinancialHealthDashboard). Post-upload CTA to Chat or “Analyze Bank & Credit Card Statements.”
- **/chat** – Chat over documents; optional `?documents=id1,id2` preselection.
- **/document/:documentId** – Shared document view (public link).
- **/pricing**, **/contact**, **/privacy**, **/terms** – Marketing/legal pages.
- **/m** (mobile shell) – **/m** (home), **/m/scan**, **/m/docs**, **/m/chat**, **/m/settings**.

### 6.2 Public / unauthenticated
- **/** – Landing page.
- **/login** – Google login.
- **/document/:documentId** – Shared document (no login required when shared).

### 6.3 Main UI Components
- **FileUploader** – Drag-and-drop and file picker; multi-file; PDF, DOC, DOCX, XLS, XLSX, images.
- **DocumentList** – List documents; actions: Explain, Share, What If, Voice, Trust Score, Agent Swarm, Finance Tools; folder management.
- **ChatUI** – RAG chat with document selector, citations, optional service-provider suggestions.
- **DocumentExplanationModal** – Explain document/section.
- **ShareDocumentModal** – Share document link.
- **WhatIfSimulator** – What-if scenarios.
- **VoiceMode** – Voice input for queries.
- **TrustScore** – Trust score display.
- **AgentSwarm** – Run and show agent-swarm results (extractor, risk, compliance, negotiation, action).
- **FinanceToolsModal** / **FinanceToolResultView** – Finance tools (e.g. bank/credit card statements).
- **FinancialHealthDashboard** – Dashboard for financial health.
- **DocumentCompleteness** – Completeness check UI.
- **DocumentVerification** – Document verification UI.
- **FolderManager** – Create/edit/delete folders; add/remove documents.
- **ServiceProviderModal** / **ServiceProviders** – Show suggested providers (e.g. from chat “next steps”).
- **ComplianceDashboard** – Compliance metrics/report/audit.
- **RiskTrendsDashboard** – Risk trends (Recharts).
- **LoginPage** – Google sign-in.
- **Mobile layout** – MobileLayout, MobileNav, MobileHome, MobileScan, MobileDocs, MobileChat, MobileSettings; offline queue support.

### 6.4 Contexts
- **AuthContext** – User, login, logout.
- **LocationContext** – User location for service-provider features.
- **ThemeContext** – Theme (e.g. light/dark).

### 6.5 Behavior
- Mobile detection: on small screens users are redirected to **/m** when logged in.
- API client (Axios) points to backend; credentials included for session auth.

---

## 7. Integration API (Python FastAPI)

- **Location**: `apps/api/`.
- **Purpose**: External integrations (email, Slack, Zapier, folder monitoring).
- **Auth**: API key (`X-API-Key`).
- **Endpoints**:
  - **GET** `/health` – Health check.
  - **POST** `/api/v1/analyze` – Analyze document (file upload; optional webhook_url). Async job (e.g. BullMQ).
  - **GET** `/api/v1/jobs/{job_id}` – Job status.
  - **POST/GET/DELETE** `/api/v1/webhooks` – Webhook management.
- **Stack**: FastAPI, async job queue, webhook delivery with retries, rate limiting per API key.

---

## 8. Scripts & Run

- **Backend**: `apps/backend` – `npm run dev`, `npm run migrate`, `npm run build` / `npm start`.
- **Web**: `apps/web` – `npm run dev`, `npm run build`, `npm run preview`.
- **Root**: `start-app.sh`, `start-everything.sh`, `start-web.sh`, `stop-app.sh`, `FIX_AND_RUN_NOW.sh`, `QUICK_FIX.sh`, `setup-web.sh`, `test-upload.sh`, `enable-pgvector.sh`.

---

## 9. Summary Table

| Area              | Implemented |
|-------------------|------------|
| Auth              | Google OAuth, session, /me, logout |
| Upload            | File + text + email; multi-type; chunking; embeddings; risk & type classification; rules |
| RAG/Chat          | Q&A, citations, confidence, quick questions, service-provider suggestions |
| Explain/Translate | Endpoints + UI modals |
| Compare           | Two-document compare |
| Rules             | CRUD + evaluate on upload |
| Templates         | Generate from template |
| Negotiation       | Prepare strategy |
| Analytics/Dashboard | Trends, exposure, health, benchmarking |
| Redaction         | Redact, sanitize |
| Compliance        | Metrics, report, audit, GDPR, retention |
| SSO               | SAML, OIDC |
| White-label       | Branding, tenants |
| Alerts/Reports    | Check, pending, mark sent, generate report |
| Service providers | By category + location, nearby |
| What-If / Voice / Trust Score | Endpoints + UI |
| Agent Swarm       | Multi-agent analysis + UI |
| Mobile            | Push, WebAuthn; mobile shell (home, scan, docs, chat, settings) |
| Folders           | CRUD, organize-by-year, add/remove documents |
| Verify/Completeness | Endpoints + UI |
| Finance tools     | List, run (e.g. statements analysis) + UI |
| Shared documents  | Public link view |
| DB                | PostgreSQL, pgvector, sessions, users, documents, chunks, folders, rules, etc. |
| Integration API   | Python FastAPI, API keys, analyze job, webhooks |

This document reflects the current implementation as of the codebase snapshot.
