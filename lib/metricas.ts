/**
 * Coleta de métricas de engajamento do LinkedIn
 *
 * Endpoint: /rest/memberCreatorPostAnalytics (Creator Analytics API)
 * Retorna: impressões, reações, comentários, compartilhamentos, link clicks
 * Escopo necessário: r_member_postAnalytics (Community Management API — self-serve)
 * Versão mínima da API: LinkedIn-Version: 202506
 *
 * Para ativar: LinkedIn Developer Portal → seu app → Products → Community Management API
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
  analyticsToken: string | null
  personUrn: string | null
}> {
  // Prioridade 1: env var (compatibilidade com configuração manual)
  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    return {
      token: process.env.LINKEDIN_ACCESS_TOKEN,
      analyticsToken: process.env.LINKEDIN_ANALYTICS_TOKEN ?? null,
      personUrn: process.env.LINKEDIN_PERSON_URN ?? null,
    }
  }

  const supabase = createClient()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [
      'linkedin_access_token', 'linkedin_token_expiry', 'linkedin_person_urn',
      'linkedin_analytics_token', 'linkedin_analytics_token_expiry',
    ])

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.chave, r.valor]))

  const token = map['linkedin_access_token'] ?? null
  const expiry = map['linkedin_token_expiry'] ?? null
  const personUrn = map['linkedin_person_urn'] ?? null

  const analyticsToken = map['linkedin_analytics_token'] ?? null
  const analyticsExpiry = map['linkedin_analytics_token_expiry'] ?? null

  // Token de publicação expirado?
  const publishToken = (token && expiry && new Date(expiry) < new Date()) ? null : token

  // Token de analytics expirado?
  const validAnalyticsToken = (analyticsToken && analyticsExpiry && new Date(analyticsExpiry) < new Date())
    ? null
    : analyticsToken

  if (!publishToken) console.warn('[Métricas] LinkedIn token de publicação expirado ou ausente')
  if (!validAnalyticsToken) console.warn('[Métricas] LinkedIn token de analytics ausente — conecte o app de analytics')

  return { token: publishToken, analyticsToken: validAnalyticsToken, personUrn }
}

export async function getLinkedInAnalyticsStatus(): Promise<{
  conectado: boolean
  expiraEm: string | null
  diasRestantes: number | null
}> {
  const supabase = createClient()
  const { data } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['linkedin_analytics_token', 'linkedin_analytics_token_expiry'])

  const map = Object.fromEntries((data ?? []).map((r: any) => [r.chave, r.valor]))
  const token = map['linkedin_analytics_token']
  const expiry = map['linkedin_analytics_token_expiry']

  if (!token) return { conectado: false, expiraEm: null, diasRestantes: null }

  const expiryDate = expiry ? new Date(expiry) : null
  const expirado = expiryDate ? expiryDate < new Date() : false

  if (expirado) return { conectado: false, expiraEm: expiry, diasRestantes: 0 }

  const diasRestantes = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return { conectado: true, expiraEm: expiry, diasRestantes }
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

// ─── Helpers da Creator Analytics API ────────────────────────────────────────

/**
 * Monta o parâmetro `entity` para a API memberCreatorPostAnalytics.
 * Formato esperado pelo LinkedIn:
 *   share URN   → (share:urn%3Ali%3Ashare%3A{ID})
 *   ugcPost URN → (ugc:urn%3Ali%3AugcPost%3A{ID})
 */
function buildEntityParam(linkedinPostId: string): string {
  if (linkedinPostId.includes('ugcPost')) {
    const id = linkedinPostId.replace('urn:li:ugcPost:', '')
    return `(ugc:urn%3Ali%3AugcPost%3A${id})`
  } else {
    const id = linkedinPostId.replace('urn:li:share:', '')
    return `(share:urn%3Ali%3Ashare%3A${id})`
  }
}

// ─── Coleta de métricas de um post ───────────────────────────────────────────

/**
 * Coleta métricas de um post via memberCreatorPostAnalytics (Creator Analytics API).
 * Scope necessário: r_member_postAnalytics (Community Management API).
 * Retorna true se salvou dados, false se pulou (ID inválido ou sem token).
 */
