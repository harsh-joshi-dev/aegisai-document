# Aegis AI – Product Workflow & Documentation

This document describes the product workflow, features, and how the system operates end-to-end.

---

## What Is This Product?

**Aegis AI** is a document risk review and approval system. It helps finance teams:

- Upload financial documents (invoices, bank statements, GST, etc.)
- Automatically assess risk level and surface issues
- Route documents to reviewers for approval
- Track decisions with an audit trail

---

## User Roles & Permissions

| Role     | Permissions |
|----------|-------------|
| **Owner**  | Full access: invite users, manage settings, bulk approve/reject, view audit logs |
| **Admin**  | Same as Owner |
| **Reviewer** | Receives document assignments; can approve, reject, request info, or flag documents |
| **Viewer**  | Read-only: view documents and activity; cannot approve or change anything |

---

## End-to-End Workflow

### 1. Sign Up & Onboarding

```
Landing Page → Sign Up → Create Workspace → (Optional) Invite Team → Dashboard
```

- User signs up with any email (mock auth: no password validation)
- **Onboarding** creates a workspace name and optionally invites team members with roles
- The signed-in user is added as **Owner** in the workspace

### 2. Upload Document

```
Documents → Upload Document → Fill form (file, type, vendor, date) → Processing → Document Detail
```

- Click **Upload Document** on the Documents page
- Select a PDF or image file
- Choose document type: Invoice, Bank, GST, or Other
- Optional: vendor name, date
- Document is “processed” (mock: no real AI backend)
- **Risk Level** and **Risk Score** are calculated from document type and amount
- **AI Summary**, **Issues**, **Mismatches**, and **Recommendations** are generated
- Document is assigned to a Reviewer (based on Settings) or stays unassigned if no reviewers exist

### 3. Document States (Status)

| Status          | Meaning |
|-----------------|---------|
| `pending`       | Newly uploaded, awaiting review |
| `review_required` | Assigned to a reviewer |
| `under_review`  | Being reviewed |
| `pending_info`  | Reviewer requested more info from submitter |
| `approved`      | Approved (requirements met) |
| `rejected`      | Rejected with a note |
| `archived`      | Archived after approval/rejection |

### 4. Review Flow

```
Document Detail → Approve / Reject / Request Info / Flag
```

- **Approve** – Records approval. For High-risk: 2 approvals required. For Critical: Admin/Owner must approve.
- **Reject** – Reject with required note (audit trail)
- **Request Info** – Set status to Pending Info; assigned reviewer gets notification; submitter can respond
- **Flag** – Mark for re-review

### 5. Assignment & SLA

- **Settings** (Admin/Owner only) configure:
  - Assignment strategy: First Available, Round Robin, Least Loaded, or Default Reviewer
  - SLA hours (e.g., 24 hours)
  - Escalation hours (e.g., 48 hours)
- Documents not reviewed within SLA → marked **Overdue**
- Documents past escalation window → **Escalated**; admins notified

### 6. Workspaces

- Multiple workspaces: Primary (from onboarding), Finance, Audit, plus custom ones
- Switch workspace → dashboard, documents, and users refresh for that workspace
- Switching shows a confirmation: “Dashboard, documents, and users will refresh.”

---

## Key Features & How They Work

### Notifications

- Bell icon in the header opens a dropdown
- Shows assign, request_info, escalation, and info notifications
- Each notification can link to the related document
- “Mark all read” clears unread state

### PDF View

- Uploaded PDFs/images are stored as base64 data URLs
- Document Detail page renders PDFs in an iframe
- Toolbar and thumbnail sidebar are hidden for a clean view
- If no file is stored, a placeholder with metadata is shown

### Share & Export (Document Detail)

- **Share** – Copies document URL to clipboard; uses Web Share API when available
- **Export** – Downloads document summary as CSV

### Reports

- **Generate PDF** – Builds a report for the selected date range and workspace, opens print dialog (use “Save as PDF”)
- **Export CSV** – Downloads documents in the date range as CSV

### Risk Level Logic

Risk is driven mainly by **amount** (with some randomness):

| Amount Range     | Typical Risk Level  |
|------------------|----------------------|
| Under ₹20,000    | Safe                 |
| ₹20,000–₹50,000  | Safe / Review Required |
| ₹50,000–₹1,00,000| Review Required / High |
| Above ₹1,00,000  | High / Critical      |

### Approval Requirements

| Risk Level      | Approvals Needed     |
|-----------------|----------------------|
| Safe            | 1 (any reviewer)     |
| Review Required | 1 (any reviewer)     |
| High            | 2 (any reviewers)    |
| Critical        | 1 (Admin or Owner)   |

---

## Data Model (Mock Store)

The app uses a **mock store** backed by `localStorage` (no backend API):

- **Documents** – Uploaded docs with metadata, risk, status, assignments
- **Users** – Workspace members with roles
- **Rules** – Business rules (for display; not enforced in mock)
- **Activity** – Events (uploaded, assigned, status changes)
- **Notifications** – In-app notifications
- **Audit Log** – Actions for compliance

**Reset Data** – In Settings, “Reset & Start Fresh” clears all stored data and returns to the landing page.

---

## File Structure (Relevant Paths)

```
apps/web/
├── src/
│   ├── App.tsx                 # Routes, providers
│   ├── layout/AppLayout.tsx    # Sidebar, header, workspace selector, notifications
│   ├── pages/
│   │   ├── AuthPage.tsx        # Login / Sign up
│   │   ├── OnboardingPage.tsx  # Workspace + invite
│   │   ├── DecisionDashboardPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   ├── DocumentDetailPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── RulesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── state/
│   │   ├── mockAuth.tsx        # Mock auth (email-based)
│   │   ├── mockStore.tsx       # Documents, users, rules, activity, notifications
│   │   └── workspace.tsx       # Workspaces, active workspace
│   ├── services/
│   │   ├── documentAnalysis.ts # AI summary, issues, mismatches
│   │   ├── approvalRequirements.ts
│   │   ├── assignment.ts       # Reviewer assignment
│   │   └── sla.ts              # SLA / escalation
│   └── ui/                     # Modals, badges, tables
```

---

## How to Test the Flow

1. **Reset** – Settings → Reset & Start Fresh
2. **Sign Up** – Use any email (e.g. `owner@test.com`)
3. **Onboarding** – Enter workspace name; optionally invite a Reviewer
4. **Upload** – Documents → Upload Document; pick a PDF, fill form, submit
5. **Review** – Open document; Approve, Reject, or Request Info
6. **Switch Workspace** – Sidebar dropdown; confirm switch
7. **Reports** – Reports page; pick dates; Generate PDF or Export CSV

---

## Current Limitations (Mock Mode)

- No real backend: all data in `localStorage`
- No real AI: risk, summary, issues are derived from simple rules
- Mock auth: any email/password logs in; no real authentication
- PDF/file storage is in browser; no cloud storage
