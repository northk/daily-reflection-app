import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'
import { checkRateLimit } from '../_shared/rate-limit.ts'

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
    const { entries } = body
    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ error: 'entries must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Build entries text for Claude (cap at 7)
    const capped = entries.slice(0, 7)
    const entriesText = capped
      .map((e: Record<string, unknown>) => {
        const lines: string[] = []
        if (e['entry_date']) lines.push(`Date: ${e['entry_date']}`)
        if (e['title']) lines.push(`Title: ${e['title']}`)
        if (e['mood'] != null) lines.push(`Mood: ${e['mood']}/10`)
        if (Array.isArray(e['tags']) && (e['tags'] as string[]).length) {
          lines.push(`Tags: ${(e['tags'] as string[]).join(', ')}`)
        }
        lines.push(typeof e['body'] === 'string' ? e['body'] : '')
        return lines.join('\n')
      })
      .join('\n\n---\n\n')

    // 6. Call Claude
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6'

    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system:
        'You are a supportive reflection analyst. Summarize patterns without diagnosis. ' +
        'Focus on themes, wins, stressors, and small experiments. Produce JSON only.',
      messages: [
        {
          role: 'user',
          content:
            'Given the journal entries below (up to 7), produce a JSON object with exactly these keys:\n' +
            '- themes: array of 3–6 recurring themes\n' +
            '- wins: array of 2–5 notable wins or positive moments\n' +
            '- stressors: array of 2–5 challenges or stress points\n' +
            '- suggested_experiments: array of 3 tiny experiments phrased as actions (3 days max each)\n' +
            '- tone: object with "overall" (one descriptive phrase) and "trend" ' +
            '(one of: "improving", "flat", "worsening", "mixed")\n\n' +
            'Return JSON only, no markdown fences, no extra text.\n\n' +
            entriesText,
        },
      ],
    })

    // 7. Parse response (strip accidental markdown fences)
    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const result = JSON.parse(cleaned)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('weekly-summary error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
