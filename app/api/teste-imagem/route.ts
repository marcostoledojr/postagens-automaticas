/**
 * POST /api/teste-imagem
 * Gera uma imagem de teste sem salvar no banco.
 * Usado para validar qualidade antes de gerar posts reais.
 */

import { NextRequest, NextResponse } from 'next/server'
import { gerarImagem } from '@/lib/gerar-imagem'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { tema, texto, tipo } = await req.json()
    if (!tema) return NextResponse.json({ erro: 'tema é obrigatório' }, { status: 400 })

    const tipoFinal: 'comercial' | 'autoridade' = tipo === 'autoridade' ? 'autoridade' : 'comercial'
    const textoFinal = texto || `Post sobre: ${tema}`

    const resultado = await gerarImagem(tema, `Teste para: ${tema}`, textoFinal, tipoFinal)

    return NextResponse.json({ ok: true, url: resultado.url, prompt: resultado.prompt, tipo: resultado.tipo })
  } catch (err: any) {
    console.error('[TESTE-IMAGEM]', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

// Mantém GET básico de health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: '/api/teste-imagem', method: 'POST', campos: ['tema', 'texto', 'tipo'] })
}
