import type { GeminiExtraction } from '../types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const EXTRACTION_PROMPT = `Analiza esta imagen de un ticket o recibo de compra y extrae los siguientes datos en formato JSON:

1. "date": La fecha de la compra. Devuélvela como timestamp Unix en milisegundos (número). Si no encuentras fecha, devuelve null.
2. "store": El nombre del comercio o establecimiento. Si no lo encuentras, devuelve null.
3. "amount": El importe total pagado como número decimal (sin símbolo de moneda). Busca el TOTAL, no subtotales. Si no lo encuentras, devuelve null.

Responde ÚNICAMENTE con el objeto JSON, sin texto adicional, sin bloques de código markdown.

Ejemplo de respuesta:
{"date":1704067200000,"store":"Mercadona","amount":45.67}
`

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>
    }
  }>
}

/**
 * Sends an image to Gemini Flash Vision and extracts receipt data
 */
export async function extractReceiptData (
  imageBuffer: ArrayBuffer,
  apiKey: string
): Promise<GeminiExtraction> {
  // Convert ArrayBuffer to base64
  const base64Image = arrayBufferToBase64(imageBuffer)

  const requestBody = {
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024
    }
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned) as GeminiExtraction
    return {
      date: parsed.date ?? null,
      store: parsed.store ?? null,
      amount: parsed.amount ?? null,
      raw_text: ''
    }
  } catch {
    // If JSON parsing fails, return raw text only
    console.error('Failed to parse Gemini JSON response:', text)
    return {
      date: null,
      store: null,
      amount: null,
      raw_text: ''
    }
  }
}

function arrayBufferToBase64 (buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}
