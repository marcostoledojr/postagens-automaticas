import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET /api/email-semanal/[id]/destinatarios
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('emails_semanais_destinatarios')
    .select('email, status, erro, criado_em')
    .eq('email_semanal_id', params.id)
    .order('email', { ascending: true })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ destinatarios: data })
}
