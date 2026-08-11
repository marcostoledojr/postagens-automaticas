import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarLeadsPerdidos, criarNotaLead } from '@/lib/kommo'

// Backfill: cria a nota de "email enviado" nos leads do Kommo que receberam
// um email_semanal já disparado (antes de a nota automática existir).
// Cruza a lista de destinatários (emails_semanais_destinatarios) com os
// leads perdidos atuais do Kommo por email. Não reenvia nenhum email.

const DESTINATARIOS_INTERNOS = [
  'jaime.wikanski@oficina1.com.br',
  'andreza.favero@oficina1.com.br',
  'marcos.toledo@oficina1.com.br',
]

const PIPELINE_PADRAO = 'OFICINA1'
const STATUS_PERDIDO_PADRAO = 'Closed - lost'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: 'chave inválida' }, { status: 401 })
  }

  const emailSemanalId = searchParams.get('id')
  if (!emailSemanalId) return NextResponse.json({ ok: false, erro: 'informe ?id=<uuid do email_semanal>' }, { status: 400 })

  const inicio = Number(searchParams.get('inicio') ?? '0')
  const quantidade = Number(searchParams.get('quantidade') ?? '15')

  const supabase = createClient()

  const { data: emailSemanal } = await supabase
    .from('emails_semanais')
    .select('enviado_em')
    .eq('id', emailSemanalId)
    .single()

  const dataEnvio = emailSemanal?.enviado_em
    ? new Date(emailSemanal.enviado_em).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR')

  const { data: destinatarios } = await supabase
    .from('emails_semanais_destinatarios')
    .select('email')
    .eq('email_semanal_id', emailSemanalId)
    .eq('status', 'enviado')

  const emailsExternos = (destinatarios ?? [])
    .map(d => d.email.toLowerCase().trim())
    .filter(e => !DESTINATARIOS_INTERNOS.includes(e))
    .sort()

  const leads = await buscarLeadsPerdidos(PIPELINE_PADRAO, STATUS_PERDIDO_PADRAO)
  const leadIdPorEmail = new Map<string, number>()
  for (const l of leads) {
    if (l.email) leadIdPorEmail.set(l.email.toLowerCase().trim(), l.leadId)
  }

  const lote = emailsExternos.slice(inicio, inicio + quantidade)
  const resultados: any[] = []

  for (const email of lote) {
    const leadId = leadIdPorEmail.get(email)
    if (!leadId) {
      resultados.push({ email, status: 'lead_nao_encontrado' })
      continue
    }
    try {
      await criarNotaLead(leadId, `Email semanal Oficina1 enviado em ${dataEnvio}.`)
      resultados.push({ email, leadId, status: 'ok' })
    } catch (err: any) {
      resultados.push({ email, leadId, status: 'erro', erro: err.message })
    }
  }

  return NextResponse.json({
    ok: true,
    dataEnvio,
    inicio,
    quantidade,
    proximo_inicio: inicio + quantidade < emailsExternos.length ? inicio + quantidade : null,
    total_externos: emailsExternos.length,
    resultados,
  })
}
