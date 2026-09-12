import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarLeadsPerdidos } from '@/lib/kommo'

// Diagnóstico read-only: investiga por que a contagem de destinatários do
// email semanal está estagnada mesmo com o número de leads perdidos
// crescendo. Mostra o total de leads na etapa "Closed - lost", quantos têm
// email capturado, quantos ficam de fora por optout, e o resultado final.

const PIPELINE_PADRAO = 'OFICINA1'
const STATUS_PERDIDO_PADRAO = 'Closed - lost'
const DESTINATARIOS_INTERNOS = [
  'jaime.wikanski@oficina1.com.br',
  'andreza.favero@oficina1.com.br',
  'marcos.toledo@oficina1.com.br',
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: 'chave inválida' }, { status: 401 })
  }

  const supabase = createClient()

  const cfgPipeline = await supabase.from('configuracoes').select('valor').eq('chave', 'kommo_pipeline_nome').maybeSingle()
  const cfgStatus = await supabase.from('configuracoes').select('valor').eq('chave', 'kommo_status_perdido_nome').maybeSingle()
  const nomePipeline: string = typeof cfgPipeline.data?.valor === 'string' ? cfgPipeline.data.valor : PIPELINE_PADRAO
  const nomeStatus: string = typeof cfgStatus.data?.valor === 'string' ? cfgStatus.data.valor : STATUS_PERDIDO_PADRAO

  const leads = await buscarLeadsPerdidos(nomePipeline, nomeStatus)

  const comEmail = leads.filter(l => !!l.email)
  const semEmail = leads.filter(l => !l.email)

  const emailsUnicos = Array.from(new Set(comEmail.map(l => l.email!.toLowerCase().trim())))

  const { data: optouts } = await supabase.from('email_optout').select('email')
  const setOptout = new Set((optouts ?? []).map(o => o.email.toLowerCase().trim()))

  const excluidosPorOptout = emailsUnicos.filter(e => setOptout.has(e))
  const finalExternos = emailsUnicos.filter(e => !setOptout.has(e))
  const finalTotal = new Set([...finalExternos, ...DESTINATARIOS_INTERNOS]).size

  return NextResponse.json({
    ok: true,
    nomePipeline,
    nomeStatus,
    totalLeadsNaEtapa: leads.length,
    leadsComEmail: comEmail.length,
    leadsSemEmail: semEmail.length,
    emailsUnicosAposDeduplicar: emailsUnicos.length,
    excluidosPorOptout: excluidosPorOptout.length,
    listaOptoutQueBateram: excluidosPorOptout,
    totalFinalQueSeriaEnviado: finalTotal,
    amostraLeadsSemEmail: semEmail.slice(0, 15).map(l => ({ leadId: l.leadId, nome: l.leadNome, contatoId: l.contatoId })),
  })
}
