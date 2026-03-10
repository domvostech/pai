# Expense Fields Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add VAT breakdown fields (`amount_gross`, `amount_19`, `amount_7`, `amount_0`) and rename `amount` → `amount_net` on expenses; add `cost_center` to projects.

**Architecture:** Six independent layers updated in dependency order: (1) SQL migration, (2) TypeScript types, (3) pure logic libs (budget, OCR), (4) API routes, (5) form/display components, (6) PDF export. Each layer has tests where applicable.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres, Vitest, pdf-lib, Tailwind CSS.

---

### Task 1: SQL migration

**Files:**
- Create: `supabase/migrations/20260310_expense_fields.sql`

**Context:** This file documents the schema change. Apply it in the Supabase dashboard SQL editor (or via `supabase db push` if CLI is configured). Since the project is not in production, there is no existing data to worry about.

**Step 1: Create migration file**

```sql
-- Rename amount to amount_net on expenses
ALTER TABLE expenses RENAME COLUMN amount TO amount_net;

-- Add VAT breakdown columns (all nullable)
ALTER TABLE expenses ADD COLUMN amount_gross numeric;
ALTER TABLE expenses ADD COLUMN amount_19 numeric;
ALTER TABLE expenses ADD COLUMN amount_7 numeric;
ALTER TABLE expenses ADD COLUMN amount_0 numeric;

-- Add cost_center to projects
ALTER TABLE projects ADD COLUMN cost_center text;
```

**Step 2: Apply migration**

Run the SQL in the Supabase dashboard SQL editor (Database → SQL Editor → New query → paste → Run).

**Step 3: Commit**

```bash
git add supabase/migrations/20260310_expense_fields.sql
git commit -m "feat: add expense VAT fields migration"
```

---

### Task 2: TypeScript types

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Context:** The types file is hand-maintained (not auto-generated in this project). Update expenses and projects types to reflect the new schema. All new expense columns are nullable (`number | null`). `cost_center` on projects is also nullable.

**Step 1: Update `src/lib/supabase/types.ts`**

Replace the `expenses` table type block (lines 74–126) with:

```typescript
      expenses: {
        Row: {
          id: string
          project_id: string | null
          user_id: string
          vendor: string | null
          amount_net: number
          amount_gross: number | null
          amount_19: number | null
          amount_7: number | null
          amount_0: number | null
          date: string
          category: 'general' | 'transport'
          notes: string | null
          receipt_path: string | null
          is_return: boolean
          ocr_confidence: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          user_id: string
          vendor?: string | null
          amount_net: number
          amount_gross?: number | null
          amount_19?: number | null
          amount_7?: number | null
          amount_0?: number | null
          date: string
          category: 'general' | 'transport'
          notes?: string | null
          receipt_path?: string | null
          is_return?: boolean
          ocr_confidence?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          user_id?: string
          vendor?: string | null
          amount_net?: number
          amount_gross?: number | null
          amount_19?: number | null
          amount_7?: number | null
          amount_0?: number | null
          date?: string
          category?: 'general' | 'transport'
          notes?: string | null
          receipt_path?: string | null
          is_return?: boolean
          ocr_confidence?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
```

Replace the `projects` table type block (lines 39–73) with:

```typescript
      projects: {
        Row: {
          id: string
          user_id: string
          client_id: string | null
          name: string
          total_budget: number
          cost_center: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id?: string | null
          name: string
          total_budget?: number
          cost_center?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string | null
          name?: string
          total_budget?: number
          cost_center?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
      }
```

**Step 2: Run tests to confirm no type errors surface in tests**

```bash
cd /srv/projects/work/pai && npm test -- --run
```

Expected: tests will fail on `amount` references in other files — that is correct and expected. These will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: update TypeScript types for new expense and project fields"
```

---

### Task 3: Update budget.ts (rename amount → amount_net)

**Files:**
- Modify: `src/lib/budget.ts`
- Modify: `src/lib/budget.test.ts`

**Context:** `budget.ts` exports `calculateBudgetSummary`, which reads `expense.amount`. The `Pick` type on line 3 and the field access on line 19 both need updating. Update tests first.

**Step 1: Update failing tests in `src/lib/budget.test.ts`**

In every test expense fixture, rename `amount` → `amount_net`. The file currently has:

```typescript
{ amount: 100, category: 'general', is_return: false },
```

Replace all such occurrences with `amount_net`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateBudgetSummary } from './budget'

describe('calculateBudgetSummary', () => {
  it('calculates spent by category', () => {
    const expenses = [
      { amount_net: 100, category: 'general', is_return: false },
      { amount_net: 50, category: 'transport', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.spentGeneral).toBe(100)
    expect(result.spentTransport).toBe(50)
  })

  it('subtracts returns from totals', () => {
    const expenses = [
      { amount_net: 100, category: 'general', is_return: false },
      { amount_net: 30, category: 'general', is_return: true },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.spentGeneral).toBe(70)
    expect(result.totalSpent).toBe(70)
  })

  it('calculates remaining budget', () => {
    const expenses = [
      { amount_net: 200, category: 'general', is_return: false },
      { amount_net: 100, category: 'transport', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.remaining).toBe(700)
    expect(result.isOverBudget).toBe(false)
  })

  it('flags overbudget correctly', () => {
    const expenses = [
      { amount_net: 1200, category: 'general', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.isOverBudget).toBe(true)
    expect(result.remaining).toBe(-200)
  })

  it('handles empty expenses', () => {
    const result = calculateBudgetSummary(500, [])
    expect(result.totalSpent).toBe(0)
    expect(result.remaining).toBe(500)
  })
})
```

