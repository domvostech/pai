# PAI — Personal Accounts & Invoicing

A web app for freelancers (costume designers, set designers, etc.) working on production projects. Track budgets per project, scan receipts on the go, and generate combined PDF expense reports for clients.

## Features

- **Project & client management** — multiple clients, multiple projects per client, per-project budgets
- **Expense tracking** — two categories: General and Transport; supports return/refund entries
- **Receipt scanning** — upload photo or PDF; AI extracts vendor, amount, date, and category automatically
- **Email inbox** — forward digital receipts to your personal inbound address; they land in your Inbox ready to assign to a project
- **Export** — combined PDF report (expense table + all receipt scans appended) or CSV
- **Multi-user** — each user gets their own inbound email address and sees only their own data

---

## Tech Stack

### Frontend & Framework
| Technology | Purpose |
|---|---|
| [Next.js 15](https://nextjs.org) (App Router) | Full-stack React framework, server components, API routes |
| [TypeScript](https://www.typescriptlang.org) | Type safety throughout |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) + [@base-ui/react](https://base-ui.com) | Accessible UI primitives (dialogs, tabs, selects, etc.) |
| [Lucide React](https://lucide.dev) | Icons |
| [Sonner](https://sonner.emilkowal.ski) | Toast notifications |

### Backend & Database
| Technology | Purpose |
|---|---|
| [Supabase](https://supabase.com) | Postgres database, Auth, and file Storage |
| [@supabase/ssr](https://supabase.com/docs/guides/auth/server-side/nextjs) | Server-side Supabase client for Next.js (cookies-based sessions) |
| Row Level Security (RLS) | All database tables scoped to `auth.uid()` — users can only access their own data |
| Supabase Storage | Private `receipts` bucket; files stored at `{userId}/{expenseId}.{ext}` |

### AI / OCR
| Technology | Purpose |
|---|---|
| [OpenRouter](https://openrouter.ai) | Unified AI API gateway |
| `google/gemini-2.5-flash-lite` | Multimodal model used for receipt OCR — extracts vendor, amount, date, category, and confidence scores from images or text |

### Email
| Technology | Purpose |
|---|---|
| [Postmark Inbound](https://postmarkapp.com/inbound-email-processing) | Receives forwarded receipts and sends them to the inbound webhook |
| Custom MX domain (`inbound.vosventures.tech`) | All emails to `token@inbound.vosventures.tech` are routed to Postmark |
| `/api/inbound-email` webhook | Receives Postmark payloads, identifies user by token, runs OCR, saves to Inbox |

### PDF & File Handling
| Technology | Purpose |
|---|---|
| [pdf-lib](https://pdf-lib.js.org) | Generates expense report PDFs; stitches receipt scans as appended pages |
| [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) | Client-side image compression before upload (max 0.3 MB, 1500px) |

### Deployment & Infrastructure
| Technology | Purpose |
|---|---|
| [Vercel](https://vercel.com) | Hosting and serverless function deployment; auto-deploys from `main` branch |
| [GitHub](https://github.com) | Source control (`domvostech/pai`) |

### Testing
| Technology | Purpose |
|---|---|
| [Vitest](https://vitest.dev) | Unit test runner |
| 38 tests across 5 modules | `budget`, `ocr`, `email-parser`, `receipt-compression`, `pdf-export` |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login and signup pages
│   ├── (app)/            # Authenticated app pages
│   │   ├── page.tsx      # Dashboard (project cards with budget summaries)
│   │   ├── projects/[id] # Project detail + expense list
│   │   ├── inbox/        # Unassigned emailed receipts
│   │   └── settings/     # Inbound email address
│   ├── api/
│   │   ├── expenses/     # CRUD for expenses
│   │   ├── projects/     # CRUD for projects + PDF/CSV export
│   │   ├── ocr/          # Receipt OCR endpoint
│   │   ├── inbound-email/# Postmark webhook
│   │   └── inbound-token/# Generate/fetch user inbound token
│   └── auth/callback/    # Supabase email confirmation handler
├── components/
│   ├── expenses/         # ExpenseList, ExpenseForm, ReceiptUpload, ReceiptViewer
│   ├── inbox/            # InboxClient (assign/discard)
│   ├── nav/              # Sidebar (desktop) + MobileNav (bottom tab bar)
│   ├── settings/         # SettingsClient (inbound address + copy button)
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── supabase/         # client.ts, server.ts, service.ts, types.ts
│   ├── budget.ts         # Budget summary calculations
│   ├── ocr.ts            # OpenRouter OCR integration
│   ├── email-parser.ts   # Inbound token extraction + content detection
│   ├── receipt-compression.ts # Client-side compression config + storage paths
│   └── pdf-export.ts     # PDF generation (report + receipt stitching)
supabase/
└── migrations/
    ├── 20260308000001_initial_schema.sql   # Tables: clients, projects, expenses, inbound_tokens
    ├── 20260308000002_rls_policies.sql     # Row Level Security policies
    └── 20260308000003_storage.sql          # Receipts storage bucket + policies
```

---

## Database Schema

```
clients         — id, user_id, name, email
projects        — id, user_id, client_id, name, total_budget
expenses        — id, user_id, project_id*, vendor, amount, date, category, notes,
                  receipt_path, is_return, ocr_confidence
inbound_tokens  — id, user_id, token (unique hex string)
```

`project_id` is nullable on expenses — null means the expense is in the Inbox (unassigned).

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Used only by the inbound-email webhook (bypasses RLS)

# AI / OCR
OPENROUTER_API_KEY=              # Get free key at https://openrouter.ai

# Email (Postmark)
POSTMARK_WEBHOOK_SECRET=         # Query param secret for webhook auth
INBOUND_EMAIL_DOMAIN=            # e.g. inbound.vosventures.tech
```

---

## Local Development

```bash
npm install
npm run dev       # Start dev server at http://localhost:3000
npm test          # Run unit tests (Vitest)
npm run build     # Production build
```

To run against a local Supabase instance:
```bash
npx supabase start
npx supabase db push
```

---

## Inbound Email Setup

1. Add an MX record on your domain: `<subdomain> MX 10 inbound.postmarkapp.com`
2. In Postmark → Inbound stream → set the inbound domain to your subdomain
3. Set the webhook URL to: `https://your-app.vercel.app/api/inbound-email?secret=YOUR_SECRET`
4. Set `INBOUND_EMAIL_DOMAIN` in Vercel to your subdomain
5. Each user's inbound address (`token@yourdomain.com`) is shown in Settings
