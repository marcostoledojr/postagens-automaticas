/**
 * GET /api/gerar/slots?dias=N
 * Retorna lista de slots vazios no calendário para os próximos N dias.
 * Usado pela UI para mostrar o que será gerado e fazer chamadas individuais.
 *
 * Agenda:
 *   Seg 08h → Comercial Oficina1       | Seg 13h → Gestão & Liderança
 *   Ter 08h → TOTVS Protheus           | Ter 13h → Reforma Tributária
 *   Qua 08h → Autoridade Oficina1      | Qua 13h → Mercado Financeiro
 *   Qui 08h → Comercial Oficina1       | Qui 13h → Tecnologia (2ª qui/mês = Saúde)
 *   Sex 08h → Inteligência Artificial  | Sex 13h → Livros & Insights
 *   Sáb     → Resumo semanal (não listado aqui)
 *   Dom     → sem posts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { addDays, setHours, setMinutes, setSeconds, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const SLOT_MANHA = 8
const SLOT_TARDE = 13

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

  // Retorna true se a data cai na N-ésima ocorrência do dia da semana no mês
  function isNthWeekdayOfMonth(date: Date, n: number): boolean {
    return Math.ceil(date.getDate() / 7) === n
  }

  // Resolve temas pela data completa (permite lógica de mês para Saúde)
  function resolverTemas(dia: Date) {
    const diaSemana = dia.getDay()
    switch (diaSemana) {
      case 1: // Segunda
        return { manha: encontrar(['comercial']), tarde: encontrar(['gestão', 'liderança']) }
      case 2: // Terça
        return { manha: encontrar(['totvs', 'protheus', 'fatos relevantes']), tarde: encontrar(['reforma', 'tributár']) }
      case 3: // Quarta
        return { manha: encontrar(['autoridade']), tarde: encontrar(['mercado financeiro', 'mercado fin', 'investimento']) }
      case 4: { // Quinta
        const tardeTema = isNthWeekdayOfMonth(dia, 2)
          ? encontrar(['saúde', 'saude'])
          : encontrar(['tecnologia', 'lançamento'])
        return { manha: encontrar(['comercial']), tarde: tardeTema }
      }
      case 5: // Sexta
        return { manha: encontrar(['inteligência artificial', 'inteligencia artificial']), tarde: encontrar(['livros', 'insights']) }
      default:
        return { manha: null, tarde: null }
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

    const { manha, tarde } = resolverTemas(dia)
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
