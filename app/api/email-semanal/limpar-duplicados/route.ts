/**
 * GET /api/email-semanal/limpar-duplicados?chave=SEU_CRON_SECRET&id=EMAIL_SEMANAL_ID
 * Manutenção pontual: remove registros duplicados em emails_semanais_destinatarios
 * (de tentativas de envio antigas), mantendo só o mais recente por email —
 * priorizando 'enviado' sobre 'erro' quando o mesmo email aparece duas vezes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ erro: 'Informe ?id=EMAIL_SEMANAL_ID' }, { status: 400 })

  const supabase = createClient()
  const { data: registros, error } = await supabase
    .from('emails_semanais_destinatarios')
    .select('id, email, status, criado_em')
    .eq('email_semanal_id', id)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  if (!registros || registros.length === 0) return NextResponse.json({ ok: true, removidos: 0 })

  // Agrupa por email, mantém 1 registro: prioriza 'enviado', senão o mais recente
  const melhores = new Map<string, typeof registros[number]>()
  for (const r of registros) {
    const atual = melhores.get(r.email)
    if (!atual) {
      melhores.set(r.email, r)
      continue
    }
    const candidatoMelhor =
      (r.status === 'enviado' && atual.status !== 'enviado') ||
      (r.status === atual.status && new Date(r.criado_em) > new Date(atual.criado_em))
    if (candidatoMelhor) melhores.set(r.email, r)
  }

  const idsParaManter = new Set(Array.from(melhores.values()).map(r => r.id))
  const idsParaRemover = registros.filter(r => !idsParaManter.has(r.id)).map(r => r.id)

  if (idsParaRemover.length > 0) {
    await supabase.from('emails_semanais_destinatarios').delete().in('id', idsParaRemover)
  }

  return NextResponse.json({ ok: true, total_antes: registros.length, removidos: idsParaRemover.length, restantes: melhores.size })
}
