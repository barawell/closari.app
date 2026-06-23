import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// DELETE — revoke pending invite
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req)
  if (!actor?.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.role !== 'admin') return NextResponse.json({ error: 'hanya admin' }, { status: 403 })

  const { id } = await ctx.params

  const { error } = await supabaseAdmin
    .from('tenant_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('tenant_id', actor.tenantId)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
