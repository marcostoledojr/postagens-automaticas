import { NextRequest, NextResponse } from 'next/server'
import { criarNotaLead } from '@/lib/kommo'

// Backfill: cria a nota de "email enviado" nos leads que já receberam o
// email semanal com sucesso, mas antes de a nota automática existir.
// Não reenvia nenhum email — só registra a nota no timeline do Kommo.

const LEAD_IDS = [
  8303696, 8303698, 8303700, 8303702, 8303704,
  8303706, 8303708, 8303710, 8303714, 8303716,
  8303718, 8303720, 8303722, 8303726, 8303728,
  8303730, 8303732, 8303734, 8303738, 8303740,
  8303742, 8303744, 8303748, 8303750, 8303752,
  8303754, 8303756, 8303758, 8303760,
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: 'chave inválida' }, { status: 401 })
  }

  const dataEnvio = searchParams.get('data') ?? new Date().toLocaleDateString('pt-BR')
  const inicio = Number(searchParams.get('inicio') ?? '0')
  const quantidade = Number(searchParams.get('quantidade') ?? '29')
  const lote = LEAD_IDS.slice(inicio, inicio + quantidade)

  const resultados: any[] = []
  for (const leadId of lote) {
    try {
      await criarNotaLead(leadId, `Email semanal Oficina1 enviado em ${dataEnvio}.`)
      resultados.push({ leadId, status: 'ok' })
    } catch (err: any) {
      resultados.push({ leadId, status: 'erro', erro: err.message })
    }
  }

  return NextResponse.json({
    ok: true,
    inicio,
    quantidade,
    proximo_inicio: inicio + quantidade < LEAD_IDS.length ? inicio + quantidade : null,
    total: LEAD_IDS.length,
    resultados,
  })
}
