import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('temas')
    .select('*')
    .order('frequencia_semanal', { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ temas: data })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('temas')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ tema: data }, { status: 201 })
}
