/**
 * POST /api/email-semanal/gerar
 * Disparo manual da geração do rascunho semanal (mesmo papel do botão
 * "Gerar Resumo" para o post de LinkedIn, mas para o email).
 */
import { NextResponse } from 'next/server'
import { gerarEmailSemanal } from '@/lib/email-semanal'

export async function POST() {
  try {
    const resultado = await gerarEmailSemanal()
    if (resultado.gerado) {
      return NextResponse.json({ ok: true, mensagem: 'Rascunho do email semanal gerado. Revise e aprove.', id: resultado.id })
    }
    return NextResponse.json({ ok: false, erro: resultado.erro ?? 'Erro desconhecido' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
