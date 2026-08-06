/**
 * GET /api/email-semanal/teste-kommo
 * Rota de diagnóstico — apenas LEITURA. Não envia nenhum email.
 * Mostra os leads encontrados no funil/etapa configurados (Kommo),
 * pra conferir se a integração está resolvendo o pipeline/status certo
 * e se os emails estão sendo encontrados nos contatos.
 *
 * Protegida pelo mesmo CRON_SECRET do cron — chame assim:
 * https://SEU_APP.vercel.app/api/email-semanal/teste-kommo?chave=SEU_CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarLeadsPerdidos } from '@/lib/kommo'

async function buscarConfig(chave: string, padrao: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()
  if (!data?.valor) return padrao
  return typeof data.valor === 'string' ? data.valor : padrao
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chave = searchParams.get('chave')
  if (chave !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const nomePipeline = await buscarConfig('kommo_pipeline_nome', 'OFICINA1')
    const nomeStatus = await buscarConfig('kommo_status_perdido_nome', 'Closed - lost')

    const leads = await buscarLeadsPerdidos(nomePipeline, nomeStatus)

    const comEmail = leads.filter(l => l.email)
    const semEmail = leads.filter(l => !l.email)

    return NextResponse.json({
      ok: true,
      funil: nomePipeline,
      etapa: nomeStatus,
      total_leads: leads.length,
      com_email: comEmail.length,
      sem_email: semEmail.length,
      leads: leads.map(l => ({ lead: l.leadNome, email: l.email ?? '(sem email)' })),
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
