import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurable via Supabase secret DAILY_AI_LIMIT. Change in dashboard → no redeploy needed.
const DAILY_LIMIT = parseInt(Deno.env.get('DAILY_AI_LIMIT') ?? '10')

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('ai_usage')
    .select('call_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single()

  const currentCount = data?.call_count ?? 0

  if (currentCount >= DAILY_LIMIT) {
    return { allowed: false }
  }

  await supabase.from('ai_usage').upsert(
    { user_id: userId, usage_date: today, call_count: currentCount + 1 },
    { onConflict: 'user_id,usage_date' },
  )

  return { allowed: true }
}
