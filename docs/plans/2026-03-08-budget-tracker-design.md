# PAI — Freelancer Budget Tracker: Design Document

**Date:** 2026-03-08
**Status:** Approved

---

## Overview

A web app for freelancers (e.g. costume and set designers) working for production companies to track project expenses, scan receipts, and generate expense reports. Freelancers receive a budget per project, make purchases throughout production, and must submit a detailed expense report with receipt documentation at the end.

**Core problems solved:**
- Eliminate manual spreadsheet tracking
- Enable on-the-go receipt capture (photo or forwarded email)
- Generate a combined PDF expense report (table + receipt scans) ready to submit

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14 (App Router, serverless API routes) |
| Auth, Database, Storage | Supabase |
| Receipt OCR | Claude Haiku API (multimodal) |
| Email inbound | Postmark Inbound (webhook) |
| PDF generation | pdf-lib |
| Deployment | Vercel |

Rationale: fully serverless, minimal operational overhead, user has prior Supabase/Vercel experience. Claude Haiku is cost-effective at ~$0.002–0.005 per receipt, making API costs negligible at this scale.

---

## Data Model

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| name | text | |
| email | text | |
| created_at | timestamptz | |

Kept separate from projects for reuse across multiple projects and future extensibility (address, phone, billing info, etc.).

### `projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| client_id | uuid | FK → clients |
| name | text | |
| total_budget | numeric | |
| created_at | timestamptz | |

### `expenses`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid | FK → projects, **nullable** (null = inbox) |
| user_id | uuid | FK → auth.users |
| vendor | text | |
| amount | numeric | Negative if is_return = true |
| date | date | |
| category | enum | `general` or `transport` |
| notes | text | Optional |
| receipt_path | text | Supabase Storage path |
| is_return | boolean | Default false |
| ocr_confidence | jsonb | Per-field confidence scores from Claude |
| created_at | timestamptz | |

Returns are expenses with `is_return = true` and a negative amount — they reduce the running total automatically without a separate table.

### `inbound_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| token | text | Unique slug, maps to `{token}@mail.yourapp.com` |
| created_at | timestamptz | |

---

## Key User Flows

### 1. Manual Expense Entry
1. User opens a project and taps "Add Expense"
2. Optionally uploads a receipt photo or PDF
3. Claude Haiku extracts: vendor, amount, date, category
4. Form pre-fills with OCR results; low-confidence fields are visually highlighted
5. User confirms or edits, then saves
6. Compressed receipt stored in Supabase Storage, linked to expense

### 2. Email Forwarding (Inbox Flow)
1. User finds their unique inbound address in Settings (e.g. `abc123@mail.yourapp.com`)
2. User forwards a digital receipt or sets up auto-forwarding rules in their email client
3. Postmark receives email, fires webhook to `/api/inbound-email`
4. API processes based on email content:
   - **Has image/PDF attachment** → compress, run OCR, create inbox entry with pre-filled fields
   - **No attachment, has body text** → pass body to Claude for extraction (handles HTML receipts from Amazon, Uber, etc.)
   - **Nothing useful found** → create inbox entry marked "No relevant information found" with sender and timestamp
5. Nothing is ever silently dropped
6. User opens Inbox, reviews pre-filled fields, selects a project, assigns expense

### 3. Running Budget View
Project dashboard shows at a glance:
- Total budget
- Spent (general)
- Spent (transport)
- Total returns
- **Remaining** (goes red if overspent)

Updated in real time as expenses are added or removed.

### 4. Export
1. User opens a project and clicks "Export"
2. Chooses PDF or CSV
3. **PDF:** Report table (one or more pages) followed by each receipt scan in date order as subsequent pages
4. **CSV:** Flat file, one row per expense
5. Budget overrun warning shown if total spend exceeds budget

---

## UI Structure

| Screen | Purpose |
|---|---|
| **Dashboard** | Project list with budget-remaining quick stats, "New Project" button |
| **Project Detail** | Running budget summary, expense list filterable by category, "Add Expense" + "Export" |
| **Add / Edit Expense** | Receipt upload, OCR pre-fill with confidence highlighting, editable form |
| **Inbox** | Unassigned receipts, assign-to-project action, "No relevant information found" callouts |
| **Settings** | Unique inbound email address, user profile |

Navigation: sidebar on desktop, bottom nav on mobile. The app must be fully usable on mobile for on-the-go receipt capture.

---

## Receipt Storage

- **Images (JPG, PNG):** Compressed client-side before upload — max 1500px wide, 80% JPEG quality, targeting ~200KB per receipt
- **PDFs:** Compressed server-side via pdf-lib
- Stored in Supabase Storage, path saved on the expense record
- Receipt always viewable from the expense detail screen (thumbnail + full view)
- PDF export stitches stored compressed scans directly, keeping export fast

Supabase free tier (1GB storage) supports ~5,000 receipts at 200KB average before upgrade is needed.

---

## Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| Blurry or ambiguous receipt | OCR still runs; low-confidence fields highlighted in yellow; user always confirms before saving |
| Email with no attachment | Extract body text, attempt OCR; if nothing found, create inbox entry as "No relevant information found" |
| Non-image/PDF email attachment | Ignored; other content still processed |
| Duplicate receipt submission | No auto-deduplication in v1; user responsibility |
| Budget overrun | No hard block; remaining budget turns red; warning on export |
| Storage limits approaching | Handled at infrastructure level (Supabase plan upgrade); no in-app warning in v1 |

**These edge cases are documented here for future reference and should be revisited as usage patterns emerge.**

---

## Out of Scope for v1

- Custom report templates (fixed template only)
- Automatic duplicate detection
- In-app storage usage warnings
- Multi-currency support
- Team/agency accounts (single user per account)
- Native mobile app

---

## Cost Estimate

| Service | Expected cost at early scale |
|---|---|
| Vercel | Free tier |
| Supabase | Free tier |
| Claude Haiku OCR | ~$0.002–0.005 per receipt; ~$1–5/month at moderate usage |
| Postmark Inbound | Free tier (100 emails/month); ~$1.25/1000 after |

Total expected cost near zero until meaningful user scale.
