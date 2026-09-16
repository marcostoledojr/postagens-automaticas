/**
 * POST /api/posts/[id]/gerar-imagem-gemini
 * Gera uma imagem alternativa para o post usando Gemini 2.5 Flash Image,
 * em vez do fal.ai (Flux) usado por padrão. Não substitui a imagem atual
 * automaticamente até o usuário confirmar — mesmo comportamento de
 * "refazer-imagem": sobrescreve imagem_url do post direto ao gerar.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { gerarImagemGemini } from '@/lib/gerar-imagem'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}))
    const instrucao: string | undefined = body.instrucao?.trim() || undefined

    const supabase = createClient()

    const { data: post, error } = await supabase
      .from('posts')
      .select('texto, tema_nome, tema_id, temas(objetivo)')
      .eq('id', params.id)
      .single()

    if (error || !post) {
      return NextResponse.json({ erro: 'Post não encontrado' }, { status: 404 })
    }

    const objetivo = (post as any).temas?.objetivo ?? ''

    const nomeLower = post.tema_nome?.toLowerCase() ?? ''
    const tipoPost: 'comercial' | 'autoridade' = (
      nomeLower.includes('comercial') ||
      nomeLower.includes('totvs') ||
      nomeLower.includes('protheus') ||
      nomeLower.includes('erp')
    ) ? 'comercial' : 'autoridade'

    const imagem = await gerarImagemGemini(
      post.tema_nome ?? 'Geral',
      objetivo,
      post.texto,
      tipoPost,
      instrucao
    )

    const { error: updateError } = await supabase
      .from('posts')
      .update({ imagem_url: imagem.url, imagem_prompt: imagem.prompt })
      .eq('id', params.id)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true, imagem_url: imagem.url })
  } catch (err: any) {
    console.error('[GERAR-IMAGEM-GEMINI]', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
