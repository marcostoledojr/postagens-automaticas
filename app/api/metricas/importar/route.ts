/**
 * POST /api/metricas/importar
 * Importa métricas a partir do arquivo Excel exportado pelo LinkedIn
 * ("Análise da publicação" → Exportar).
 *
 * O arquivo contém:
 *   - URL da publicação (com o share ID do LinkedIn)
 *   - Impressões, Reações, Comentários, Compartilhamentos, etc.
 *
 * O sistema:
 *   1. Lê o arquivo via API do LinkedIn ou extrai do JSON enviado
 *   2. Extrai o URN do post da URL
 *   3. Encontra o post correspondente no banco (por URN ou por data)
 *   4. Salva as métricas
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/** Extrai o URN do LinkedIn a partir da URL do post */
function extrairUrnDaUrl(url: string): string | null {
  // Formato: /posts/user_titulo-share-ID-XXXX/
  const matchShare = url.match(/[-_]share[-_](\d{15,})[-_]/)
  if (matchShare) return `urn:li:share:${matchShare[1]}`

  // Formato: /feed/update/urn:li:share:ID
  const matchUrn = url.match(/urn:li:(share|ugcPost|activity):\d+/)
  if (matchUrn) return matchUrn[0]

  // Formato: /posts/user_titulo-activity-ID-XXXX/
  const matchActivity = url.match(/activity[-_](\d{15,})[-_]/)
  if (matchActivity) return `urn:li:share:${matchActivity[1]}`

  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, impressoes, curtidas, comentarios, compartilhamentos, cliques, publicado_em } = body

    if (!url) {
      return NextResponse.json({ erro: 'URL do post é obrigatória' }, { status: 400 })
    }

    const urn = extrairUrnDaUrl(url)
    if (!urn) {
      return NextResponse.json({ erro: 'Não foi possível extrair o ID do LinkedIn da URL fornecida.' }, { status: 400 })
    }

    const supabase = createClient()

    // Tenta encontrar o post pelo linkedin_post_id existente ou pela data
    let postId: string | null = null

    // 1. Tenta pelo URN direto
    const { data: porUrn } = await supabase
      .from('posts')
      .select('id')
      .eq('linkedin_post_id', urn)
      .maybeSingle()

    if (porUrn) {
      postId = porUrn.id
    } else if (publicado_em) {
      // 2. Tenta pela data (±2h)
      const data = new Date(publicado_em)
      const inicio = new Date(data.getTime() - 2 * 60 * 60 * 1000).toISOString()
      const fim = new Date(data.getTime() + 2 * 60 * 60 * 1000).toISOString()

      const { data: porData } = await supabase
        .from('posts')
        .select('id')
        .eq('status', 'publicado')
        .gte('publicado_em', inicio)
        .lte('publicado_em', fim)
        .maybeSingle()

      if (porData) {
        postId = porData.id
        // Atualiza o URN no post
        await supabase.from('posts').update({ linkedin_post_id: urn }).eq('id', postId)
      }
    }

    if (!postId) {
      // Atualiza qualquer post com make_ ID antigo se estiver dentro da janela de data
      return NextResponse.json({
        erro: 'Post não encontrado no banco. Tente colar a URL no painel de recuperação para associar manualmente.',
        urn,
      }, { status: 404 })
    }

    // Calcula score
    const imp = impressoes ?? 0
    const cur = curtidas ?? 0
    const com = comentarios ?? 0
    const comp = compartilhamentos ?? 0
    const cli = cliques ?? 0

    const score = imp > 0
      ? parseFloat(((cur + com * 3 + comp * 5 + cli * 0.5) / imp * 100).toFixed(4))
      : cur + com * 3 + comp * 5

    const payload = {
      impressoes: imp,
      curtidas: cur,
      comentarios: com,
      compartilhamentos: comp,
      cliques: cli,
      score_engajamento: score,
      coletado_em: new Date().toISOString(),
    }

    // Upsert na tabela metricas
    const { data: existente } = await supabase
      .from('metricas')
      .select('id')
      .eq('post_id', postId)
      .maybeSingle()

    if (existente) {
      await supabase.from('metricas').update(payload).eq('post_id', postId)
    } else {
      await supabase.from('metricas').insert({ post_id: postId, ...payload })
    }

    return NextResponse.json({ ok: true, urn, postId, score })
  } catch (err: any) {
    console.error('[Importar Métricas] Erro:', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