**Step 2: Run tests — confirm budget tests now fail**

```bash
npm test -- --run src/lib/budget.test.ts
```

Expected: FAIL — `expense.amount` is undefined.

**Step 3: Update `src/lib/budget.ts`**

Replace the full file:

```typescript
import type { Database } from './supabase/types'

type Expense = Pick<Database['public']['Tables']['expenses']['Row'], 'amount_net' | 'category' | 'is_return'>

export interface BudgetSummary {
  totalBudget: number
  spentGeneral: number
  spentTransport: number
  totalSpent: number
  remaining: number
  isOverBudget: boolean
}

export function calculateBudgetSummary(totalBudget: number, expenses: Expense[]): BudgetSummary {
  let spentGeneral = 0
  let spentTransport = 0

  for (const expense of expenses) {
    const amount = expense.is_return ? -Math.abs(expense.amount_net) : Math.abs(expense.amount_net)
    if (expense.category === 'general') spentGeneral += amount
    else if (expense.category === 'transport') spentTransport += amount
  }

  const totalSpent = spentGeneral + spentTransport
  const remaining = totalBudget - totalSpent

  return {
    totalBudget,
    spentGeneral,
    spentTransport,
    totalSpent,
    remaining,
    isOverBudget: remaining < 0,
  }
}
```

**Step 4: Run budget tests — confirm they pass**

```bash
npm test -- --run src/lib/budget.test.ts
```

Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add src/lib/budget.ts src/lib/budget.test.ts
git commit -m "feat: rename amount to amount_net in budget calculations"
```

---

### Task 4: Update OCR (ocr.ts + ocr.test.ts)

**Files:**
- Modify: `src/lib/ocr.ts`
- Modify: `src/lib/ocr.test.ts`

**Context:** `OcrResult` has a single `amount` field. Replace it with `amount_net`, `amount_gross`, `amount_19`, `amount_7`, `amount_0`. Update the system prompt to instruct the model to extract net and gross amounts. The expense form reads `ocrResult.amount` — this will be fixed when updating the form in Task 7. Update tests first.

**Step 1: Update `src/lib/ocr.test.ts`**

Replace the full file:

```typescript
import { describe, it, expect } from 'vitest'
import { parseOcrResponse } from './ocr'

