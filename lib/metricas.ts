/**
 * Coleta de métricas de engajamento do LinkedIn
 *
 * Endpoint: memberShareStatistics (perfil pessoal)
 * Retorna: impressões, cliques, curtidas, comentários, compartilhamentos, taxa de engajamento
 * Escopo necessário: r_member_social
 *
 * Janela de coleta por post:
 *   0–7 dias após publicação   → coleta diária   (algoritmo LinkedIn empurra conteúdo recente)
 *   8–30 dias após publicação  → coleta semanal  (cauda longa)
 *   > 30 dias                  → encerrado        (score congelado)
 */

import { createClient } from './supabase-server'

// ─── Token e configurações ────────────────────────────────────────────────────

async function getLinkedInConfig(): Promise<{
  token: string | null
  personUrn: string | null
}> {
  // Prioridade 1: env var (compatibilidade com configuração manual)
  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    return {
      token: process.env.LINKEDIN_ACCESS_TOKEN,
      personUrn: process.env.LINKEDIN_PERSON_URN ?? null,
    }
  }

  const supabase = createClient()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['linkedin_access_token', 'linkedin_token_expiry', 'linkedin_person_urn'])

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.chave, r.valor]))

  const token = map['linkedin_access_token'] ?? null
  const expiry = map['linkedin_token_expiry'] ?? null
  const personUrn = map['linkedin_person_urn'] ?? null

  // Token expirado?
  if (token && expiry && new Date(expiry) < new Date()) {
    console.warn('[Métricas] LinkedIn token expirado em', expiry)
    return { token: null, personUrn: null }
  }

  return { token, personUrn }
}

export async function getLinkedInStatus(): Promise<{
  conectado: boolean
  expiraEm: string | null
  diasRestantes: number | null
}> {
  const supabase = createClient()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['linkedin_access_token', 'linkedin_token_expiry'])

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.chave, r.valor]))
  const token = map['linkedin_access_token']
  const expiry = map['linkedin_token_expiry']

  if (!token) return { conectado: false, expiraEm: null, diasRestantes: null }

  const expiryDate = expiry ? new Date(expiry) : null
  const expirado = expiryDate ? expiryDate < new Date() : false

  if (expirado) return { conectado: false, expiraEm: expiry, diasRestantes: 0 }

  const diasRestantes = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return { conectado: true, expiraEm: expiry, diasRestantes }
}

// ─── Coleta de métricas de um post ───────────────────────────────────────────

