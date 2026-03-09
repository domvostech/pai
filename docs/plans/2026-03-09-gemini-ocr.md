# Gemini OCR Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Anthropic Claude API with Google Gemini Flash for receipt OCR, removing the Anthropic dependency entirely.

**Architecture:** Swap `@anthropic-ai/sdk` for `@google/generative-ai` in `src/lib/ocr.ts`, keeping the exact same public interface (`extractReceiptData`, `parseOcrResponse`, `OcrResult`). No other files need changes. Update env var references in `.env.local.example`.

**Tech Stack:** `@google/generative-ai` (Google AI SDK), `gemini-2.0-flash` model, existing Vitest test suite.

---

### Task 1: Install Gemini SDK and rewrite ocr.ts

**Files:**
- Modify: `src/lib/ocr.ts` (full rewrite of import + `extractReceiptData`, keep `parseOcrResponse` and types unchanged)

**Context:**
- Working directory: `/srv/projects/work/pai/.worktrees/gemini-ocr`
- The existing tests in `src/lib/ocr.test.ts` only test `parseOcrResponse` — they don't call `extractReceiptData` or mock any SDK. They will continue to pass without changes.
- The public interface (`OcrResult`, `parseOcrResponse`, `extractReceiptData` signature) must stay identical — callers in `src/app/api/ocr/route.ts` and `src/app/api/inbound-email/route.ts` must not need updating.
- `GEMINI_API_KEY` is the new env var name (replaces `ANTHROPIC_API_KEY`).

**Step 1: Install the Gemini SDK**

```bash
npm install @google/generative-ai
```

Expected: package added, no errors.

**Step 2: Verify existing tests still pass (baseline)**

```bash
npm test -- --run
```

Expected: 32 tests passing.

**Step 3: Rewrite `src/lib/ocr.ts`**

Replace the entire file with:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const CONFIDENCE_THRESHOLD = 0.7

export interface OcrResult {
  vendor: string | null
  amount: number | null
  date: string | null
  category: 'general' | 'transport' | null
  notes: string | null
  confidence: Record<string, number>
  lowConfidenceFields: string[]
}

export function parseOcrResponse(raw: string): OcrResult {
  try {
    const parsed = JSON.parse(raw)
    const confidence: Record<string, number> = parsed.confidence ?? {}
    const lowConfidenceFields = Object.entries(confidence)
      .filter(([, score]) => score < CONFIDENCE_THRESHOLD)
      .map(([field]) => field)

    return {
      vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      date: typeof parsed.date === 'string' ? parsed.date : null,
      category: ['general', 'transport'].includes(parsed.category) ? parsed.category : null,
      notes: typeof parsed.notes === 'string' ? parsed.notes : null,
      confidence,
      lowConfidenceFields,
    }
  } catch {
    return {
      vendor: null,
      amount: null,
      date: null,
      category: null,
      notes: null,
      confidence: {},
      lowConfidenceFields: [],
    }
  }
}

const OCR_SYSTEM_PROMPT = `You are a receipt parser. Extract information from the receipt and return ONLY valid JSON with this exact structure:
{
  "vendor": "store or vendor name",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "category": "general or transport",
  "notes": "any relevant notes or null",
  "confidence": {
    "vendor": 0.0,
    "amount": 0.0,
    "date": 0.0,
    "category": 0.0
  }
}
Category is "transport" only if the receipt is clearly for transportation (taxi, rideshare, fuel, train, bus, parking, toll). Otherwise use "general".
If a field cannot be determined, use null for the value and 0.0 for its confidence score.
Return ONLY the JSON object, no other text.`

export async function extractReceiptData(
  input: { imageBase64: string; mimeType: string } | { text: string }
): Promise<OcrResult> {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genai.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: OCR_SYSTEM_PROMPT,
  })

  let parts: Parameters<typeof model.generateContent>[0]

  if ('imageBase64' in input) {
    parts = [
      { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
      'Extract receipt information from this image.',
    ]
  } else {
    parts = [`Receipt text:\n${input.text}`]
  }

  const result = await model.generateContent(parts)
  const text = result.response.text()
  return parseOcrResponse(text)
}
```

**Step 4: Run tests to verify nothing broke**

```bash
npm test -- --run
```

Expected: 32 tests passing (same as before — `parseOcrResponse` tests are unaffected).

**Step 5: Commit**

```bash
git add src/lib/ocr.ts package.json package-lock.json
git commit -m "feat: replace Anthropic OCR with Google Gemini Flash"
```

---

### Task 2: Update env var references

**Files:**
- Modify: `.env.local.example`

**Context:**
- `ANTHROPIC_API_KEY` is no longer used. Replace with `GEMINI_API_KEY`.
- Get your free API key at https://aistudio.google.com/app/apikey

**Step 1: Update `.env.local.example`**

Replace the line `ANTHROPIC_API_KEY=` with `GEMINI_API_KEY=`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
POSTMARK_WEBHOOK_SECRET=
INBOUND_EMAIL_DOMAIN=
```

**Step 2: Run tests to confirm still passing**

```bash
npm test -- --run
```

Expected: 32 passing.

**Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: replace ANTHROPIC_API_KEY with GEMINI_API_KEY in env example"
```
