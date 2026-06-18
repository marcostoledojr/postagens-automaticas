/**
 * POST /api/metricas/importar-excel
 * Processa o arquivo Excel exportado pelo LinkedIn ("Análise da publicação").
 * Extrai URL do post, métricas e salva no banco.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

function extrairUrnDaUrl(url: string): string | null {
  // /posts/user_titulo-share-ID-XXXX/
  const matchShare = url.match(/[-_]share[-_](\d{10,})/i)
  if (matchShare) return `urn:li:share:${matchShare[1]}`
  // /feed/update/urn:li:share:ID
  const matchUrn = url.match(/urn:li:(share|ugcPost|activity):\d+/)
  if (matchUrn) return matchUrn[0]
  // /posts/user_titulo-activity-ID-XXXX/
  const matchActivity = url.match(/activity[-_](\d{10,})[-_]/i)
  if (matchActivity) return `urn:li:share:${matchActivity[1]}`
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { arquivo, nome } = await req.json()
    if (!arquivo) return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    // Decodifica base64 → buffer
    const buffer = Buffer.from(arquivo, 'base64')
    const wb = XLSX.read(buffer, { type: 'buffer' })

    // Lê a primeira aba
    const sheetName = wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

    // Extrai URL (primeira linha, segunda coluna)
    let linkedinUrl = ''
    let publicado_em: string | null = null
    let impressoes = 0, curtidas = 0, comentarios = 0, compartilhamentos = 0, cliques = 0

    for (const row of rows) {
      if (!row || row.length < 2) continue
      const chave = String(row[0] ?? '').trim().toLowerCase()
      const valor = row[1]

      // URL da publicação — pode estar no cabeçalho (row[0]) ou nas chaves
      if (chave === '' && typeof valor === 'string' && valor.includes('linkedin.com/posts')) {
        linkedinUrl = valor
      }
      if (typeof row[0] === 'string' && row[0].includes('linkedin.com/posts')) {
        linkedinUrl = row[0]
      }
      // Também checa na primeira coluna como URL
      if (chave.includes('url') && typeof valor === 'string') linkedinUrl = valor

      if (chave.includes('data da publicação') || chave.includes('data de publicação')) publicado_em = String(valor ?? '')
      if (chave === 'impressões') impressoes = Number(valor) || 0
      if (chave === 'reações' && curtidas === 0) curtidas = Number(valor) || 0
      if (chave === 'comentários') comentarios = Number(valor) || 0
      if (chave === 'compartilhamentos') compartilhamentos = Number(valor) || 0
      if (chave.includes('clique')) cliques = Number(valor) || 0
    }

    // Tenta encontrar URL nas chaves (o LinkedIn coloca a URL como header)
    if (!linkedinUrl) {
      // Procura em todas as células pela URL
      for (const row of rows) {
        for (const cell of (row ?? [])) {
          if (typeof cell === 'string' && cell.includes('linkedin.com/posts')) {
            linkedinUrl = cell
            break
          }
        }
        if (linkedinUrl) break
      }
    }

    if (!linkedinUrl) {
      return NextResponse.json({ erro: 'URL do post não encontrada no arquivo. Certifique-se de exportar o arquivo correto do LinkedIn.' }, { status: 400 })
    }

    const urn = extrairUrnDaUrl(linkedinUrl)
    if (!urn) {
      return NextResponse.json({ erro: `Não foi possível extrair o ID do LinkedIn da URL: ${linkedinUrl}` }, { status: 400 })
    }

    const supabase = createClient()
    let postId: string | null = null

    // Busca por URN
    const { data: porUrn } = await supabase
      .from('posts')
      .select('id')
      .eq('linkedin_post_id', urn)
      .maybeSingle()

    if (porUrn) {
      postId = porUrn.id
    } else {
      // Busca por posts com make_ ID e tenta match por data (±3h)
      if (publicado_em) {
        const dataPub = parseDateBR(publicado_em)
        if (dataPub) {
          const inicio = new Date(dataPub.getTime() - 3 * 60 * 60 * 1000).toISOString()
          const fim = new Date(dataPub.getTime() + 3 * 60 * 60 * 1000).toISOString()
          const { data: porData } = await supabase
            .from('posts')
            .select('id')
            .eq('status', 'publicado')
            .gte('publicado_em', inicio)
            .lte('publicado_em', fim)
            .maybeSingle()
          if (porData) {
            postId = porData.id
            await supabase.from('posts').update({ linkedin_post_id: urn }).eq('id', postId)
          }
        }
      }

      // Se ainda não achou, pega qualquer post com make_ ID recente
      if (!postId) {
        const { data: recente } = await supabase
          .from('posts')
          .select('id')
          .eq('status', 'publicado')
          .like('linkedin_post_id', 'make_%')
          .order('publicado_em', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (recente) {
          postId = recente.id
          await supabase.from('posts').update({ linkedin_post_id: urn }).eq('id', postId)
        }
      }
    }

    if (!postId) {
      return NextResponse.json({
        erro: 'Post não encontrado no banco. Use o painel "Recuperar Métricas" para associar manualmente.',
        urn,
      }, { status: 404 })
    }

    const score = impressoes > 0
      ? parseFloat(((curtidas + comentarios * 3 + compartilhamentos * 5 + cliques * 0.5) / impressoes * 100).toFixed(4))
      : curtidas + comentarios * 3 + compartilhamentos * 5

    const payload = { impressoes, curtidas, comentarios, compartilhamentos, cliques, score_engajamento: score, coletado_em: new Date().toISOString() }

    const { data: existente } = await supabase.from('metricas').select('id').eq('post_id', postId).maybeSingle()
    if (existente) {
      await supabase.from('metricas').update(payload).eq('post_id', postId)
    } else {
      await supabase.from('metricas').insert({ post_id: postId, ...payload })
    }

    return NextResponse.json({ ok: true, urn, postId, impressoes, curtidas, comentarios, compartilhamentos, score })
  } catch (err: any) {
    console.error('[Importar Excel] Erro:', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

function parseDateBR(s: string): Date | null {
  // Formato dd/MM/yyyy
  const match = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00Z`)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
