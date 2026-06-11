import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status')
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')
  const limit = Number(searchParams.get('limit') ?? '50')

  let query = supabase
    .from('posts')
    .select('*')
    .order('data_agendada', { ascending: true })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (de)     query = query.gte('data_agendada', de)
  if (ate)    query = query.lte('data_agendada', ate)

  const { data, error } = await query

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}
