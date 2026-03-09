# OpenRouter OCR Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Google Gemini OCR integration with OpenRouter, using the OpenAI-compatible API to route requests to a free vision-capable model.

**Architecture:** Swap `@google/generative-ai` for the `openai` npm package (pointed at OpenRouter's base URL). Keep the identical public interface (`OcrResult`, `parseOcrResponse`, `extractReceiptData`). Use `meta-llama/llama-3.2-11b-vision-instruct:free` as the model — it supports base64 image input and is free with no credit card. Update env var from `GEMINI_API_KEY` to `OPENROUTER_API_KEY`.

**Tech Stack:** `openai` npm package (OpenAI SDK), OpenRouter API (`https://openrouter.ai/api/v1`), existing Vitest test suite.

---

### Task 1: Swap OCR provider to OpenRouter

**Files:**
- Modify: `src/lib/ocr.ts`
- Modify: `package.json` / `package-lock.json` (via npm)

**Context:**
- Working directory: `/srv/projects/work/pai/.worktrees/openrouter-ocr`
- The `openai` package is likely already installed (it's a common dependency). Check with `npm list openai` first.
- OpenRouter is OpenAI API-compatible: set `baseURL: 'https://openrouter.ai/api/v1'` and `apiKey: process.env.OPENROUTER_API_KEY` on the `OpenAI` client.
- The model `meta-llama/llama-3.2-11b-vision-instruct:free` supports vision. Images are sent as `image_url` content parts with `url: 'data:<mimeType>;base64,<data>'`.
- The system prompt and `parseOcrResponse` logic stay exactly the same — only the API call changes.
- Existing tests only test `parseOcrResponse` (a pure function) — they don't mock the SDK and will continue to pass without changes.
- Public interface must remain identical: `OcrResult`, `parseOcrResponse(raw: string): OcrResult`, `extractReceiptData(input): Promise<OcrResult>`.

**Step 1: Check if `openai` package is already installed**

```bash
npm list openai 2>/dev/null && echo "installed" || echo "not installed"
```

If not installed, run: `npm install openai`
If installed, skip install.

**Step 2: Uninstall `@google/generative-ai`**

```bash
npm uninstall @google/generative-ai
```

**Step 3: Rewrite `src/lib/ocr.ts`**

Replace the entire file with:

```typescript
import OpenAI from 'openai'

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

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

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

  const response = await client.chat.completions.create({
    model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    max_tokens: 512,
    messages: [
      { role: 'system', content: OCR_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) throw new Error('OpenRouter OCR returned empty response')
  return parseOcrResponse(text)
}
```

**Step 4: Run tests — must show 32 passing**

```bash
npm test -- --run
```

Expected: 32 tests passing.

**Step 5: Commit**

```bash
git add src/lib/ocr.ts package.json package-lock.json
git commit -m "feat: replace Gemini OCR with OpenRouter (llama-3.2-11b-vision)"
```

---

### Task 2: Update env var references

**Files:**
- Modify: `.env.local.example`

**Step 1: Replace `GEMINI_API_KEY=` with `OPENROUTER_API_KEY=` in `.env.local.example`**

Final file should look like:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
POSTMARK_WEBHOOK_SECRET=
INBOUND_EMAIL_DOMAIN=
```

**Step 2: Run tests**

```bash
npm test -- --run
```

Expected: 32 passing.

**Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: replace GEMINI_API_KEY with OPENROUTER_API_KEY in env example"
```
