import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// GET /api/followup/[contactId] → riwayat aktivitas follow-up 1 customer
export async function GET(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { contactId } = await ctx.params

  const { data: activities } = await supabaseAdmin
    .from('followup_activities')
    .select('id, action, note, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ activities: activities || [] })
}
