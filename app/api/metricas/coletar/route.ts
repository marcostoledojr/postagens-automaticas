/**
 * POST /api/metricas/coletar
 * Disparo manual de coleta de métricas (usado pelo botão "Coletar Agora" na analytics page).
 * 1. Tenta reparar posts com linkedin_post_id fake (make_*) consultando a API do LinkedIn
 * 2. Coleta métricas de todos os posts elegíveis
 */

import { NextResponse } from 'next/server'
import { repararIdsMake, coletarMetricasRecentes } from '@/lib/metricas'

export async function POST() {
  try {
    // Passo 1: recuperar IDs reais de posts publicados via Make.com
    const reparo = await repararIdsMake()

    // Passo 2: coletar métricas com o schedule inteligente
    const coleta = await coletarMetricasRecentes()

    return NextResponse.json({ reparo, coleta, ok: true })
  } catch (err: any) {
    console.error('[Coletar Manual] Erro:', err)
    return NextResponse.json({ erro: err.message, ok: false }, { status: 500 })
  }
}
