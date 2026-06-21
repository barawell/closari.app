import { NextResponse } from 'next/server'
import { getActor } from '@/lib/actor'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const actor = await getActor(req)
  if (!actor) return NextResponse.json({ authenticated: false }, { status: 401 })

  let tenant = null
  if (actor.tenantId) {
    const { data } = await supabaseAdmin.from('tenants').select('id, name, slug, plan').eq('id', actor.tenantId).maybeSingle()
    tenant = data
  }
  return NextResponse.json({ authenticated: true, userId: actor.userId, role: actor.role, tenant })
}
