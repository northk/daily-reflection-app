import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurable via Supabase secret DAILY_AI_LIMIT. Change in dashboard → no redeploy needed.
const DAILY_LIMIT = parseInt(Deno.env.get('DAILY_AI_LIMIT') ?? '10')

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase.rpc('check_and_increment_ai_usage', {
    p_user_id: userId,
    p_usage_date: today,
    p_daily_limit: DAILY_LIMIT,
  })

  if (error) {
    // Fail closed: if the DB call fails, deny the request rather than
    // allowing unlimited calls through.
    console.error('Rate limit check failed:', error.message)
    return { allowed: false }
  }

  return { allowed: data === true }
}