export async function coletarMetricas(postId: string, linkedinPostId: string): Promise<void> {
  if (!linkedinPostId || linkedinPostId.startsWith('make_')) {
    console.warn(`[Métricas] Post ${postId} sem LinkedIn ID real — Make.com não retornou URN. Pulando.`)
    return
  }

  const { token, personUrn } = await getLinkedInConfig()
  if (!token) {
    console.warn('[Métricas] Token não configurado ou expirado. Conecte em /analytics.')
    return
  }
  if (!personUrn) {
    console.warn('[Métricas] LinkedIn person URN não encontrado. Reconecte em /analytics.')
    return
  }

  try {
    // memberShareStatistics: endpoint oficial para métricas de posts de perfil pessoal
    // Retorna: impressões, cliques, curtidas, comentários, compartilhamentos, taxa de engajamento
    const encoded = encodeURIComponent(linkedinPostId)
    const personEncoded = encodeURIComponent(personUrn)

    const res = await fetch(
      `https://api.linkedin.com/v2/memberShareStatistics?q=actor&actor=${personEncoded}&shares[0]=${encoded}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
      }
    )

    if (!res.ok) {
      console.warn(`[Métricas] memberShareStatistics retornou ${res.status} para post ${postId}`)
      // Fallback: tenta socialActions para curtidas e comentários
      await coletarViaFallback(postId, linkedinPostId, token)
      return
    }

    const data = await res.json()
    const stats = data.elements?.[0]?.totalShareStatistics ?? {}

    const impressoes      = stats.impressionCount ?? 0
    const curtidas        = stats.likeCount ?? 0
    const comentarios     = stats.commentCount ?? 0
    const compartilhamentos = stats.shareCount ?? 0
    const cliques         = stats.clickCount ?? 0
    // Taxa de engajamento nativa do LinkedIn (0–1), já calculada pelo LinkedIn
    const taxaEngajamento = stats.engagement ?? 0

    // Score interno: pesos refletem o valor de cada ação
    // Fórmula: engajamento × 100 (se disponível) ou score bruto
    const score = taxaEngajamento > 0
      ? parseFloat((taxaEngajamento * 100).toFixed(4))
      : impressoes > 0
        ? parseFloat(((curtidas * 1 + comentarios * 3 + compartilhamentos * 5 + cliques * 0.5) / impressoes * 100).toFixed(4))
        : curtidas + comentarios * 3 + compartilhamentos * 5

    const supabase = createClient()
    await supabase.from('metricas').upsert(
      {
        post_id: postId,
        impressoes,
        curtidas,
        comentarios,
        compartilhamentos,
        cliques,
        score_engajamento: score,
        coletado_em: new Date().toISOString(),
      },
      { onConflict: 'post_id' }
    )

    console.log(
      `[Métricas] Post ${postId}: ${impressoes} impressões, ${curtidas} curtidas, ` +
      `${comentarios} comentários → score ${score.toFixed(2)}`
    )
  } catch (err) {
    console.error(`[Métricas] Erro ao coletar métricas do post ${postId}:`, err)
  }
}

/** Fallback quando memberShareStatistics falha: coleta só curtidas e comentários */
async function coletarViaFallback(postId: string, linkedinPostId: string, token: string): Promise<void> {
  try {
    const encoded = encodeURIComponent(linkedinPostId)
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encoded}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
      }
    )
    if (!res.ok) return
    const data = await res.json()

    const curtidas    = data.likesSummary?.totalLikes ?? 0
    const comentarios = data.commentsSummary?.totalFirstLevelComments ?? 0
    const score       = curtidas + comentarios * 3

    const supabase = createClient()
    await supabase.from('metricas').upsert(
      {
        post_id: postId,
        impressoes: 0,
        curtidas,
        comentarios,
        compartilhamentos: 0,
        cliques: 0,
        score_engajamento: score,
        coletado_em: new Date().toISOString(),
      },
      { onConflict: 'post_id' }
    )
    console.log(`[Métricas Fallback] Post ${postId}: ${curtidas} curtidas, ${comentarios} comentários`)
  } catch (err) {
    console.error(`[Métricas Fallback] Erro post ${postId}:`, err)
  }
}

// ─── Coleta inteligente com janela de 30 dias ─────────────────────────────────

/**
 * Chamada pelo cron diário (10h UTC).
 * Coleta métricas de todos os posts publicados nos últimos 30 dias
 * seguindo o schedule de frequência por idade do post.
 */
export async function coletarMetricasRecentes(): Promise<{ coletados: number; pulados: number }> {
  const supabase = createClient()
  const agora = new Date()
  const limite30dias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)

  const { data: posts } = await supabase
    .from('posts')
    .select('id, linkedin_post_id, publicado_em')
    .eq('status', 'publicado')
    .gte('publicado_em', limite30dias.toISOString())
    .not('linkedin_post_id', 'is', null)

  if (!posts || posts.length === 0) {
    return { coletados: 0, pulados: 0 }
  }

  let coletados = 0
  let pulados = 0

  for (const post of posts) {
    const diasDesdePublicacao =
      (agora.getTime() - new Date(post.publicado_em).getTime()) / (1000 * 60 * 60 * 24)

    // Busca última coleta
    const { data: ultimaMetrica } = await supabase
      .from('metricas')
      .select('coletado_em')
      .eq('post_id', post.id)
      .maybeSingle()

    const horasDesdeUltimaColeta = ultimaMetrica?.coletado_em
      ? (agora.getTime() - new Date(ultimaMetrica.coletado_em).getTime()) / (1000 * 60 * 60)
      : Infinity

    // Schedule de coleta:
    //   0–7 dias   → coleta diária  (min 20h entre coletas)
    //   8–30 dias  → coleta semanal (min 140h = ~6 dias entre coletas)
    //   > 30 dias  → encerrado
    let deveColetarAgora = false
    if (diasDesdePublicacao <= 7) {
      deveColetarAgora = horasDesdeUltimaColeta >= 20
    } else if (diasDesdePublicacao <= 30) {
      deveColetarAgora = horasDesdeUltimaColeta >= 140
    }

    if (!deveColetarAgora) {
      pulados++
      continue
    }

    try {
      await coletarMetricas(post.id, post.linkedin_post_id)
      coletados++
      // Pausa entre chamadas para não sobrecarregar a API
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error(`[Métricas] Erro post ${post.id}:`, err)
    }
  }

  console.log(`[Métricas] Ciclo concluído: ${coletados} coletados, ${pulados} pulados`)
  return { coletados, pulados }
}

// ─── Análise de melhor horário ────────────────────────────────────────────────

export async function analisarMelhoresHorarios(dias: number = 60) {
  const supabase = createClient()
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('metricas')
    .select('score_engajamento, impressoes, curtidas, posts!inner(data_agendada, horario_publicacao)')
    .gt('score_engajamento', 0)
    .gte('posts.publicado_em', desde)

  if (!data || data.length === 0) return []

  const porHorario: Record<string, { scores: number[]; impressoes: number[] }> = {}

  for (const m of data) {
    const horario = (m as any).posts?.horario_publicacao ?? 'desconhecido'
    if (!porHorario[horario]) porHorario[horario] = { scores: [], impressoes: [] }
    porHorario[horario].scores.push(m.score_engajamento)
    porHorario[horario].impressoes.push(m.impressoes)
  }

  return Object.entries(porHorario)
    .map(([horario, d]) => ({
      horario,
      total_posts: d.scores.length,
      score_medio: d.scores.reduce((a, b) => a + b, 0) / d.scores.length,
      impressoes_medias: d.impressoes.reduce((a, b) => a + b, 0) / d.impressoes.length,
    }))
    .sort((a, b) => b.score_medio - a.score_medio)
}

// ─── Recuperação de IDs reais (posts publicados via Make.com com ID fake) ────

/**
 * Consulta o LinkedIn para descobrir os IDs reais dos posts que têm linkedin_post_id
 * começando com "make_" (gerado como fallback quando Make.com não retornou o URN real).
 * Faz match por data de publicação (margem de 4h) e atualiza o banco.
 */
export async function repararIdsMake(): Promise<{ reparados: number; naoEncontrados: number; apiStatus: string }> {
  const { token, personUrn } = await getLinkedInConfig()
  if (!token || !personUrn) {
    return { reparados: 0, naoEncontrados: 0, apiStatus: 'token_ausente' }
  }

  const supabase = createClient()

  // Posts com IDs falsos publicados nos últimos 90 dias
  const limite90dias = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: postsParaReparar } = await supabase
    .from('posts')
    .select('id, publicado_em, texto')
    .eq('status', 'publicado')
    .like('linkedin_post_id', 'make_%')
    .not('publicado_em', 'is', null)
    .gte('publicado_em', limite90dias)

  if (!postsParaReparar || postsParaReparar.length === 0) {
    return { reparados: 0, naoEncontrados: 0, apiStatus: 'sem_posts_make' }
  }

  console.log(`[Reparo IDs] ${postsParaReparar.length} posts com ID fake encontrados`)

  const personEncoded = encodeURIComponent(personUrn)
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': '202401',
  }

  let linkedinPosts: any[] = []
  let apiStatus = 'falhou'

  // Tentativa 1: ugcPosts (formato moderno — posts com texto longo e imagens)
  const ugcRes = await fetch(
    `https://api.linkedin.com/v2/ugcPosts?q=authors&authors[0]=${personEncoded}&count=100`,
    { headers }
  )
  if (ugcRes.ok) {
    const ugcData = await ugcRes.json()
    linkedinPosts = ugcData.elements ?? []
    apiStatus = `ugcPosts_ok_${linkedinPosts.length}`
    console.log(`[Reparo IDs] ugcPosts: ${linkedinPosts.length} posts`)
  } else {
    console.warn(`[Reparo IDs] ugcPosts retornou ${ugcRes.status}`)
    // Tentativa 2: shares (formato legado)
    const sharesRes = await fetch(
      `https://api.linkedin.com/v2/shares?q=owners&owners=${personEncoded}&count=100`,
      { headers }
    )
    if (sharesRes.ok) {
      const sharesData = await sharesRes.json()
      linkedinPosts = sharesData.elements ?? []
      apiStatus = `shares_ok_${linkedinPosts.length}`
      console.log(`[Reparo IDs] shares: ${linkedinPosts.length} posts`)
    } else {
      apiStatus = `ambos_falharam_ugc${ugcRes.status}_shares${sharesRes.status}`
    }
  }

  if (linkedinPosts.length === 0) {
    return { reparados: 0, naoEncontrados: postsParaReparar.length, apiStatus }
  }

  let reparados = 0

  for (const post of postsParaReparar) {
    const publicadoEm = new Date(post.publicado_em).getTime()

    // Match por proximidade de data (margem de 4h — cron tem janela flexível)
    const match = linkedinPosts.find((lp: any) => {
      const lpTime = lp.created?.time ?? lp.firstPublishedAt
      if (!lpTime) return false
      return Math.abs(publicadoEm - lpTime) < 4 * 60 * 60 * 1000
    })

    if (match) {
      const realId = match.id ?? match.activity
      if (realId) {
        await supabase.from('posts').update({ linkedin_post_id: realId }).eq('id', post.id)
        console.log(`[Reparo IDs] Post ${post.id} → ${realId}`)
        reparados++
      }
    }
  }

  const naoEncontrados = postsParaReparar.length - reparados
  console.log(`[Reparo IDs] Resultado: ${reparados} reparados, ${naoEncontrados} não encontrados`)
  return { reparados, naoEncontrados, apiStatus }
}

// ─── Resumo por tema ──────────────────────────────────────────────────────────

export async function buscarResumoTemas(dias: number = 30) {
  const supabase = createClient()
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('metricas')
    .select(`
      score_engajamento, impressoes, curtidas, comentarios, compartilhamentos, cliques,
      posts!inner(tema_nome, publicado_em)
    `)
    .gte('posts.publicado_em', desde)

  if (!data) return []

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
    media_cliques: items.reduce((s, i) => s + (i.cliques ?? 0), 0) / items.length,
    score_medio: items.reduce((s, i) => s + i.score_engajamento, 0) / items.length,
  }))
}
