/**
 * POST /api/email-semanal/[id]/enviar
 * Disparo manual do envio (mesmo papel do botão "Publicar" nos posts,
 * caso o cron de sábado falhe ou você queira antecipar o envio).
 */
import { NextRequest, NextResponse } from 'next/server'
import { enviarEmailSemanalPorId } from '@/lib/email-semanal'

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resultado = await enviarEmailSemanalPorId(params.id)
    if (resultado.enviado) {
      return NextResponse.json({ ok: true, destinatarios: resultado.destinatarios })
    }
    return NextResponse.json({ ok: false, erro: resultado.erro }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
