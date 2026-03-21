import type { GeminiExtraction } from '../types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const IMAGE_EXTRACTION_PROMPT = `Analiza esta imagen de un ticket o recibo de compra y extrae los siguientes datos en formato JSON:

1. "date": La fecha de la compra. Devuélvela como timestamp Unix en milisegundos (número). Si no encuentras fecha, devuelve null.
2. "store": El nombre del comercio o establecimiento. Si no lo encuentras, devuelve null.
3. "amount": El importe total pagado como número decimal (sin símbolo de moneda). Busca el TOTAL, no subtotales. Si no lo encuentras, devuelve null.
4. "payment_method": El método de pago si aparece en el ticket (por ejemplo: "efectivo", "tarjeta", "visa", "mastercard", nombre de un banco). Si no lo encuentras, devuelve null.

Responde ÚNICAMENTE con el objeto JSON, sin texto adicional, sin bloques de código markdown.

Ejemplo de respuesta:
{"date":1704067200000,"store":"Mercadona","amount":45.67,"payment_method":"efectivo"}
`

const TEXT_EXTRACTION_PROMPT = `Analiza este mensaje de texto en el que un usuario describe un gasto y extrae los siguientes datos en formato JSON:

1. "date": La fecha del gasto si se menciona. Devuélvela como timestamp Unix en milisegundos (número). Si no se menciona, devuelve null.
2. "store": El nombre del comercio o establecimiento si se menciona. Si no, devuelve null.
3. "amount": El importe del gasto como número decimal (sin símbolo de moneda). Si no se menciona, devuelve null.
4. "payment_method": El método de pago si se menciona (por ejemplo: "efectivo", "tarjeta", nombre de un banco como "bankinter", "santander", etc.). Si no se menciona, devuelve null.

El mensaje puede ser informal y no contener todos los datos. Extrae solo lo que esté claramente indicado.
Responde ÚNICAMENTE con el objeto JSON, sin texto adicional, sin bloques de código markdown.

Ejemplo: "He gastado 10€ en la frutería y he pagado con bankinter"
Respuesta: {"date":null,"store":"frutería","amount":10.00,"payment_method":"bankinter"}
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
  const base64Image = arrayBufferToBase64(imageBuffer)

  const requestBody = {
    contents: [
      {
        parts: [
          { text: IMAGE_EXTRACTION_PROMPT },
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

  const text = await callGemini(requestBody, apiKey)

  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned) as GeminiExtraction
    return {
      date: parsed.date ?? null,
      store: parsed.store ?? null,
      amount: parsed.amount ?? null,
      raw_text: '',
      payment_method: parsed.payment_method ?? null
    }
  } catch {
    console.error('Failed to parse Gemini JSON response:', text)
    return { date: null, store: null, amount: null, raw_text: '', payment_method: null }
  }
}

/**
 * Sends a free-text expense description to Gemini and extracts structured data
 */
export async function extractExpenseFromText (
  userText: string,
  apiKey: string
): Promise<GeminiExtraction> {
  const requestBody = {
    contents: [
      {
        parts: [
          { text: TEXT_EXTRACTION_PROMPT },
          { text: `Mensaje: "${userText}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512
    }
  }

  const text = await callGemini(requestBody, apiKey)

  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned) as GeminiExtraction
    return {
      date: parsed.date ?? null,
      store: parsed.store ?? null,
      amount: parsed.amount ?? null,
      raw_text: userText,
      payment_method: parsed.payment_method ?? null
    }
  } catch {
    console.error('Failed to parse Gemini JSON response:', text)
    return { date: null, store: null, amount: null, raw_text: userText, payment_method: null }
  }
}

async function callGemini (requestBody: unknown, apiKey: string): Promise<string> {
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

  return text
}

function arrayBufferToBase64 (buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}
