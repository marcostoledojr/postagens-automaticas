import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarTema } from '@/lib/busca-web'
import { gerarTextoPost } from '@/lib/gerar-texto'
import { gerarImagem } from '@/lib/gerar-imagem'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Busca o post e seu tema
  const { data: post, error: errPost } = await supabase
    .from('posts')
    .select('*, temas(*)')
    .eq('id', params.id)
    .single()

  if (errPost || !post) {
    return NextResponse.json({ erro: 'Post não encontrado' }, { status: 404 })
  }

  try {
    const tema = (post as any).temas ?? {
      nome: post.tema_nome,
      objetivo: '',
      tom: 'profissional',
      mencoes: [],
      hashtags: post.hashtags ?? [],
      cta: null,
    }

    // Busca configurações
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['instrucoes_gerais'])

    const instrucaoBase = configs?.find(c => c.chave === 'instrucoes_gerais')?.valor ?? ''

    // Regenera texto e imagem
    const fontes = await buscarTema(tema.nome, tema.objetivo)
    const postGerado = await gerarTextoPost(tema, fontes, instrucaoBase, [])
    const imagem = await gerarImagem(tema.nome, tema.objetivo, postGerado.texto)

    // Atualiza o post no banco
    const { data, error } = await supabase
      .from('posts')
      .update({
        texto: postGerado.texto,
        imagem_url: imagem.url,
        imagem_prompt: imagem.prompt,
        hashtags: postGerado.hashtags,
        fontes_pesquisa: fontes,
        editado_por_usuario: false,
        texto_original: null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ post: data })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
