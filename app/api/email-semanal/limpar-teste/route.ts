/**
 * GET /api/email-semanal/limpar-teste?chave=SEU_CRON_SECRET&emails=a@x.com,b@y.com
 * Rota de manutenção pontual — exclui leads de teste do Kommo pelo email,
 * dentro do funil/etapa configurados (Closed - lost). Protegida pelo CRON_SECRET.
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

  const emailsParam = searchParams.get('emails')
  if (!emailsParam) return NextResponse.json({ erro: 'Informe ?emails=a@x.com,b@y.com' }, { status: 400 })

  const emailsAlvo = emailsParam.split(',').map(e => e.toLowerCase().trim()).filter(Boolean)

  try {
    const nomePipeline = await buscarConfig('kommo_pipeline_nome', 'OFICINA1')
    const nomeStatus = await buscarConfig('kommo_status_perdido_nome', 'Closed - lost')
    const leads = await buscarLeadsPerdidos(nomePipeline, nomeStatus)

    const alvo = leads.filter(l => l.email && emailsAlvo.includes(l.email.toLowerCase().trim()))

    if (alvo.length === 0) {
      return NextResponse.json({ ok: false, erro: 'Nenhum lead encontrado com esses emails na etapa configurada' }, { status: 404 })
    }

    const apiUrl = process.env.KOMMO_API_URL
    const token = process.env.KOMMO_LONG_LIVED_TOKEN
    const resultados: any[] = []

    for (const lead of alvo) {
      try {
        const res = await fetch(`${apiUrl}/leads/${lead.leadId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        resultados.push({ leadId: lead.leadId, nome: lead.leadNome, email: lead.email, excluido: res.ok, status_http: res.status })
      } catch (err: any) {
        resultados.push({ leadId: lead.leadId, nome: lead.leadNome, email: lead.email, excluido: false, erro: err.message })
      }
    }

    return NextResponse.json({ ok: true, resultados })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
