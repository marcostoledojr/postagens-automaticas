/**
 * POST /api/posts/avulso
 * Gera um post avulso com tema/contexto customizado e salva como pendente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarTema } from '@/lib/busca-web'
import { gerarTextoPost } from '@/lib/gerar-texto'
import { gerarImagem } from '@/lib/gerar-imagem'
import { setHours, setMinutes, setSeconds } from 'date-fns'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      titulo,           // string — nome/tema do post
      contexto,         // string — briefing adicional
      url,              // string? — URL para buscar mais info
      tipo,             // 'comercial' | 'autoridade' | 'auto'
      data,             // string — data ISO ou 'YYYY-MM-DD'
      horario,          // string — 'HH:MM'
    } = body

    if (!titulo || !data || !horario) {
      return NextResponse.json({ erro: 'titulo, data e horario são obrigatórios' }, { status: 400 })
    }

    const supabase = createClient()

    // Configs gerais
    const { data: configs } = await supabase.from('configuracoes').select('chave, valor')
    const configMap = Object.fromEntries((configs ?? []).map((c: any) => [c.chave, c.valor]))
    const instrucaoBase: string = configMap['instrucoes_gerais'] ?? ''

    // Monta um "tema virtual" a partir dos dados do formulário
    const tipoFinal: 'comercial' | 'autoridade' = tipo === 'autoridade' ? 'autoridade'
      : tipo === 'comercial' ? 'comercial'
      : titulo.toLowerCase().match(/totvs|protheus|erp|oficina|comercial|implant|customiz|migra|fiscal|financeiro/)
        ? 'comercial' : 'autoridade'

    const temaVirtual = {
      id: null,
      nome: titulo,
      objetivo: contexto || `Post sobre: ${titulo}`,
      tom: tipoFinal === 'comercial' ? 'consultivo e direto' : 'reflexivo e provocador',
      mencoes: tipoFinal === 'comercial' ? ['@Oficina1'] : [],
      hashtags: [],
      cta: tipoFinal === 'comercial' ? 'Me manda uma DM' : null,
    }

    // Busca fontes: usa URL fornecida + busca web padrão
    let fontes: any[] = []
    try {
      const fontesWeb = await buscarTema(titulo, temaVirtual.objetivo)
      fontes = fontesWeb

      // Se forneceu URL, adiciona como fonte extra
      if (url && url.trim()) {
        fontes = [{ titulo: 'Referência fornecida', url: url.trim(), resumo: `URL: ${url.trim()}` }, ...fontes]
      }
    } catch {
      if (url) {
        fontes = [{ titulo: 'Referência fornecida', url: url.trim(), resumo: `URL: ${url.trim()}` }]
      }
    }

    // Anti-repetição: busca posts com mesmo tema nos últimos 30 dias (por nome)
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { data: postsRecentes } = await supabase
      .from('posts').select('texto')
      .ilike('tema_nome', `%${titulo.substring(0, 15)}%`)
      .gte('created_at', trintaDiasAtras.toISOString())
      .in('status', ['pendente', 'aprovado', 'agendado', 'publicado'])
      .order('created_at', { ascending: false }).limit(10)
    const angulosRecentes = (postsRecentes ?? [])
      .map((p: any) => p.texto?.split('\n').find((l: string) => l.trim().length > 0)?.trim())
      .filter(Boolean) as string[]

    // Injeta o contexto do usuário como instrução adicional
    const instrucaoCompleta = [instrucaoBase, contexto ? `BRIEFING ADICIONAL DO AUTOR: ${contexto}` : ''].filter(Boolean).join('\n\n')

    // Gera texto
    const postGerado = await gerarTextoPost(temaVirtual, fontes, instrucaoCompleta, [], angulosRecentes)

    // Gera imagem
    const imagem = await gerarImagem(titulo, temaVirtual.objetivo, postGerado.texto, tipoFinal)

    // Monta data de publicação convertendo BRT → UTC (+3h)
    // Vercel roda em UTC: setHours(dia, hh) guardaria 09:00 UTC = 06:00 BRT (ERRADO)
    // Com +3: setHours(dia, hh + 3) guarda 12:00 UTC = 09:00 BRT (CORRETO)
    const [hh, mm] = horario.split(':').map(Number)
    const [ano, mes, dia] = data.split('-').map(Number)
    const dataBase = new Date(ano, mes - 1, dia)  // local midnight
    const dataPublicacao = setSeconds(setMinutes(setHours(dataBase, hh + 3), mm), 0)

    // Salva como pendente
    const { data: postSalvo, error } = await supabase.from('posts').insert({
      tema_nome: titulo,
      texto: postGerado.texto,
      imagem_url: imagem.url,
      imagem_prompt: imagem.prompt,
      hashtags: postGerado.hashtags,
      fontes_pesquisa: fontes,
      status: 'pendente',
      data_agendada: dataPublicacao.toISOString(),
      horario_publicacao: horario,
    }).select().single()

    if (error) throw new Error(`Erro ao salvar: ${error.message}`)

    return NextResponse.json({
      ok: true,
      post: {
        id: postSalvo.id,
        texto: postGerado.texto,
        hashtags: postGerado.hashtags,
        imagem_url: imagem.url,
        tipo: tipoFinal,
        data_agendada: dataPublicacao.toISOString(),
      },
    })

  } catch (err: any) {
    console.error('[AVULSO] Erro:', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