describe('parseOcrResponse', () => {
  it('parses a valid OCR response with net amount only', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA',
      amount_net: 42.50,
      amount_gross: null,
      amount_19: null,
      amount_7: null,
      amount_0: null,
      date: '2026-03-08',
      category: 'general',
      notes: null,
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.90, category: 0.80 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount_net).toBe(42.50)
    expect(result.amount_gross).toBeNull()
    expect(result.date).toBe('2026-03-08')
    expect(result.confidence.vendor).toBe(0.95)
  })

  it('parses a receipt with full VAT breakdown', () => {
    const raw = JSON.stringify({
      vendor: 'Kaufland',
      amount_net: 9.02,
      amount_gross: 9.42,
      amount_19: 6.06,
      amount_7: 3.36,
      amount_0: null,
      date: '2026-01-15',
      category: 'general',
      notes: 'Groceries',
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.amount_net).toBe(9.02)
    expect(result.amount_gross).toBe(9.42)
    expect(result.amount_19).toBe(6.06)
    expect(result.amount_7).toBe(3.36)
    expect(result.amount_0).toBeNull()
  })

  it('returns null fields for invalid JSON', () => {
    const result = parseOcrResponse('not json')
    expect(result.vendor).toBeNull()
    expect(result.amount_net).toBeNull()
    expect(result.amount_gross).toBeNull()
  })

  it('identifies low confidence fields (threshold 0.7)', () => {
    const raw = JSON.stringify({
      vendor: 'Shop',
      amount_net: 10,
      amount_gross: null,
      amount_19: null,
      amount_7: null,
      amount_0: null,
      date: '2026-01-01',
      category: 'general',
      notes: null,
      confidence: { vendor: 0.4, amount_net: 0.95, date: 0.9, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.lowConfidenceFields).toContain('vendor')
    expect(result.lowConfidenceFields).not.toContain('amount_net')
  })

  it('returns null category for unknown values', () => {
    const raw = JSON.stringify({
      vendor: 'Shop', amount_net: 10, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2026-01-01', category: 'food', notes: null, confidence: {}
    })
    const result = parseOcrResponse(raw)
    expect(result.category).toBeNull()
  })

  it('returns empty arrays/objects when confidence is missing', () => {
    const raw = JSON.stringify({
      vendor: 'Shop', amount_net: 10, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2026-01-01', category: 'general', notes: null
    })
    const result = parseOcrResponse(raw)
    expect(result.confidence).toEqual({})
    expect(result.lowConfidenceFields).toEqual([])
  })

  it('strips ```json code fences from model response', () => {
    const raw = '```json\n{"vendor":"Rossmann","amount_net":13.00,"amount_gross":null,"amount_19":null,"amount_7":null,"amount_0":null,"date":"2025-06-27","category":"general","notes":null,"confidence":{"vendor":0.95,"amount_net":0.99,"date":0.95,"category":0.85}}\n```'
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Rossmann')
    expect(result.amount_net).toBe(13.00)
    expect(result.date).toBe('2025-06-27')
  })

  it('strips plain ``` code fences from model response', () => {
    const raw = '```\n{"vendor":"Kopiefrosch","amount_net":45.00,"amount_gross":null,"amount_19":null,"amount_7":null,"amount_0":null,"date":"2025-06-30","category":"general","notes":"Printing copies","confidence":{"vendor":0.95,"amount_net":0.99,"date":0.95,"category":0.85}}\n```'
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Kopiefrosch')
    expect(result.amount_net).toBe(45.00)
    expect(result.date).toBe('2025-06-30')
  })

  it('parses Rossmann Fotowelt receipt (photo printing, €13.00, 27 Jun 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'Rossmann Fotowelt', amount_net: 13.00, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-06-27', category: 'general', notes: 'Photo printing',
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Rossmann Fotowelt')
    expect(result.amount_net).toBe(13.00)
    expect(result.date).toBe('2025-06-27')
    expect(result.category).toBe('general')
  })

  it('parses IKEA receipt (lighting props, €562.88, 1 Jul 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA', amount_net: 562.88, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-07-01', category: 'general', notes: 'Lighting fixtures and props',
      confidence: { vendor: 0.99, amount_net: 0.99, date: 0.99, category: 0.90 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount_net).toBe(562.88)
    expect(result.date).toBe('2025-07-01')
    expect(result.category).toBe('general')
  })

  it('parses Shell fuel receipt as transport category', () => {
    const raw = JSON.stringify({
      vendor: 'Shell', amount_net: 225.00, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-07-15', category: 'transport', notes: 'Fuel',
      confidence: { vendor: 0.99, amount_net: 0.95, date: 0.90, category: 0.99 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Shell')
    expect(result.amount_net).toBe(225.00)
    expect(result.category).toBe('transport')
  })

  it('parses Kopiefrosch copy shop receipt (€45.00, 30 Jun 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'Kopiefrosch', amount_net: 45.00, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-06-30', category: 'general', notes: 'Printing/copies',
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Kopiefrosch')
    expect(result.amount_net).toBe(45.00)
    expect(result.date).toBe('2025-06-30')
    expect(result.category).toBe('general')
  })
})
```

**Step 2: Run OCR tests — confirm they fail**

```bash
npm test -- --run src/lib/ocr.test.ts
```

Expected: FAIL — `result.amount_net` is undefined.

**Step 3: Update `src/lib/ocr.ts`**

Replace the full file:

```typescript
import OpenAI from 'openai'

const CONFIDENCE_THRESHOLD = 0.7

export interface OcrResult {
  vendor: string | null
  amount_net: number | null
  amount_gross: number | null
  amount_19: number | null
  amount_7: number | null
  amount_0: number | null
  date: string | null
  category: 'general' | 'transport' | null
  notes: string | null
  confidence: Record<string, number>
  lowConfidenceFields: string[]
}

export function parseOcrResponse(raw: string): OcrResult {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned)
    const confidence: Record<string, number> = parsed.confidence ?? {}
    const lowConfidenceFields = Object.entries(confidence)
      .filter(([, score]) => score < CONFIDENCE_THRESHOLD)
      .map(([field]) => field)

    return {
      vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
      amount_net: typeof parsed.amount_net === 'number' ? parsed.amount_net : null,
      amount_gross: typeof parsed.amount_gross === 'number' ? parsed.amount_gross : null,
      amount_19: typeof parsed.amount_19 === 'number' ? parsed.amount_19 : null,
      amount_7: typeof parsed.amount_7 === 'number' ? parsed.amount_7 : null,
      amount_0: typeof parsed.amount_0 === 'number' ? parsed.amount_0 : null,
      date: typeof parsed.date === 'string' ? parsed.date : null,
      category: ['general', 'transport'].includes(parsed.category) ? parsed.category : null,
      notes: typeof parsed.notes === 'string' ? parsed.notes : null,
      confidence,
      lowConfidenceFields,
    }
  } catch {
    return {
      vendor: null,
      amount_net: null,
      amount_gross: null,
      amount_19: null,
      amount_7: null,
      amount_0: null,
      date: null,
      category: null,
      notes: null,
      confidence: {},
      lowConfidenceFields: [],
    }
  }
}

const OCR_SYSTEM_PROMPT = `You are a receipt parser. Receipts may be in any language, including German.
Extract the following fields and return ONLY a valid JSON object — no markdown, no code fences, no explanation, just the raw JSON.

Required JSON structure:
{
  "vendor": "store or vendor name",
  "amount_net": 0.00,
  "amount_gross": null,
  "amount_19": null,
  "amount_7": null,
  "amount_0": null,
  "date": "YYYY-MM-DD",
  "category": "general",
  "notes": null,
  "confidence": {
    "vendor": 0.0,
    "amount_net": 0.0,
    "date": 0.0,
    "category": 0.0
  }
}

Rules:
- "vendor": the store or company name printed at the top of the receipt
- "amount_net": the netto (net) total, excluding VAT. On German receipts look for "Netto", "Netto-Betrag", or the sum before MwSt. If only a gross total is visible, set this to null.
- "amount_gross": the brutto (gross) total including VAT. Look for "Brutto", "Brutto-Betrag", "Gesamt", "Total", "Summe", "Betrag". If only one total is shown with no VAT breakdown, put it here and leave amount_net null.
- "amount_19": the gross subtotal for items at 19% VAT ("19% MwSt. auf ..."). Null if not shown.
- "amount_7": the gross subtotal for items at 7% VAT ("7% MwSt. auf ..."). Null if not shown.
- "amount_0": the gross subtotal for VAT-exempt items ("0% MwSt." or "MwSt.-frei"). Null if not shown.
- All amounts are decimal numbers (e.g. 13.00). Do not include currency symbols.
- "date": the transaction date in YYYY-MM-DD format. German receipts use DD.MM.YYYY — convert it.
- "category": use "transport" only if the receipt is clearly for transportation (taxi, rideshare, Uber, fuel/Kraftstoff, train/Bahn, bus, parking/Parkhaus, toll). Otherwise use "general".
- "notes": a short note about what was purchased, or null if nothing useful to add.
- "confidence": a score from 0.0 to 1.0 for vendor, amount_net, date, and category.
- If a field cannot be determined, use null for the value.

Output ONLY the JSON object. Do not wrap it in markdown or add any other text.`

