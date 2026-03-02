import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    // 3. Parse and validate body
    const body = await req.json()
    const { entry } = body
    if (!entry || typeof entry.body !== 'string' || entry.body.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'entry.body is required and must be non-empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build entry text for Claude
    const lines: string[] = []
    if (entry.entry_date) lines.push(`Date: ${entry.entry_date}`)
    if (entry.title) lines.push(`Title: ${entry.title}`)
    if (entry.mood != null) lines.push(`Mood: ${entry.mood}/10`)
    if (Array.isArray(entry.tags) && entry.tags.length) lines.push(`Tags: ${entry.tags.join(', ')}`)
    lines.push('', entry.body)
    const entryText = lines.join('\n')

    // 5. Call Claude
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6'

    const message = await anthropic.messages.create({
      model,
      max_tokens: 512,
      system:
        'You are a supportive, practical reflection coach. Be warm, non-clinical, non-judgmental. ' +
        'Do not give medical or mental health diagnoses. Do not mention policy. ' +
        'Produce JSON only. Keep items short and actionable.',
      messages: [
        {
          role: 'user',
          content:
            'Given the journal entry below, produce a JSON object with exactly these keys:\n' +
            '- follow_up_questions: array of 3 gentle, specific questions to help the user reflect deeper\n' +
            '- reframes: array of 2 alternative interpretations of the situation\n' +
            '- micro_actions: array of 3 tiny next steps achievable in 5–10 minutes\n\n' +
            'Return JSON only, no markdown fences, no extra text.\n\n' +
            entryText,
        },
      ],
    })

    // 6. Parse response (strip accidental markdown fences)
    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const result = JSON.parse(cleaned)

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
