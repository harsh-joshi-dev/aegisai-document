# Aegis AI – Complete UX & Product Guide

**Last major update.** Covers flow suggestions, feature ideas, enhancements, and **pain points by business category** so the product is ready for long-term use without further feature churn.

---

## Part A – Pain points by business category

### Legal
| Pain point | What users need | Current / suggested |
|------------|-----------------|---------------------|
| "I got a notice and don't know what to do" | One clear action, deadline, and who can help | What Should I Do Next ✅ |
| "I don't understand the jargon" | Simple explanation (like 10 / 20 / professional) | Explain with level ✅ |
| "I need to reply but don't know how to draft" | Ready reply, email, or appeal draft | Drafts (legal reply, email, appeal) ✅ |
| "I want to negotiate terms" | Talking points, red lines, suggested changes | Negotiation Simulator ✅ |
| "Which parts are risky?" | Exact clauses with red/amber/green | Why Is This Risky? ✅ |
| "Does this match our policy?" | Policy vs contract: violations + missing clauses | Policy Matcher ✅ |
| "Is this document trustworthy?" | Score + factors (risk, missing clauses, ambiguity) | Trust Score ✅ |
| "I need a lawyer" | Nearby lawyers by location | Solution Providers (Legal) ✅ |
| "Can I share without leaking details?" | Redacted, shareable summary | Share Safe Summary ✅ |

### Financial / Tax
| Pain point | What users need | Current / suggested |
|------------|-----------------|---------------------|
| "What will this cost me (tax, late fees, worst case)?" | Numbers in one place | Financial Impact Estimator ✅ |
| "I have bank/credit statements – what do they show?" | Analysis and trends | Finance tools (statements) ✅ |
| "When do I need to pay / file?" | Deadlines and reminders | Deadlines & Obligation Tracker ✅ |
| "I need a CA or tax expert" | Nearby CAs by location | Solution Providers (Financial) ✅ |
| "Overall picture of my doc risk" | One health badge and counts | Financial Health Dashboard ✅ |
| "Trends over time" | Charts and risk over time | Risk Trends Dashboard ✅ |

### Compliance
| Pain point | What users need | Current / suggested |
|------------|-----------------|---------------------|
| "Does this contract comply with our policy?" | Policy vs contract comparison | Policy Matcher ✅ |
| "What are the compliance risks?" | Risk breakdown and clauses | Why Is This Risky? + Risk level ✅ |
| "Audit trail and reports" | Metrics, report, audit logs | Compliance APIs + Compliance Dashboard ✅ |
| "Data and retention" | Export, delete, retention | GDPR export/delete, retention ✅ |

### Documents & workflow
| Pain point | What users need | Current / suggested |
|------------|-----------------|---------------------|
| "I have many docs – where to start?" | By category, risk, or folder | Folders, filters, Dashboard ✅ |
| "Ask questions across docs" | Chat with selected docs | Chat ✅ |
| "Compare two versions" | Diff and risk change | Compare ✅ |
| "Is this doc complete / valid?" | Completeness + verification | Completeness check, Verify ✅ |
| "Team notes on a doc" | Comments and mentions | Comments ✅ |
| "Organise by year/type" | Auto or manual folders | Folders, organise-by-year ✅ |

### Trust & safety
| Pain point | What users need | Current / suggested |
|------------|-----------------|---------------------|
| "Can I trust this analysis?" | Confidence + sources + missing-data hint | Confidence meter + citations ✅ |
| "Is this a scam?" | Probability + signals | Scam / Fraud Score ✅ |
| "Which bits are risky?" | Clause-level red/amber/green | Why Is This Risky? ✅ |
| "Share without PII" | Redacted summary | Share Safe Summary ✅ |
| "Overall doc trust" | Single score + factors | Trust Score ✅ |

### Enterprise / team
| Pain point | What users need | Current / suggested |
|------------|-----------------|---------------------|
| "Different views for different roles" | User / Manager / Auditor views | Role-based views in Chat ✅ |
| "Internal discussion on a doc" | Comments and collaboration | Comments ✅ |
| "Policy vs contract" | Violations and missing clauses | Policy Matcher ✅ |
| "Compliance overview" | Metrics, reports, audit | Compliance Dashboard ✅ |

---

## Part B – Flow suggestions (user journey)

