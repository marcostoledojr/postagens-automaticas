import { NextRequest, NextResponse } from 'next/server'
import { reconstruirHtmlEmailSemanal } from '@/lib/email-semanal'

// GET utilitário: força a reconstrução do HTML de um email_semanal já
// existente (mesmos posts/texto, apenas reprocessa os links) sem apagar
// e gerar tudo de novo.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: 'chave inválida' }, { status: 401 })
  }
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, erro: 'informe ?id=' }, { status: 400 })

  await reconstruirHtmlEmailSemanal(id)
  return NextResponse.json({ ok: true })
}