export async function coletarMetricas(postId: string, linkedinPostId: string): Promise<boolean> {
  if (!linkedinPostId || linkedinPostId.startsWith('make_')) {
    console.warn(`[Métricas] Post ${postId} sem LinkedIn ID real. Pulando.`)
    return false
  }

  const { token, analyticsToken } = await getLinkedInConfig()

  // Usa token de analytics (r_member_postAnalytics) se disponível
  // Caso contrário, tenta com token de publicação (pode não ter permissão)
  const activeToken = analyticsToken ?? token
  if (!activeToken) {
    console.warn('[Métricas] Nenhum token LinkedIn disponível.')
    return false
  }
  if (!analyticsToken) {
    console.warn('[Métricas] Token de analytics não configurado — conecte o app de analytics em /analytics')
  }

  const supabase = createClient()
  const headers: HeadersInit = {
    Authorization: `Bearer ${activeToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': '202506',
  }

  let impressoes = 0, curtidas = 0, comentarios = 0, compartilhamentos = 0, cliques = 0
  let rateLimitAtingido = false

  // Resolve o URN correto: se vier share mas for ugcPost, corrige automaticamente
  let urnAtivo = linkedinPostId
  try {
    const entityParam = buildEntityParam(urnAtivo)
    const baseUrl = 'https://api.linkedin.com/rest/memberCreatorPostAnalytics'
    const probeUrl = `${baseUrl}?q=entity&entity=${entityParam}&queryType=IMPRESSION&aggregation=TOTAL`
    const probeRes = await fetch(probeUrl, { headers })
    if (probeRes.status === 404 && urnAtivo.includes('urn:li:share:')) {
      // Tenta ugcPost com o mesmo ID numérico
      const numericId = urnAtivo.replace('urn:li:share:', '')
      const ugcUrn = `urn:li:ugcPost:${numericId}`
      const ugcEntity = buildEntityParam(ugcUrn)
      const ugcProbe = await fetch(`${baseUrl}?q=entity&entity=${ugcEntity}&queryType=IMPRESSION&aggregation=TOTAL`, { headers })
      if (ugcProbe.ok) {
        console.log(`[Métricas] URN corrigido share→ugcPost para post ${postId}: ${ugcUrn}`)
        urnAtivo = ugcUrn
        // Persiste a correção no banco para evitar 404 nas próximas coletas
        const supabaseUpdate = createClient()
        await supabaseUpdate.from('posts').update({ linkedin_post_id: ugcUrn }).eq('id', postId)
      } else {
        console.warn(`[Métricas] Post ${postId} retornou 404 tanto como share quanto ugcPost. Pulando.`)
        return false
      }
    } else if (probeRes.status === 429) {
      console.error(`[Métricas] RATE LIMIT (429) no probe de ${postId}. Abortando.`)
      return false
    } else if (!probeRes.ok && probeRes.status !== 200) {
      console.warn(`[Métricas] Probe falhou (${probeRes.status}) para ${postId}. Pulando.`)
      return false
    } else if (probeRes.ok) {
      // Probe OK — lê o valor de IMPRESSION do resultado já obtido
      const probeData = await probeRes.json()
      impressoes = probeData.elements?.[0]?.count ?? 0
    }
  } catch (probeErr) {
    console.error(`[Métricas] Erro no probe de ${postId}:`, probeErr)
    return false
  }

  try {
    const entityParam = buildEntityParam(urnAtivo)
    const baseUrl = 'https://api.linkedin.com/rest/memberCreatorPostAnalytics'

    // IMPRESSION já foi obtida no probe acima — coleta as demais métricas disponíveis
    // LINK_CLICKS não é um enum válido nesta API (retorna 400) — cliques ficam 0
    const metricTypes = [
      { key: 'REACTION', set: (v: number) => { curtidas = v } },
      { key: 'COMMENT',  set: (v: number) => { comentarios = v } },
      { key: 'RESHARE',  set: (v: number) => { compartilhamentos = v } },
    ]

    for (const metric of metricTypes) {
      const url = `${baseUrl}?q=entity&entity=${entityParam}&queryType=${metric.key}&aggregation=TOTAL`
      const res = await fetch(url, { headers })

      if (res.ok) {
        const data = await res.json()
        const count = data.elements?.[0]?.count ?? 0
        metric.set(count)
      } else {
        const errText = await res.text().catch(() => '')
        console.warn(`[Métricas] Creator Analytics ${metric.key} → ${res.status}: ${errText.slice(0, 200)}`)

        if (res.status === 429) {
          // Rate limit atingido — para imediatamente sem salvar zeros
          console.error(`[Métricas] RATE LIMIT atingido (429) ao coletar post ${postId}. Abortando ciclo.`)
          rateLimitAtingido = true
          break
        }
        if (res.status === 403 && errText.includes('SCOPE_NOT_APPROVED')) {
          console.error('[Métricas] AÇÃO NECESSÁRIA: ative Community Management API no LinkedIn Developer Portal')
          break
        }
      }

      await new Promise(r => setTimeout(r, 400)) // respeita rate limit (100 calls/membro/24h)
    }

    console.log(`[Métricas] Creator Analytics para ${postId}: ${impressoes} impressões, ${curtidas} reações`)
  } catch (err) {
    console.error(`[Métricas] Erro na coleta do post ${postId}:`, err)
  }

  // Se atingiu rate limit, NÃO salva zeros — deixa dados anteriores intactos
  if (rateLimitAtingido) return false

  // Calcula score de engajamento
  const score = impressoes > 0
    ? parseFloat(((curtidas + comentarios * 3 + compartilhamentos * 5 + cliques * 0.5) / impressoes * 100).toFixed(4))
    : curtidas + comentarios * 3 + compartilhamentos * 5

  const payload = {
    impressoes,
    curtidas,
    comentarios,
    compartilhamentos,
    cliques,
    score_engajamento: score,
    coletado_em: new Date().toISOString(),
  }

  // Verifica se já existe linha para este post (evita depender de UNIQUE constraint)
  const { data: existente } = await supabase
    .from('metricas')
    .select('id')
    .eq('post_id', postId)
    .maybeSingle()

  if (existente) {
    const { error } = await supabase.from('metricas').update(payload).eq('post_id', postId)
    if (error) console.error(`[Métricas] Erro ao atualizar post ${postId}:`, error.message)
  } else {
    const { error } = await supabase.from('metricas').insert({ post_id: postId, ...payload })
    if (error) console.error(`[Métricas] Erro ao inserir post ${postId}:`, error.message)
  }

  console.log(`[Métricas] Salvo post ${postId}: ${impressoes} impressões → score ${score}`)
  return true
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
  // Posts sem impressão são coletados mesmo se >30 dias (recuperação histórica)
  const limite90dias = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000)

  const { data: posts } = await supabase
    .from('posts')
    .select('id, linkedin_post_id, publicado_em')
    .eq('status', 'publicado')
    .gte('publicado_em', limite90dias.toISOString())
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
      .select('coletado_em, impressoes')
      .eq('post_id', post.id)
      .maybeSingle()

    const horasDesdeUltimaColeta = ultimaMetrica?.coletado_em
      ? (agora.getTime() - new Date(ultimaMetrica.coletado_em).getTime()) / (1000 * 60 * 60)
      : Infinity

    // Se impressões estão zeradas (coleta anterior sem token ou com token inválido),
    // força recoleta independente do intervalo — para recuperar dados reais
    const impressoesZeradas = ultimaMetrica && (ultimaMetrica.impressoes ?? 0) === 0

    // Schedule de coleta:
    //   impressões = 0  → força recoleta (recuperação — token estava ausente ou inválido)
    //   0–7 dias        → coleta diária  (min 20h entre coletas)
    //   8–30 dias       → coleta semanal (min 140h = ~6 dias entre coletas)
    //   31–90 dias      → apenas se impressões = 0 (já coberto acima); caso contrário, encerrado
    let deveColetarAgora = false
    if (impressoesZeradas) {
      // Força recoleta independente da idade — dado ainda não foi obtido com token válido
      deveColetarAgora = true
    } else if (diasDesdePublicacao <= 7) {
      deveColetarAgora = horasDesdeUltimaColeta >= 20
    } else if (diasDesdePublicacao <= 30) {
      deveColetarAgora = horasDesdeUltimaColeta >= 140
    }
    // > 30 dias com impressões reais: score congelado, não coleta mais

    if (!deveColetarAgora) {
      pulados++
      continue
    }

    try {
      const salvou = await coletarMetricas(post.id, post.linkedin_post_id)
      if (salvou) {
        coletados++
        await new Promise(r => setTimeout(r, 500)) // pausa entre chamadas
      } else {
        pulados++
        // Se retornou false por rate limit (não por ID inválido), para o ciclo
        // coletarMetricas loga o motivo — aqui apenas registramos
      }
    } catch (err) {
      console.error(`[Métricas] Erro post ${post.id}:`, err)
      pulados++
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