### B.1 First-time / onboarding
- **Guided first upload:** Short 2–3 step “Get started” (Upload → See risk & summary → Ask what to do next) with one CTA that scrolls to upload.
- **Empty state:** When zero documents, show “Upload your first document” with a clear drop zone and examples (notice, contract, bank statement).
- **Progressive disclosure:** “Recommended” actions first (e.g. What Should I Do Next + Explain); “See all actions” or “More” for the rest.

### B.2 Post-upload flow
- **One primary CTA** after upload (e.g. What Should I Do Next or Chat); secondaries in “More” or a second row.
- **Risk-first line** under the filename on the card (e.g. “Reply in 15 days • Consult a lawyer”) so urgency is visible without opening a modal.
- **Batch:** For multiple uploads, default to highest-risk doc for “What Next?” or show “1 Critical, 2 Normal” with “Focus on Critical”.

### B.3 Document → action (fewer steps)
- **Add to calendar:** One-click .ics or calendar link from Deadlines / What Next.
- **Copy draft:** In Drafts, “Copy” + toast “Copied. Paste into your email.”
- **Chat from card:** Open Chat with that doc pre-selected and a suggested first question so one tap sends.

### B.4 Errors and edge cases
- **Upload errors:** Clear messages (supported types, “Try PDF or re-scan”, size limit + “Split if needed”).
- **Partial batch:** “2 uploaded; 1 failed: [filename] – [reason]” with Retry failed / Dismiss.
- **No location:** When “Find CA/Lawyer” needs location: one prompt “Share location for nearby experts” with Enable / Skip.

### B.5 Mobile
- **Upload:** Camera / gallery first, then Files.
- **List:** One primary action per row + “More” to avoid tiny buttons.
- **Chat:** Sticky send + suggestion chips.

---

## Part C – Feature suggestions (already built vs future)

### Built and available
- What Should I Do Next, Explain (3 levels), Drafts, Negotiation, Why Risky?, Policy Matcher, Trust Score, Scam Score, Share Safe Summary.
- Financial Impact, Finance tools, Deadlines, Dashboard, Risk Trends.
- Role-based views, Comments, Folders, Compare, Verify, Completeness.
- Service providers (Legal, Financial, etc.), Confidence meter, Charts (risk trends, financial health, etc.).

### Future (when you add again)
- **Reminders:** Email/push for deadlines (7/3/1 days) and risk-change alerts.
- **Search:** Full-text search across documents + Recent / Pinned.
- **Export:** PDF report (summary, risk, deadlines, disclaimer); share link with expiry.
- **Integrations:** Calendar (Google/Outlook), Slack/Teams, “Forward to Aegis” email.
- **Bulk:** Folder summary, bulk “What Next?”, export folder report.
- **Trust:** “Last analyzed” on card, model/version in footer.

---

## Part D – Enhancement suggestions (polish)

### Loading and progress
- Skeleton loaders for list and dashboard; upload % and “Analyzing…”; step progress for Agent Swarm with cancel where safe.

### Empty states
- No results / no deadlines / no comments: specific copy + one clear next action (e.g. Add deadline, Add note, Clear filters).

### Accessibility
- Keyboard (Tab, Escape, Enter); focus trap in modals; return focus on close; aria-labels on icon buttons; progress bar and risk announced for screen readers.

### Consistency
- Same primary/secondary button style; same Critical/Warning/Normal colours; confirm before delete (document, deadline, etc.).

### Copy
- User-friendly errors; “Based on N sections” or “Answer may be incomplete” when confidence is low; “Add to calendar” primary, “Export iCal” secondary.

### Mobile
- 44px+ touch targets; bottom nav (Upload / Docs / Chat / Settings); pull-to-refresh on list/dashboard.

---

## Part E – How to use “Features by category” in the product

- **Header:** Top nav includes **“Features”** (or “By category”). Hover opens a **mega-menu**.
- **Categories:** Legal, Financial, Compliance, Documents & workflow, Trust & safety, Enterprise. Each category has a list of features.
- **Clicking a feature:**  
  - **Page features** (e.g. Chat, Dashboard, Upload): go to that page.  
  - **Document-scoped features** (e.g. What Next, Explain, Drafts, Financial impact): go to Home (Upload) with a **feature runner** – user selects a document and clicks “Run” to open the right modal or flow.
- This gives one clear entry point by business need and keeps the flow understandable.

---

## Summary

- **Part A** maps pain points by category (Legal, Financial, Compliance, Documents, Trust, Enterprise) to existing features so nothing is missed.
- **Part B–D** summarise flows, features, and enhancements; **Part E** describes the category-based Features menu and feature-runner behaviour for a professional, easy-to-understand flow.
