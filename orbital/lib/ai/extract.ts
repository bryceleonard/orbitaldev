import Anthropic from '@anthropic-ai/sdk'

export interface ExtractionResult {
  summary: string
  decisions: Array<{
    question?: string
    background?: string
    outcome?: string
    priority?: 'low' | 'medium' | 'high'
    status?: 'open' | 'decided'
  }>
  milestones: Array<{
    name?: string
    description?: string
    status?: 'not_started' | 'in_progress' | 'completed' | 'blocked'
    endDate?: string
  }>
  risks: Array<{
    title?: string
    description?: string
    severity?: 'low' | 'medium' | 'high'
  }>
  issues: Array<{
    title?: string
    description?: string
    severity?: 'low' | 'medium' | 'high'
  }>
}

const EMPTY: ExtractionResult = {
  summary: '',
  decisions: [],
  milestones: [],
  risks: [],
  issues: [],
}

const SYSTEM = `You are an AI assistant that extracts structured project intelligence from documents.
Extract ONLY items that are clearly evidenced in the document. Do not invent or pad.
Return a single valid JSON object — no markdown fences, no extra text.`

const USER_PROMPT = (text: string) => `Extract project intelligence from this document and return JSON with this exact shape:
{
  "summary": "2-3 sentence summary of the document",
  "decisions": [{ "question": "string", "background": "string", "outcome": "string or empty string", "priority": "low|medium|high", "status": "open|decided" }],
  "milestones": [{ "name": "string", "description": "string", "status": "not_started|in_progress|completed|blocked", "endDate": "YYYY-MM-DD or empty string" }],
  "risks": [{ "title": "string", "description": "string", "severity": "low|medium|high" }],
  "issues": [{ "title": "string", "description": "string", "severity": "low|medium|high" }]
}

Document:
${text.slice(0, 180000)}`

export async function extractIntelligence(text: string): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let raw = ''
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: USER_PROMPT(text) }],
    })
    raw = msg.content.find((b) => b.type === 'text')?.text ?? ''
    return JSON.parse(raw) as ExtractionResult
  } catch {
    return { summary: '', decisions: [], milestones: [], risks: [], issues: [] }
  }
}
