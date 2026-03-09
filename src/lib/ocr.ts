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
