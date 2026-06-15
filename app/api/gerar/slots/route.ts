/**
 * GET /api/gerar/slots?dias=N
 * Retorna lista de slots vazios no calendário para os próximos N dias.
 * Usado pela UI para mostrar o que será gerado e fazer chamadas individuais.
 *
 * Agenda fixa:
 *   Seg(1)/Qua(3)/Sex(5) → 09:00=Comercial, 14:00=Fatos TOTVS
 *   Ter(2)/Qui(4)         → 09:00=Autoridade, 14:00=Inteligência Artificial
 *   Sáb(6)               → gerarResumoSemanal (não listado aqui)
 *   Dom(0)               → sem posts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { addDays, setHours, setMinutes, setSeconds, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const SLOT_MANHA = 9
const SLOT_TARDE = 14

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dias = Math.min(Math.max(Number(searchParams.get('dias') ?? '5'), 1), 14)

  const supabase = createClient()

  // Carrega temas ativos
  const { data: temas } = await supabase
    .from('temas').select('id, nome').eq('ativo', true).order('nome')

  if (!temas || temas.length === 0) {
    return NextResponse.json({ slots: [], erro: 'Nenhum tema ativo' })
  }

  // Helper: encontra tema por keywords no nome
  function encontrar(keywords: string[]) {
    return (temas ?? []).find(t =>
      keywords.some(k => t.nome.toLowerCase().includes(k.toLowerCase()))
    ) ?? null
  }

  // Resolve temas por dia da semana
  function resolverTemas(diaSemana: number) {
    if (diaSemana % 2 === 1) {
      // Seg, Qua, Sex
      return {
        manha: encontrar(['comercial']),
        tarde: encontrar(['fatos', 'relevantes', 'protheus']),
      }
    } else {
      // Ter, Qui
      return {
        manha: encontrar(['autoridade']),
        tarde: encontrar(['inteligência artificial', 'inteligencia artificial', ' ia']),
      }
    }
  }

  const slots: Array<{
    data_iso: string
    horario: string
    tema_id: string
    tema_nome: string
    dia_label: string
  }> = []

  // Itera por dias corridos até encontrar `dias` dias ÚTEIS
  let diasUteisEncontrados = 0
  let d = 0
  while (diasUteisEncontrados < dias) {
    d++
    if (d > 60) break // safety — nunca mais de 60 dias à frente
    const dia = addDays(new Date(), d)
    const diaSemana = dia.getDay()

    // Pula domingo (0) e sábado (6)
    if (diaSemana === 0 || diaSemana === 6) continue
    diasUteisEncontrados++

    const { manha, tarde } = resolverTemas(diaSemana)
    const candidatos = [
      { hora: SLOT_MANHA, tema: manha },
      { hora: SLOT_TARDE, tema: tarde },
    ].filter(s => s.tema !== null)

    for (const candidato of candidatos) {
      // +3h: converte BRT → UTC (Vercel roda em UTC)
      // 09:00 BRT = 12:00 UTC | 14:00 BRT = 17:00 UTC
      const dataSlot = setSeconds(setMinutes(setHours(dia, candidato.hora + 3), 0), 0)

      // Verifica se slot já está ocupado (qualquer status exceto rejeitado)
      const { data: existente } = await supabase
        .from('posts').select('id')
        .eq('data_agendada', dataSlot.toISOString())
        .not('status', 'eq', 'rejeitado')
        .maybeSingle()

      if (existente) continue  // slot já ocupado

      const horario = `${String(candidato.hora).padStart(2, '0')}:00`
      const diaLabel = `${DIAS[diaSemana]} ${format(dia, 'dd/MM', { locale: ptBR })}`

      slots.push({
        data_iso: dataSlot.toISOString(),
        horario,
        tema_id: candidato.tema!.id,
        tema_nome: candidato.tema!.nome,
        dia_label: diaLabel,
      })
    }
  }

  return NextResponse.json({ slots, total: slots.length })
}
