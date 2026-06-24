/**
 * POST /api/metricas/coletar
 * Disparo manual de coleta de métricas (usado pelo botão "Coletar Agora" na analytics page).
 * 1. Tenta reparar posts com linkedin_post_id fake (make_*) consultando a API do LinkedIn
 * 2. Coleta métricas de todos os posts elegíveis
 */

import { NextResponse } from 'next/server'
import { repararIdsMake, coletarMetricasRecentes } from '@/lib/metricas'

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === 'true'

    // Passo 1: recuperar IDs reais de posts publicados via Make.com
    const reparo = await repararIdsMake()

    // Passo 2: coletar métricas — force=true ignora intervalo de 20h/140h
    const coleta = await coletarMetricasRecentes(force)

    return NextResponse.json({ reparo, coleta, ok: true, force })
  } catch (err: any) {
    console.error('[Coletar Manual] Erro:', err)
    return NextResponse.json({ erro: err.message, ok: false }, { status: 500 })
  }
}