let _client: OpenAI | undefined

function getClient(): OpenAI {
  if (!_client) {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY environment variable is not set')
    _client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: key })
  }
  return _client
}

export async function extractReceiptData(
  input: { imageBase64: string; mimeType: string } | { text: string }
): Promise<OcrResult> {
  let userContent: OpenAI.ChatCompletionUserMessageParam['content']

  if ('imageBase64' in input) {
    userContent = [
      {
        type: 'image_url',
        image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
      },
      { type: 'text', text: 'Extract receipt information from this image.' },
    ]
  } else {
    userContent = `Receipt text:\n${input.text}`
  }

  const response = await getClient().chat.completions.create({
    model: 'google/gemini-2.5-flash-lite',
    max_tokens: 512,
    messages: [
      { role: 'system', content: OCR_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text?.trim()) throw new Error('OpenRouter OCR returned empty response')
  return parseOcrResponse(text)
}
```

**Step 4: Run OCR tests — confirm they pass**

```bash
npm test -- --run src/lib/ocr.test.ts
```

Expected: PASS (12 tests).

**Step 5: Commit**

```bash
git add src/lib/ocr.ts src/lib/ocr.test.ts
git commit -m "feat: add VAT breakdown fields to OCR interface and prompt"
```

---

### Task 5: Update expenses API routes

**Files:**
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/app/api/expenses/[id]/route.ts`

**Context:** POST validates `amount` and inserts it. PATCH allows-lists `amount`. Both need updating to use `amount_net` and also pass through the four new nullable VAT fields. The validation rule stays the same: `amount_net` must be a positive number.

**Step 1: Replace `src/app/api/expenses/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const inbox = searchParams.get('inbox') === 'true'

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (inbox) {
    query = query.is('project_id', null)
  } else if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    project_id, vendor, amount_net, amount_gross, amount_19, amount_7, amount_0,
    date, category, notes, receipt_path, is_return, ocr_confidence
  } = body

  const parsedAmountNet = Number(amount_net)
  if (amount_net === undefined || amount_net === null || isNaN(parsedAmountNet) || parsedAmountNet <= 0) {
    return NextResponse.json({ error: 'amount_net must be a positive number' }, { status: 400 })
  }
  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }
  if (!['general', 'transport'].includes(category)) {
    return NextResponse.json({ error: 'category must be general or transport' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      project_id: project_id || null,
      vendor: vendor || null,
      amount_net: parsedAmountNet,
      amount_gross: amount_gross != null ? Number(amount_gross) : null,
      amount_19: amount_19 != null ? Number(amount_19) : null,
      amount_7: amount_7 != null ? Number(amount_7) : null,
      amount_0: amount_0 != null ? Number(amount_0) : null,
      date,
      category,
      notes: notes || null,
      receipt_path: receipt_path || null,
      is_return: is_return ?? false,
      ocr_confidence: ocr_confidence || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Replace `src/app/api/expenses/[id]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Allowlist safe fields only
  const allowed: Record<string, unknown> = {}
  if (body.project_id !== undefined) allowed.project_id = body.project_id
  if (body.vendor !== undefined) allowed.vendor = body.vendor
  if (body.amount_net !== undefined) allowed.amount_net = Number(body.amount_net)
  if (body.amount_gross !== undefined) allowed.amount_gross = body.amount_gross != null ? Number(body.amount_gross) : null
  if (body.amount_19 !== undefined) allowed.amount_19 = body.amount_19 != null ? Number(body.amount_19) : null
  if (body.amount_7 !== undefined) allowed.amount_7 = body.amount_7 != null ? Number(body.amount_7) : null
  if (body.amount_0 !== undefined) allowed.amount_0 = body.amount_0 != null ? Number(body.amount_0) : null
  if (body.date !== undefined) allowed.date = body.date
  if (body.category !== undefined) allowed.category = body.category
  if (body.notes !== undefined) allowed.notes = body.notes
  if (body.is_return !== undefined) allowed.is_return = body.is_return

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: expense } = await supabase
    .from('expenses')
    .select('receipt_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (expense.receipt_path) {
    await supabase.storage.from('receipts').remove([expense.receipt_path])
  }

  return new NextResponse(null, { status: 204 })
}
```

**Step 3: Run tests**

```bash
npm test -- --run
```

Expected: budget and OCR tests pass. PDF tests may fail on `amount` references — will fix in Task 8.

**Step 4: Commit**

```bash
git add src/app/api/expenses/route.ts src/app/api/expenses/\[id\]/route.ts
git commit -m "feat: update expenses API to use amount_net and new VAT fields"
```

---

### Task 6: Update projects API routes

**Files:**
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/projects/[id]/route.ts`

**Context:** Add `cost_center` to the projects POST (insert) and PATCH (allow-list). The GET for the project list selects `expenses(amount, is_return, category)` — rename `amount` to `amount_net` in that select.

**Step 1: Replace `src/app/api/projects/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('*, client:clients(id, name), expenses(amount_net, is_return, category)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, total_budget, client_id, cost_center } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: name.trim(),
      total_budget: total_budget || 0,
      client_id: client_id || null,
      cost_center: cost_center?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Update the PATCH handler in `src/app/api/projects/[id]/route.ts`**

Add `cost_center` to the allowedFields block. Find this section:

```typescript
  if (body.name !== undefined) allowedFields.name = body.name
  if (body.total_budget !== undefined) allowedFields.total_budget = body.total_budget
  if (body.client_id !== undefined) allowedFields.client_id = body.client_id
```

Replace with:

```typescript
  if (body.name !== undefined) allowedFields.name = body.name
  if (body.total_budget !== undefined) allowedFields.total_budget = body.total_budget
  if (body.client_id !== undefined) allowedFields.client_id = body.client_id
  if (body.cost_center !== undefined) allowedFields.cost_center = body.cost_center || null
```

**Step 3: Run tests**

```bash
npm test -- --run
```

**Step 4: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/projects/\[id\]/route.ts
git commit -m "feat: add cost_center to projects API"
```

---

### Task 7: Update ExpenseForm

**Files:**
- Modify: `src/components/expenses/expense-form.tsx`

**Context:** Add state and form fields for `amount_gross`, `amount_19`, `amount_7`, `amount_0`. Relabel "Amount (€) *" to "Amount net (€) *". Populate new fields from OCR result. Include in the POST body. The form also needs to handle `amount_net` in the OCR result (currently reads `ocrResult.amount`).

**Step 1: Replace `src/components/expenses/expense-form.tsx`**

```typescript
'use client'
import { useState } from 'react'
import ReceiptUpload from './receipt-upload'
import type { OcrResult } from '@/lib/ocr'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  projectId?: string
  onSuccess: () => void
  projects?: Array<{ id: string; name: string }>
}

export default function ExpenseForm({ userId, projectId, onSuccess, projects }: Props) {
  const [vendor, setVendor] = useState('')
  const [amountNet, setAmountNet] = useState('')
  const [amountGross, setAmountGross] = useState('')
  const [amount19, setAmount19] = useState('')
  const [amount7, setAmount7] = useState('')
  const [amount0, setAmount0] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState<'general' | 'transport'>('general')
  const [notes, setNotes] = useState('')
  const [isReturn, setIsReturn] = useState(false)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [lowConfidence, setLowConfidence] = useState<string[]>([])
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({})
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOcrResult({ storagePath, ocrResult }: { storagePath: string; ocrResult: OcrResult }) {
    setReceiptPath(storagePath)
    setLowConfidence(ocrResult.lowConfidenceFields)
    setOcrConfidence(ocrResult.confidence)
    if (ocrResult.vendor) setVendor(ocrResult.vendor)
    if (ocrResult.amount_net !== null) setAmountNet(String(ocrResult.amount_net))
    if (ocrResult.amount_gross !== null) setAmountGross(String(ocrResult.amount_gross))
    if (ocrResult.amount_19 !== null) setAmount19(String(ocrResult.amount_19))
    if (ocrResult.amount_7 !== null) setAmount7(String(ocrResult.amount_7))
    if (ocrResult.amount_0 !== null) setAmount0(String(ocrResult.amount_0))
    if (ocrResult.date) setDate(ocrResult.date)
    if (ocrResult.category) setCategory(ocrResult.category)
    if (ocrResult.notes) setNotes(ocrResult.notes)
  }

  function fieldClass(field: string) {
    return cn(lowConfidence.includes(field) && 'ring-2 ring-yellow-400 ring-offset-1')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: selectedProjectId,
        vendor: vendor || null,
        amount_net: parseFloat(amountNet),
        amount_gross: amountGross ? parseFloat(amountGross) : null,
        amount_19: amount19 ? parseFloat(amount19) : null,
        amount_7: amount7 ? parseFloat(amount7) : null,
        amount_0: amount0 ? parseFloat(amount0) : null,
        date,
        category,
        notes: notes || null,
        receipt_path: receiptPath,
        is_return: isReturn,
        ocr_confidence: ocrConfidence,
      }),
    })

    if (res.ok) {
      onSuccess()
    } else {
      const d = await res.json()
      setError(d.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {projects && (
        <div className="space-y-1">
          <Label>Project</Label>
          <Select
            value={selectedProjectId ?? ''}
            onValueChange={v => setSelectedProjectId(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="No project — goes to Inbox" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedProjectId && (
            <p className="text-xs text-gray-400">No project selected — expense will go to Inbox</p>
          )}
        </div>
      )}
      <ReceiptUpload userId={userId} onResult={handleOcrResult} onError={setError} />

      {lowConfidence.length > 0 && (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
          Highlighted fields have low OCR confidence — please verify before saving.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="vendor">Vendor</Label>
        <Input
          id="vendor"
          className={fieldClass('vendor')}
          value={vendor}
          onChange={e => setVendor(e.target.value)}
          placeholder="Store or vendor name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount_net">Amount net (€) *</Label>
          <Input
            id="amount_net"
            type="number"
            step="0.01"
            min="0.01"
            className={fieldClass('amount_net')}
            value={amountNet}
            onChange={e => setAmountNet(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            className={fieldClass('date')}
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount_gross">Gross total (€)</Label>
        <Input
          id="amount_gross"
          type="number"
          step="0.01"
          min="0"
          value={amountGross}
          onChange={e => setAmountGross(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-500">VAT breakdown — gross amounts (optional)</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="amount_19" className="text-xs">19%</Label>
            <Input
              id="amount_19"
              type="number"
              step="0.01"
              min="0"
              value={amount19}
              onChange={e => setAmount19(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount_7" className="text-xs">7%</Label>
            <Input
              id="amount_7"
              type="number"
              step="0.01"
              min="0"
              value={amount7}
              onChange={e => setAmount7(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount_0" className="text-xs">0%</Label>
            <Input
              id="amount_0"
              type="number"
              step="0.01"
              min="0"
              value={amount0}
              onChange={e => setAmount0(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category *</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as 'general' | 'transport')}>
          <SelectTrigger className={fieldClass('category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isReturn}
          onChange={e => setIsReturn(e.target.checked)}
          className="rounded"
        />
        This is a return / refund
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving…' : 'Save expense'}
      </Button>
    </form>
  )
}
```

**Step 2: Run tests**

```bash
npm test -- --run
```

**Step 3: Commit**

```bash
git add src/components/expenses/expense-form.tsx
git commit -m "feat: add VAT breakdown fields to expense form"
```

---

### Task 8: Update expense display components

**Files:**
- Modify: `src/components/expenses/expense-list-client.tsx`
- Modify: `src/components/inbox/inbox-client.tsx`

**Context:** Both components display `expense.amount` which is now `expense.amount_net`. Also update `ExpenseDetail` in `expense-list-client.tsx` to show the gross and VAT breakdown if present.

**Step 1: Update `src/components/expenses/expense-list-client.tsx`**

In `ExpenseTable`, change the amount display (line 109):

```typescript
// OLD:
€{Math.abs(expense.amount).toFixed(2)}
// NEW:
€{Math.abs(expense.amount_net).toFixed(2)}
```

In `ExpenseDetail`, update the Amount display and add VAT fields. Replace the `<dl>` block (lines 131–145):

```tsx
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-gray-500">Vendor</dt><dd className="font-medium">{expense.vendor ?? '—'}</dd></div>
        <div>
          <dt className="text-gray-500">Amount (net)</dt>
          <dd className="font-medium">
            {expense.is_return ? '+' : ''}€{Math.abs(expense.amount_net).toFixed(2)}
            {expense.is_return && <span className="text-xs ml-1 text-green-600">(return)</span>}
          </dd>
        </div>
        {expense.amount_gross != null && (
          <div>
            <dt className="text-gray-500">Gross total</dt>
            <dd className="font-medium">€{expense.amount_gross.toFixed(2)}</dd>
          </div>
        )}
        {(expense.amount_19 != null || expense.amount_7 != null || expense.amount_0 != null) && (
          <div className="col-span-2">
            <dt className="text-gray-500 mb-1">VAT breakdown (gross)</dt>
            <dd className="font-medium flex gap-4 text-sm">
              {expense.amount_19 != null && <span>19%: €{expense.amount_19.toFixed(2)}</span>}
              {expense.amount_7 != null && <span>7%: €{expense.amount_7.toFixed(2)}</span>}
              {expense.amount_0 != null && <span>0%: €{expense.amount_0.toFixed(2)}</span>}
            </dd>
          </div>
        )}
        <div><dt className="text-gray-500">Date</dt><dd className="font-medium">{expense.date}</dd></div>
        <div><dt className="text-gray-500">Category</dt><dd className="font-medium capitalize">{expense.category}</dd></div>
        {expense.notes && (
          <div className="col-span-2"><dt className="text-gray-500">Notes</dt><dd className="font-medium">{expense.notes}</dd></div>
        )}
      </dl>
```

**Step 2: Update `src/components/inbox/inbox-client.tsx`**

On line 82, change `expense.amount` → `expense.amount_net`:

```tsx
// OLD:
<p className="font-medium">€{Math.abs(expense.amount).toFixed(2)}</p>
// NEW:
<p className="font-medium">€{Math.abs(expense.amount_net).toFixed(2)}</p>
```

Also update the label from "Amount" to "Amount (net)" on the preceding line:

```tsx
// OLD:
<p className="text-gray-500 text-xs">Amount</p>
// NEW:
<p className="text-gray-500 text-xs">Amount (net)</p>
```

**Step 3: Run tests**

```bash
npm test -- --run
```

**Step 4: Commit**

```bash
git add src/components/expenses/expense-list-client.tsx src/components/inbox/inbox-client.tsx
git commit -m "feat: update expense display to use amount_net and show VAT breakdown"
```

---

### Task 9: Update PDF export

**Files:**
- Modify: `src/lib/pdf-export.ts`
- Modify: `src/lib/pdf-export.test.ts`

**Context:** `pdf-export.ts` uses `row.amount` in three places. Rename to `row.amount_net`. Also:
- Rename the "Amount" column header to "Net"
- After each expense row, if `amount_gross` is set, print a secondary detail line in gray
- Add cost_center to the project header section if present

The `GeneratePdfOptions` type must accept `project` with the new `cost_center` field. Also update test fixtures to use `amount_net`.

**Step 1: Update `src/lib/pdf-export.test.ts`**

In all expense fixture objects, change `amount` → `amount_net`. Add the new nullable fields too:

```typescript
import { describe, it, expect } from 'vitest'
import { formatCurrency, buildExpenseRows } from './pdf-export'

describe('formatCurrency', () => {
  it('formats positive amounts with euro sign', () => {
    expect(formatCurrency(42.5)).toBe('€42.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('€0.00')
  })

  it('formats negative amounts with leading minus', () => {
    expect(formatCurrency(-15)).toBe('-€15.00')
  })
})

describe('buildExpenseRows', () => {
  it('separates general and transport expenses', () => {
    const expenses = [
      { category: 'general', amount_net: 100, is_return: false, vendor: 'IKEA', date: '2026-03-01', notes: null, id: '1', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '', amount_gross: null, amount_19: null, amount_7: null, amount_0: null },
      { category: 'transport', amount_net: 20, is_return: false, vendor: 'Uber', date: '2026-03-02', notes: null, id: '2', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '', amount_gross: null, amount_19: null, amount_7: null, amount_0: null },
    ]
    const { general, transport } = buildExpenseRows(expenses as any)
    expect(general).toHaveLength(1)
    expect(transport).toHaveLength(1)
    expect(general[0].vendor).toBe('IKEA')
    expect(transport[0].vendor).toBe('Uber')
  })

  it('sorts rows by date ascending', () => {
    const expenses = [
      { category: 'general', amount_net: 10, is_return: false, vendor: 'B', date: '2026-03-05', notes: null, id: '1', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '', amount_gross: null, amount_19: null, amount_7: null, amount_0: null },
      { category: 'general', amount_net: 20, is_return: false, vendor: 'A', date: '2026-03-01', notes: null, id: '2', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '', amount_gross: null, amount_19: null, amount_7: null, amount_0: null },
    ]
    const { general } = buildExpenseRows(expenses as any)
    expect(general[0].vendor).toBe('A')
    expect(general[1].vendor).toBe('B')
  })

  it('includes returns in their category', () => {
    const expenses = [
      { category: 'general', amount_net: 50, is_return: true, vendor: 'IKEA Return', date: '2026-03-10', notes: null, id: '1', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '', amount_gross: null, amount_19: null, amount_7: null, amount_0: null },
    ]
    const { general } = buildExpenseRows(expenses as any)
    expect(general).toHaveLength(1)
    expect(general[0].is_return).toBe(true)
  })
})
```

**Step 2: Run PDF tests — confirm buildExpenseRows tests still pass (they don't use amount)**

```bash
npm test -- --run src/lib/pdf-export.test.ts
```

Expected: PASS — `buildExpenseRows` doesn't access amount fields, so nothing breaks.

**Step 3: Update `src/lib/pdf-export.ts`**

Change `GeneratePdfOptions` to accept `cost_center` on project:

```typescript
interface GeneratePdfOptions {
  project: { name: string; total_budget: number; cost_center?: string | null }
  client: { name: string } | null
  expenses: Expense[]
  receiptBuffers: ReceiptBuffer[]
  generatedDate?: string
}
```

In the header section, after the `Generated:` line, add cost_center display. Find:

```typescript
  drawText(`Generated: ${generatedDate}`, margin, y, { size: 9, color: [0.5, 0.5, 0.5] })
  y -= 24
```

Replace with:

```typescript
  drawText(`Generated: ${generatedDate}`, margin, y, { size: 9, color: [0.5, 0.5, 0.5] })
  y -= 14
  if (project.cost_center) {
    drawText(`Cost Centre: ${project.cost_center}`, margin, y, { size: 9, color: [0.5, 0.5, 0.5] })
    y -= 14
  }
  y -= 10
```

In `drawExpenseTable`, update the column header from "Amount" to "Net":

```typescript
// OLD:
    drawText('Amount', pageWidth - margin - 55, y, { size: 8, bold: true, color: [0.4, 0.4, 0.4] })
// NEW:
    drawText('Net', pageWidth - margin - 55, y, { size: 8, bold: true, color: [0.4, 0.4, 0.4] })
```

In the row loop, change `row.amount` → `row.amount_net` in two places:

```typescript
// OLD:
      const amountStr = row.is_return
        ? `+${formatCurrency(Math.abs(row.amount))}`
        : formatCurrency(row.amount)
      const amountColor: [number, number, number] = row.is_return ? [0, 0.5, 0] : [0, 0, 0]

      drawText(row.date, margin, y, { size: 8 })
      drawText((row.vendor ?? '—').substring(0, 28), margin + 65, y, { size: 8 })
      drawText((row.notes ?? '').substring(0, 22), margin + 230, y, { size: 8 })
      drawText(amountStr, pageWidth - margin - 55, y, { size: 8, color: amountColor })
      y -= 13

// NEW:
      const amountStr = row.is_return
        ? `+${formatCurrency(Math.abs(row.amount_net))}`
        : formatCurrency(row.amount_net)
      const amountColor: [number, number, number] = row.is_return ? [0, 0.5, 0] : [0, 0, 0]

      drawText(row.date, margin, y, { size: 8 })
      drawText((row.vendor ?? '—').substring(0, 28), margin + 65, y, { size: 8 })
      drawText((row.notes ?? '').substring(0, 22), margin + 230, y, { size: 8 })
      drawText(amountStr, pageWidth - margin - 55, y, { size: 8, color: amountColor })
      y -= 13

      // VAT detail line if gross data is present
      if (row.amount_gross != null) {
        checkPageBreak(11)
        const parts: string[] = [`Gross: €${row.amount_gross.toFixed(2)}`]
        if (row.amount_19 != null) parts.push(`19%: €${row.amount_19.toFixed(2)}`)
        if (row.amount_7 != null) parts.push(`7%: €${row.amount_7.toFixed(2)}`)
        if (row.amount_0 != null) parts.push(`0%: €${row.amount_0.toFixed(2)}`)
        drawText(parts.join('  '), margin + 65, y, { size: 7, color: [0.5, 0.5, 0.5] })
        y -= 10
      }
```

Update the section total calculation:

```typescript
// OLD:
    const sectionTotal = rows.reduce(
      (sum, r) => sum + (r.is_return ? -Math.abs(r.amount) : Math.abs(r.amount)),
      0
    )
// NEW:
    const sectionTotal = rows.reduce(
      (sum, r) => sum + (r.is_return ? -Math.abs(r.amount_net) : Math.abs(r.amount_net)),
      0
    )
```

**Step 4: Run PDF tests — confirm they pass**

```bash
npm test -- --run src/lib/pdf-export.test.ts
```

Expected: PASS (5 tests).

**Step 5: Run all tests**

```bash
npm test -- --run
```

Expected: all passing.

**Step 6: Commit**

```bash
git add src/lib/pdf-export.ts src/lib/pdf-export.test.ts
git commit -m "feat: update PDF export for amount_net, VAT detail lines, and cost_center header"
```

---

### Task 10: Add cost_center to ProjectForm and project page

**Files:**
- Modify: `src/components/projects/project-form.tsx`
- Modify: `src/app/(app)/projects/[id]/page.tsx`

**Context:** The `ProjectForm` dialog creates new projects — add a "Cost centre" text input. The project detail page (`/projects/[id]`) displays project info — show `cost_center` in the header, and add a small inline editable field using a client component defined in the same page file.

**Step 1: Update `src/components/projects/project-form.tsx`**

Add `costCenter` state after `clientId`:

```typescript
  const [costCenter, setCostCenter] = useState('')
```

Reset it in `handleSubmit` on success (after `setClientId('')`):

```typescript
    setCostCenter('')
```

Add `cost_center` to the POST body in `handleSubmit`:

```typescript
      body: JSON.stringify({
        name,
        total_budget: parseFloat(budget) || 0,
        client_id: clientId || null,
        cost_center: costCenter.trim() || null,
      }),
```

Add the cost centre input field to the form JSX, after the budget field:

```tsx
            <div className="space-y-2">
              <Label htmlFor="cost-center">Cost Centre</Label>
              <Input
                id="cost-center"
                value={costCenter}
                onChange={e => setCostCenter(e.target.value)}
                placeholder="e.g. 597B"
              />
            </div>
```

**Step 2: Update `src/app/(app)/projects/[id]/page.tsx`**

Add a `ProjectCostCenterField` client component at the bottom of the file (after the page component):

```typescript
'use client'
function ProjectCostCenterField({ projectId, initialValue }: { projectId: string; initialValue: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_center: value.trim() || null }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          className="text-sm border rounded px-2 py-1 w-40"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="e.g. 597B"
          autoFocus
        />
        <button onClick={save} disabled={saving} className="text-sm text-gray-700 hover:text-black">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => { setValue(initialValue ?? ''); setEditing(false) }} className="text-sm text-gray-400 hover:text-gray-700">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <p className="text-sm text-gray-500 mt-1">
      Cost centre: <span className="font-medium text-gray-700">{initialValue ?? '—'}</span>
      {' '}
      <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 underline">
        edit
      </button>
    </p>
  )
}
```

Add the necessary imports at the top of the page file:

```typescript
'use client' // NOT HERE — the page itself stays server. See note below.
```

**Important:** The page file cannot be a client component because it fetches data server-side. Instead, extract `ProjectCostCenterField` to a separate file: `src/components/projects/project-cost-center-field.tsx`.

Create `src/components/projects/project-cost-center-field.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  initialValue: string | null
}

export default function ProjectCostCenterField({ projectId, initialValue }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_center: value.trim() || null }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          className="text-sm border rounded px-2 py-1 w-40"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="e.g. 597B"
          autoFocus
        />
        <button onClick={save} disabled={saving} className="text-sm text-gray-700 hover:text-black">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => { setValue(initialValue ?? ''); setEditing(false) }}
          className="text-sm text-gray-400 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <p className="text-sm text-gray-500 mt-1">
      Cost centre: <span className="font-medium text-gray-700">{initialValue ?? '—'}</span>
      {' '}
      <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 underline">
        edit
      </button>
    </p>
  )
}
```

In `src/app/(app)/projects/[id]/page.tsx`, add the import:

```typescript
import ProjectCostCenterField from '@/components/projects/project-cost-center-field'
```

Add the cost centre field in the project header section, after the client display line (`{client && <p ...>}`):

```tsx
      {/* Cost centre */}
      <ProjectCostCenterField projectId={id} initialValue={p.cost_center} />
```

Note: The Supabase query `select('*, client:clients(id, name, email), expenses(*)')` will now also return `cost_center` on the project automatically since it selects `*`.

**Step 3: Run tests**

```bash
npm test -- --run
```

Expected: all passing.

**Step 4: Commit**

```bash
git add src/components/projects/project-form.tsx src/components/projects/project-cost-center-field.tsx src/app/\(app\)/projects/\[id\]/page.tsx
git commit -m "feat: add cost_center to project form and project detail page"
```

---

### Task 11: Final check and push

**Step 1: Run full test suite**

```bash
cd /srv/projects/work/pai && npm test -- --run
```

Expected: all tests passing.

**Step 2: Push**

```bash
git push origin main
```
