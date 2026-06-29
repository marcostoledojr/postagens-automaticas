/**
 * POST /api/resumo-semanal
 * Disparo manual da geração do resumo semanal.
 * Usado pelo botão "Gerar Resumo" no painel quando o cron da sexta falhou.
 */

import { NextResponse } from 'next/server'
import { gerarResumoSemanal } from '@/lib/motor-geracao'

export async function POST() {
  try {
    const resultado = await gerarResumoSemanal()
    if (resultado.gerado) {
      return NextResponse.json({ ok: true, mensagem: 'Resumo semanal gerado e agendado para sábado às 8h.' })
    } else {
      return NextResponse.json({ ok: false, erro: resultado.erro ?? 'Erro desconhecido' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
