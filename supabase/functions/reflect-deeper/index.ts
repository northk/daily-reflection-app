import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'
import { checkRateLimit } from '../_shared/rate-limit.ts'

// Restrict CORS to a specific origin in production via the CORS_ORIGIN secret.
// Falls back to '*' for local development if the secret is not set.
const allowedOrigin = Deno.env.get('CORS_ORIGIN') ?? '*'
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Require Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Verify JWT via Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Check rate limit
    const { allowed } = await checkRateLimit(user.id)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Daily AI limit reached. Please try again tomorrow.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Parse and validate body
    const body = await req.json()
    const { entry } = body
    if (!entry || typeof entry.body !== 'string' || entry.body.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'entry.body is required and must be non-empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Build entry text for Claude
    const lines: string[] = []
    if (entry.entry_date) lines.push(`Date: ${entry.entry_date}`)
    if (entry.title) lines.push(`Title: ${entry.title}`)
    if (entry.mood != null) lines.push(`Mood: ${entry.mood}/10`)
    if (Array.isArray(entry.tags) && entry.tags.length) lines.push(`Tags: ${entry.tags.join(', ')}`)
    lines.push('', entry.body)
    const entryText = lines.join('\n')

    // 6. Call Claude
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6'

    const message = await anthropic.messages.create({
      model,
      max_tokens: 512,
      system:
        'You are a supportive, practical reflection coach. Be warm, non-clinical, non-judgmental. ' +
        'Do not give medical or mental health diagnoses. Do not mention policy. ' +
        'Produce JSON only. Keep items short and actionable. ' +
        'IMPORTANT: If the entry contains any indication of thoughts of self-harm, suicide, ' +
        'or harming others, you MUST include a "crisis_note" field in your JSON response ' +
        'with a compassionate message that acknowledges their distress and provides these ' +
        'crisis resources: US Suicide & Crisis Lifeline (call or text 988) and Crisis Text ' +
        'Line (text HOME to 741741). In this case, keep follow_up_questions gentle and ' +
        'supportive, reframes hopeful, and micro_actions focused on seeking connection and ' +
        'support. Never minimize or normalize thoughts of self-harm or harm to others. ' +
        'If no distress signals are present, omit the crisis_note field entirely.',
      messages: [
        {
          role: 'user',
          content:
            'Given the journal entry below, produce a JSON object with exactly these keys:\n' +
            '- follow_up_questions: array of 3 gentle, specific questions to help the user reflect deeper\n' +
            '- reframes: array of 2 alternative interpretations of the situation\n' +
            '- micro_actions: array of 3 tiny next steps achievable in 5–10 minutes\n' +
            '- crisis_note: (only if entry suggests self-harm or harm to others) a compassionate ' +
            'message with crisis resources including 988 and Crisis Text Line\n\n' +
            'Return JSON only, no markdown fences, no extra text.\n\n' +
            entryText,
        },
      ],
    })

    // 7. Parse response (strip accidental markdown fences)
    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    let result
    try {
      result = JSON.parse(cleaned)
    } catch {
      console.error('reflect-deeper: failed to parse Claude response:', cleaned)
      return new Response(JSON.stringify({ error: 'Invalid response from AI. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('reflect-deeper error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
