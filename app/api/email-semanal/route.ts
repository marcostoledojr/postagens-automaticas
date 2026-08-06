import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET /api/email-semanal?status=pendente&limit=20
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit = Number(searchParams.get('limit') ?? '20')

  let query = supabase
    .from('emails_semanais')
    .select('*')
    .order('semana_inicio', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ emails: data })
}
