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
