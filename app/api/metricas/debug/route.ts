/**
 * GET /api/metricas/debug
 * Diagnóstico da API LinkedIn Analytics — retorna resposta bruta para análise.
 * Pega o post publicado mais recente com linkedin_post_id real e testa a coleta.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const testarId = searchParams.get('id') // permite testar URN específico
  const supabase = createClient()

  // Busca tokens do banco
  const { data: configs } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', [
      'linkedin_access_token', 'linkedin_analytics_token',
      'linkedin_person_urn', 'linkedin_analytics_token_expiry',
    ])

  const map = Object.fromEntries((configs ?? []).map((r: any) => [r.chave, r.valor]))
  const publishToken = map['linkedin_access_token']
  const analyticsToken = map['linkedin_analytics_token']
  const personUrn = map['linkedin_person_urn']
  const analyticsExpiry = map['linkedin_analytics_token_expiry']

  // Busca todos os posts publicados com linkedin_post_id para diagnóstico
  const { data: posts } = await supabase
    .from('posts')
    .select('id, linkedin_post_id, publicado_em, tema_nome')
    .eq('status', 'publicado')
    .not('linkedin_post_id', 'is', null)
    .order('publicado_em', { ascending: false })
    .limit(5)

  const postsInfo = (posts ?? []).map(p => ({
    id: p.id,
    linkedin_post_id: p.linkedin_post_id,
    tema_nome: p.tema_nome,
    publicado_em: p.publicado_em,
    id_tipo: p.linkedin_post_id?.startsWith('make_') ? 'FAKE_MAKE'
      : p.linkedin_post_id?.includes('ugcPost') ? 'ugcPost'
      : p.linkedin_post_id?.includes('share') ? 'share'
      : 'desconhecido',
  }))

  // Se passou ?id=urn:li:share:... usa esse; senão pega o primeiro com ID real
  const postParaTeste = testarId
    ? { id: 'manual', linkedin_post_id: testarId, tema_nome: 'teste manual', publicado_em: null }
    : (posts ?? []).find(p => p.linkedin_post_id && !p.linkedin_post_id.startsWith('make_'))

  if (!postParaTeste) {
    return NextResponse.json({
      erro: 'Nenhum post com LinkedIn ID real encontrado',
      tokens: {
        publishToken: publishToken ? `${publishToken.slice(0, 20)}...` : null,
        analyticsToken: analyticsToken ? `${analyticsToken.slice(0, 20)}...` : null,
        analyticsExpiry,
        personUrn,
      },
      posts: postsInfo,
    })
  }

  const activeToken = analyticsToken ?? publishToken
  const headers: HeadersInit = {
    Authorization: `Bearer ${activeToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': '202506',
  }

  const linkedinPostId = postParaTeste.linkedin_post_id
  const resultados: Record<string, any> = {}

  // Testa entityParam com ugcPost
  let entityParam: string
  if (linkedinPostId.includes('ugcPost')) {
    const id = linkedinPostId.replace('urn:li:ugcPost:', '')
    entityParam = `(ugc:urn%3Ali%3AugcPost%3A${id})`
  } else {
    const id = linkedinPostId.replace('urn:li:share:', '')
    entityParam = `(share:urn%3Ali%3Ashare%3A${id})`
  }

  // Testa IMPRESSION com aggregation=TOTAL
  const url1 = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam}&queryType=IMPRESSION&aggregation=TOTAL`
  const r1 = await fetch(url1, { headers })
  const raw1 = await r1.text()
  resultados['IMPRESSION_TOTAL'] = {
    status: r1.status,
    ok: r1.ok,
    raw: raw1.slice(0, 800),
    parsed: r1.ok ? JSON.parse(raw1) : null,
  }

  // Se share retornou 404, testa ugcPost com mesmo ID numérico
  if (!r1.ok && r1.status === 404 && linkedinPostId.includes('urn:li:share:')) {
    const numericId = linkedinPostId.replace('urn:li:share:', '')
    const ugcEntity = `(ugc:urn%3Ali%3AugcPost%3A${numericId})`
    const urlUgc = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${ugcEntity}&queryType=IMPRESSION&aggregation=TOTAL`
    const rUgc = await fetch(urlUgc, { headers })
    const rawUgc = await rUgc.text()
    resultados['IMPRESSION_COMO_UGCPOST'] = {
      status: rUgc.status,
      ok: rUgc.ok,
      ugcUrn: `urn:li:ugcPost:${numericId}`,
      raw: rawUgc.slice(0, 800),
      parsed: rUgc.ok ? JSON.parse(rawUgc) : null,
      conclusao: rUgc.ok ? '✅ ugcPost funciona — URN salvo está errado (share→ugcPost)' : '❌ ugcPost também falhou — URN inválido ou post não encontrado',
    }
  }

  // Testa REACTION (curtidas)
  const url2 = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam}&queryType=REACTION&aggregation=TOTAL`
  const r2 = await fetch(url2, { headers })
  const raw2 = await r2.text()
  resultados['REACTION_TOTAL'] = {
    status: r2.status,
    ok: r2.ok,
    count: r2.ok ? (JSON.parse(raw2).elements?.[0]?.count ?? 'sem elements') : null,
    raw: raw2.slice(0, 400),
  }

  // Testa COMMENT (comentários)
  const urlComment = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam}&queryType=COMMENT&aggregation=TOTAL`
  const rComment = await fetch(urlComment, { headers })
  const rawComment = await rComment.text()
  resultados['COMMENT_TOTAL'] = {
    status: rComment.status,
    ok: rComment.ok,
    count: rComment.ok ? (JSON.parse(rawComment).elements?.[0]?.count ?? 'sem elements') : null,
    raw: rawComment.slice(0, 400),
  }

  // PONTO CRÍTICO — Testa RESHARE (compartilhamentos)
  const urlReshare = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam}&queryType=RESHARE&aggregation=TOTAL`
  const rReshare = await fetch(urlReshare, { headers })
  const rawReshare = await rReshare.text()
  resultados['RESHARE_TOTAL'] = {
    status: rReshare.status,
    ok: rReshare.ok,
    count: rReshare.ok ? (JSON.parse(rawReshare).elements?.[0]?.count ?? 'sem elements') : null,
    raw: rawReshare.slice(0, 400),
    diagnostico: !rReshare.ok ? '❌ RESHARE não suportado neste tier/token' : '✅ RESHARE OK',
  }

  // Testa LINK_CLICKS (cliques)
  const urlClicks = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam}&queryType=LINK_CLICKS&aggregation=TOTAL`
  const rClicks = await fetch(urlClicks, { headers })
  const rawClicks = await rClicks.text()
  resultados['LINK_CLICKS_TOTAL'] = {
    status: rClicks.status,
    ok: rClicks.ok,
    count: rClicks.ok ? (JSON.parse(rawClicks).elements?.[0]?.count ?? 'sem elements') : null,
    raw: rawClicks.slice(0, 400),
    diagnostico: !rClicks.ok ? '❌ LINK_CLICKS não suportado neste tier/token' : '✅ LINK_CLICKS OK',
  }

  // Testa com token de PUBLICAÇÃO (não analytics) — comparação
  if (publishToken && publishToken !== activeToken) {
    const headersPublish: HeadersInit = {
      Authorization: `Bearer ${publishToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202506',
    }
    const url4 = `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entityParam}&queryType=IMPRESSION&aggregation=TOTAL`
    const r4 = await fetch(url4, { headers: headersPublish })
    const raw4 = await r4.text()
    resultados['IMPRESSION_COM_TOKEN_PUBLICACAO'] = {
      status: r4.status,
      ok: r4.ok,
      raw: raw4.slice(0, 400),
    }
  }

  return NextResponse.json({
    postTestado: {
      id: postParaTeste.id,
      linkedin_post_id: linkedinPostId,
      tema_nome: postParaTeste.tema_nome,
      publicado_em: postParaTeste.publicado_em,
      entityParam,
    },
    tokens: {
      publishToken: publishToken ? `${publishToken.slice(0, 20)}...` : null,
      analyticsToken: analyticsToken ? `${analyticsToken.slice(0, 20)}...` : null,
      analyticsExpiry,
      personUrn,
      usandoToken: analyticsToken ? 'analytics' : 'publicacao',
    },
    todosPostsRecentes: postsInfo,
    resultados,
  })
}
