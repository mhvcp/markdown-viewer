// Gemini via Vertex AI — uses the OAuth2 access token, no extra API key needed
const PROJECT = import.meta.env.VITE_GOOGLE_APP_ID || ''
const MODEL = 'gemini-3-flash-preview'

// Gemini 3 Flash Preview is only available on the global endpoint (not us-central1)
function endpoint() {
  return `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`
}

async function generate(token, prompt, text) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n---\n\n${text}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  // Strip markdown code fences if present
  return raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
}

const CLEANUP_PROMPT = (contexts) => `You are a note processor for a consulting firm (Value Capture Partners).
You receive raw voice dictation or pasted content and must:

1. CLEAN UP: Fix grammar, punctuation, remove filler words, make sentences complete.
   Preserve the original meaning exactly. Do NOT add information.
   Detect the language (German or English) and keep it in that language.

2. FORMAT: Structure as clean Markdown with an appropriate title (# heading).
   Keep it concise. Use paragraphs, not bullet points unless the content is clearly a list.

3. TAG: Analyze the content and suggest:
   - context: Which engagement or area this relates to. Choose from: ${contexts.join(', ')}
   - type: Either "note" or "content+task" (if there's a clear action item or follow-up)
   - If type is "content+task", extract a one-line task title (imperative, max 80 chars).

Respond ONLY in this exact JSON format (no preamble, no markdown fences):
{
  "cleaned_content": "# Title\\n\\nCleaned up markdown content...",
  "suggested_context": "illig",
  "suggested_type": "note",
  "task_title": "",
  "language": "en"
}`

export async function processCapture(token, rawText, contextOptions) {
  const contextIds = contextOptions.map(c => c.id)
  const jsonStr = await generate(token, CLEANUP_PROMPT(contextIds), rawText)
  try {
    return JSON.parse(jsonStr)
  } catch {
    throw new Error('Gemini returned invalid JSON — try again')
  }
}
