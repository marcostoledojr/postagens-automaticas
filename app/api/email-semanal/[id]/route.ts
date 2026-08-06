import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// PATCH /api/email-semanal/[id]
// Usado para editar (assunto/corpo) e para aprovar (status: 'aprovado').
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const { id } = params

  const atualizacao: Record<string, any> = { ...body, atualizado_em: new Date().toISOString() }
  if (body.status === 'aprovado') {
    atualizacao.aprovado_em = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('emails_semanais')
    .update(atualizacao)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ email: data })
}
