import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { reconstruirHtmlEmailSemanal } from '@/lib/email-semanal'

// PATCH /api/email-semanal/[id]
// Usado para editar (assunto/parágrafo de abertura) e para aprovar/rejeitar (status).
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

  // Se o parágrafo de abertura ou os destaques (gancho/resumo por post) mudaram,
  // reconstrói o HTML com o conteúdo novo
  if (body.paragrafo_abertura !== undefined || body.posts_incluidos !== undefined) {
    await reconstruirHtmlEmailSemanal(id)
    const { data: atualizado } = await supabase.from('emails_semanais').select('*').eq('id', id).single()
    return NextResponse.json({ email: atualizado ?? data })
  }

  return NextResponse.json({ email: data })
}

// DELETE /api/email-semanal/[id]
// Usado para "Regerar" — apaga o rascunho da semana para poder gerar de novo.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('emails_semanais').delete().eq('id', params.id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
