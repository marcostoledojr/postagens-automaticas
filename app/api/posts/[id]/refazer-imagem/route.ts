/**
 * POST /api/posts/[id]/refazer-imagem
 * Regenera apenas a imagem de um post, com instrução opcional do usuário.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { gerarImagem } from '@/lib/gerar-imagem'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}))
    const instrucao: string | undefined = body.instrucao?.trim() || undefined

    const supabase = createClient()

    // Busca post + objetivo do tema
    const { data: post, error } = await supabase
      .from('posts')
      .select('texto, tema_nome, tema_id, temas(objetivo)')
      .eq('id', params.id)
      .single()

    if (error || !post) {
      return NextResponse.json({ erro: 'Post não encontrado' }, { status: 404 })
    }

    const objetivo = (post as any).temas?.objetivo ?? ''

    // Determina tipo do post pelo nome do tema
    const nomeLower = post.tema_nome?.toLowerCase() ?? ''
    const tipoPost: 'comercial' | 'autoridade' = (
      nomeLower.includes('comercial') ||
      nomeLower.includes('totvs') ||
      nomeLower.includes('protheus') ||
      nomeLower.includes('erp')
    ) ? 'comercial' : 'autoridade'

    // Gera nova imagem (com instrução adicional se fornecida)
    const imagem = await gerarImagem(
      post.tema_nome ?? 'Geral',
      objetivo,
      post.texto,
      tipoPost,
      instrucao
    )

    // Atualiza o post com a nova imagem
    const { error: updateError } = await supabase
      .from('posts')
      .update({ imagem_url: imagem.url, imagem_prompt: imagem.prompt })
      .eq('id', params.id)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true, imagem_url: imagem.url })
  } catch (err: any) {
    console.error('[REFAZER-IMAGEM]', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
