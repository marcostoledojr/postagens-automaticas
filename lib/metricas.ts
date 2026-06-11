/**
 * Coleta de métricas de engajamento do LinkedIn
 * Usa a LinkedIn API para buscar impressões, curtidas, comentários, etc.
 */

import { createClient } from './supabase-server'

export async function coletarMetricas(postId: string, linkedinPostId: string): Promise<void> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  if (!token) {
    console.warn('LINKEDIN_ACCESS_TOKEN não configurado. Pulando coleta de métricas.')
    return
  }

  try {
    // Busca métricas sociais do post via LinkedIn API
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(linkedinPostId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'LinkedIn-Version': '202401',
        },
      }
    )

    if (!res.ok) {
      console.warn(`LinkedIn métricas error: ${res.status}`)
      return
    }

    const data = await res.json()

    const curtidas = data.likesSummary?.totalLikes ?? 0
    const comentarios = data.commentsSummary?.totalFirstLevelComments ?? 0
    const compartilhamentos = data.shareStatistics?.shareCount ?? 0

    // Busca impressões (endpoint separado)
    const impressoes = await buscarImpressoes(linkedinPostId, token)

    // Calcula score de engajamento
    // Fórmula: (curtidas × 1 + comentários × 3 + compartilhamentos × 5 + cliques × 0.5) / impressões × 100
    const score = impressoes > 0
      ? ((curtidas * 1 + comentarios * 3 + compartilhamentos * 5) / impressoes) * 100
      : 0

    const supabase = createClient()
    await supabase.from('metricas').upsert({
      post_id: postId,
      impressoes,
      curtidas,
      comentarios,
      compartilhamentos,
      cliques: 0, // LinkedIn API básica não fornece cliques
      score_engajamento: parseFloat(score.toFixed(4)),
      coletado_em: new Date().toISOString(),
    }, { onConflict: 'post_id' })
  } catch (err) {
    console.error(`Erro ao coletar métricas para post ${postId}:`, err)
  }
}

async function buscarImpressoes(linkedinPostId: string, token: string): Promise<number> {
  try {
    const encoded = encodeURIComponent(linkedinPostId)
    const res = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&shares[0]=${encoded}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'LinkedIn-Version': '202401',
        },
      }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data.elements?.[0]?.totalShareStatistics?.impressionCount ?? 0
  } catch {
    return 0
  }
}

/**
 * Busca resumo de desempenho por tema para o módulo de analytics
 */
export async function buscarResumoTemas(dias: number = 30) {
  const supabase = createClient()
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('metricas')
    .select(`
      score_engajamento, impressoes, curtidas, comentarios, compartilhamentos,
      posts!inner(tema_nome, publicado_em)
    `)
    .gte('posts.publicado_em', desde)

  if (!data) return []

  // Agrupa por tema
  const porTema: Record<string, any[]> = {}
  for (const m of data) {
    const tema = (m as any).posts?.tema_nome ?? 'Desconhecido'
    if (!porTema[tema]) porTema[tema] = []
    porTema[tema].push(m)
  }

  return Object.entries(porTema).map(([tema_nome, items]) => ({
    tema_nome,
    total_posts: items.length,
    media_impressoes: items.reduce((s, i) => s + i.impressoes, 0) / items.length,
    media_curtidas: items.reduce((s, i) => s + i.curtidas, 0) / items.length,
    media_comentarios: items.reduce((s, i) => s + i.comentarios, 0) / items.length,
    media_compartilhamentos: items.reduce((s, i) => s + i.compartilhamentos, 0) / items.length,
    score_medio: items.reduce((s, i) => s + i.score_engajamento, 0) / items.length,
  }))
}
