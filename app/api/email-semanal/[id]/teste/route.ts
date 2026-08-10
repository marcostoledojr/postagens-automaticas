/**
 * POST /api/email-semanal/[id]/teste
 * Envia uma cópia de teste (assunto prefixado [TESTE]) para um email específico,
 * sem alterar status nem contadores de destinatários do envio oficial.
 * Body opcional: { email: string } — padrão marcos.toledo@oficina1.com.br
 */
import { NextRequest, NextResponse } from 'next/server'
import { enviarEmailSemanalDeTeste } from '@/lib/email-semanal'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = body.email || 'marcos.toledo@oficina1.com.br'
    const resultado = await enviarEmailSemanalDeTeste(params.id, email)
    if (resultado.enviado) {
      return NextResponse.json({ ok: true, email })
    }
    return NextResponse.json({ ok: false, erro: resultado.erro }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
