/**
 * Motor principal de geração de posts
 * Orquestra: busca na web → geração de texto → geração de imagem → salva no banco
 *
 * AGENDA FIXA:
 *   09:00 Seg/Qua/Sex → Comercial Oficina1
 *   09:00 Ter/Qui     → Autoridade Oficina1
 *   14:00 Seg/Qua/Sex → Fatos Relevantes TOTVS Protheus
 *   14:00 Ter/Qui     → Inteligência Artificial
 *   Sábado 09:00      → Resumo da semana
 */

import { createClient } from './supabase-server'
import { buscarTema } from './busca-web'
import { gerarTextoPost } from './gerar-texto'
import { gerarImagem } from './gerar-imagem'
import { addDays, setHours, setMinutes, setSeconds, format } from 'date-fns'

type ConfigGeracao = {
  diasAFrente?: number
  forcarRegeneracao?: boolean
}

// ─── Mapeamento fixo de slots ────────────────────────────────────────────────

const SLOT_MANHA = '09:00'
const SLOT_TARDE = '14:00'

/**
 * Dada uma lista de temas e um dia da semana, retorna qual tema vai em cada slot.
 * Dias ímpares (Seg=1, Qua=3, Sex=5): Comercial + Fatos
 * Dias pares  (Ter=2, Qui=4):         Autoridade + IA
 */
function resolverTemasDodia(temas: any[], diaSemana: number): {
  manha: any | null
  tarde: any | null
} {
  const encontrar = (keywords: string[]) =>
    temas.find(t => keywords.some(k => t.nome.toLowerCase().includes(k.toLowerCase()))) ?? null

  if (diaSemana % 2 === 1) {
    // Seg, Qua, Sex
    return {
      manha: encontrar(['comercial']),
      tarde: encontrar(['fatos', 'relevantes', 'protheus']),
    }
  } else {
    // Ter, Qui
    return {
      manha: encontrar(['autoridade']),
      tarde: encontrar(['inteligência artificial', 'inteligencia artificial', ' ia']),
    }
  }
}

// ─── Geração de posts para amanhã (cron diário 09h) ─────────────────────────

export async function gerarPostsParaAmanha(config: ConfigGeracao = {}): Promise<{
  gerados: number
  erros: number
  detalhes: any[]
}> {
  const supabase = createClient()
  const diasAFrente = config.diasAFrente ?? 1
  const detalhes: any[] = []
  let gerados = 0
  let erros = 0

  const { data: configs } = await supabase.from('configuracoes').select('chave, valor')
  const configMap = Object.fromEntries((configs ?? []).map(c => [c.chave, c.valor]))
  const instrucaoBase: string = configMap['instrucoes_gerais'] ?? ''

  const { data: temas } = await supabase
    .from('temas').select('*').eq('ativo', true).order('nome')

  if (!temas || temas.length === 0) {
    return { gerados: 0, erros: 0, detalhes: [{ erro: 'Nenhum tema ativo encontrado' }] }
  }

  const { data: topPosts } = await supabase
    .from('metricas')
    .select('post_id, score_engajamento, posts(texto, tema_id)')
    .order('score_engajamento', { ascending: false })
    .limit(6)

  const exemplosPorTema: Record<string, any[]> = {}
  for (const m of topPosts ?? []) {
    const post = (m as any).posts
    if (post) {
      const temaId = post.tema_id
      if (!exemplosPorTema[temaId]) exemplosPorTema[temaId] = []
      exemplosPorTema[temaId].push({ texto: post.texto, score: m.score_engajamento })
    }
  }

  for (let d = 1; d <= diasAFrente; d++) {
    const dia = addDays(new Date(), d)
    const diaSemana = dia.getDay()

    // Pula domingos (0) — sábado (6) é tratado por gerarResumoSemanal
    if (diaSemana === 0 || diaSemana === 6) continue

    const { manha, tarde } = resolverTemasDodia(temas, diaSemana)
    const slots = [
      { horario: SLOT_MANHA, tema: manha },
      { horario: SLOT_TARDE, tema: tarde },
    ].filter(s => s.tema !== null)

    for (const slot of slots) {
      const tema = slot.tema!
      const [hh, mm] = slot.horario.split(':').map(Number)
      const dataSlot = setSeconds(setMinutes(setHours(dia, hh), mm), 0)

      // Verifica se já existe post aprovado/publicado para este slot
      const { data: existente } = await supabase
        .from('posts').select('id')
        .eq('data_agendada', dataSlot.toISOString())
        .in('status', ['aprovado', 'agendado', 'publicado'])
        .maybeSingle()

      if (existente && !config.forcarRegeneracao) continue

      try {
        console.log(`Gerando ${format(dataSlot, 'dd/MM HH:mm')} — ${tema.nome}`)

        const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const { data: postsDoMes } = await supabase
          .from('posts').select('texto').eq('tema_id', tema.id)
          .gte('created_at', trintaDiasAtras.toISOString())
          .in('status', ['pendente', 'aprovado', 'agendado', 'publicado'])
          .order('created_at', { ascending: false }).limit(20)
        const angulosRecentes = (postsDoMes ?? [])
          .map((p: any) => p.texto?.split('\n').find((l: string) => l.trim().length > 0)?.trim())
          .filter(Boolean) as string[]

        const fontes = await buscarTema(tema.nome, tema.objetivo)
        const exemplos = exemplosPorTema[tema.id] ?? []
        const postGerado = await gerarTextoPost(tema, fontes, instrucaoBase, exemplos, angulosRecentes)
        const imagem = await gerarImagem(tema.nome, tema.objetivo, postGerado.texto, postGerado.tipoPost)

        const { error } = await supabase.from('posts').insert({
          tema_id: tema.id,
          tema_nome: tema.nome,
          texto: postGerado.texto,
          imagem_url: imagem.url,
          imagem_prompt: imagem.prompt,
          hashtags: postGerado.hashtags,
          fontes_pesquisa: fontes,
          status: 'pendente',
          data_agendada: dataSlot.toISOString(),
          horario_publicacao: slot.horario,
        })

        if (error) throw error
        gerados++
        detalhes.push({ tema: tema.nome, data: format(dataSlot, 'dd/MM HH:mm'), status: 'ok' })
        await sleep(1500)
      } catch (err: any) {
        erros++
        detalhes.push({ tema: tema.nome, data: format(dataSlot, 'dd/MM HH:mm'), status: 'erro', erro: err.message })
        console.error(`Erro ao gerar post para ${tema.nome}:`, err)
      }
    }
  }

  await supabase.from('logs_geracao').insert({
    posts_gerados: gerados,
    posts_com_erro: erros,
    detalhes,
    status: erros === 0 ? 'sucesso' : gerados > 0 ? 'parcial' : 'erro',
  })

  return { gerados, erros, detalhes }
}

// ─── Geração de 1 post por tema (Zerar e Gerar manual) ──────────────────────

export async function gerarUmPorTema(): Promise<{
  gerados: number
  erros: number
  detalhes: any[]
}> {
  const supabase = createClient()
  const detalhes: any[] = []
  let gerados = 0
  let erros = 0

  const { data: temas } = await supabase
    .from('temas').select('*').eq('ativo', true).order('nome')

  if (!temas || temas.length === 0) {
    return { gerados: 0, erros: 0, detalhes: [{ erro: 'Nenhum tema ativo' }] }
  }

  const { data: configs } = await supabase.from('configuracoes').select('chave, valor')
  const configMap = Object.fromEntries((configs ?? []).map(c => [c.chave, c.valor]))
  const instrucaoBase: string = configMap['instrucoes_gerais'] ?? ''

  const amanha = addDays(new Date(), 1)
  const horarios = ['09:00', '11:00', '13:00', '15:00', '17:00']

  for (let i = 0; i < temas.length; i++) {
    const tema = temas[i]
    const horario = horarios[i % horarios.length]
    const [hh, mm] = horario.split(':').map(Number)
    const dataSlot = setSeconds(setMinutes(setHours(amanha, hh), mm), 0)

    try {
      console.log(`[gerarUmPorTema] Tema: ${tema.nome}`)
      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const { data: postsDoMes } = await supabase
        .from('posts').select('texto').eq('tema_id', tema.id)
        .gte('created_at', trintaDiasAtras.toISOString())
        .in('status', ['pendente', 'aprovado', 'agendado', 'publicado'])
        .order('created_at', { ascending: false }).limit(20)
      const angulosRecentes = (postsDoMes ?? [])
        .map((p: any) => p.texto?.split('\n').find((l: string) => l.trim().length > 0)?.trim())
        .filter(Boolean) as string[]

      const fontes = await buscarTema(tema.nome, tema.objetivo)
      const postGerado = await gerarTextoPost(tema, fontes, instrucaoBase, [], angulosRecentes)
      const imagem = await gerarImagem(tema.nome, tema.objetivo, postGerado.texto, postGerado.tipoPost)

      const { error } = await supabase.from('posts').insert({
        tema_id: tema.id,
        tema_nome: tema.nome,
        texto: postGerado.texto,
        imagem_url: imagem.url,
        imagem_prompt: imagem.prompt,
        hashtags: postGerado.hashtags,
        fontes_pesquisa: fontes,
        status: 'pendente',
        data_agendada: dataSlot.toISOString(),
        horario_publicacao: horario,
      })

      if (error) throw error
      gerados++
      detalhes.push({ tema: tema.nome, horario, status: 'ok' })
      await sleep(2000)
    } catch (err: any) {
      erros++
      detalhes.push({ tema: tema.nome, horario, status: 'erro', erro: err.message })
      console.error(`[gerarUmPorTema] Erro ${tema.nome}:`, err)
    }
  }

  return { gerados, erros, detalhes }
}

// ─── Resumo semanal (Sábado) ─────────────────────────────────────────────────

export async function gerarResumoSemanal(): Promise<{
  gerado: boolean
  erro?: string
}> {
  const supabase = createClient()

  // Busca posts publicados de segunda a sexta desta semana
  const hoje = new Date()
  const diaSemana = hoje.getDay() // 6 = sábado
  const segundaFeira = new Date(hoje)
  segundaFeira.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
  segundaFeira.setHours(0, 0, 0, 0)

  const sexta = new Date(segundaFeira)
  sexta.setDate(segundaFeira.getDate() + 4)
  sexta.setHours(23, 59, 59, 999)

  const { data: postsDaSemana } = await supabase
    .from('posts')
    .select('texto, tema_nome, data_agendada')
    .in('status', ['publicado', 'aprovado', 'agendado'])
    .gte('data_agendada', segundaFeira.toISOString())
    .lte('data_agendada', sexta.toISOString())
    .order('data_agendada', { ascending: true })

  if (!postsDaSemana || postsDaSemana.length === 0) {
    return { gerado: false, erro: 'Nenhum post publicado na semana para resumir' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { gerado: false, erro: 'ANTHROPIC_API_KEY não configurada' }

  // Monta contexto dos posts da semana
  const contexto = postsDaSemana
    .map(p => {
      const data = new Date(p.data_agendada)
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const dia = diasSemana[data.getDay()]
      const primeiraLinha = p.texto.split('\n').find((l: string) => l.trim())?.trim() ?? ''
      return `${dia}: [${p.tema_nome}] "${primeiraLinha}"`
    })
    .join('\n')

  const promptSistema = `Você é Marcos Toledo Jr, Head Comercial da Oficina1. Você escreve posts no LinkedIn na sua própria voz — direta, consultiva, sem exageros.

REGRAS ABSOLUTAS:
- ZERO emojis
- ZERO bullets ou listas
- ZERO negrito ou asteriscos (**texto**)
- ZERO "a gente"
- Tamanho: 150-200 palavras
- Não inclua assinatura`

  const promptUsuario = `Escreva um post de "resumo da semana" para o LinkedIn.

Esta semana você publicou sobre esses temas:
${contexto}

Objetivo: fazer um balanço natural e humano do que foi discutido, convidar o leitor que perdeu algum conteúdo a voltar e rever, sem listar mecanicamente. Deve soar como uma reflexão genuína de fim de semana, não como um índice.

LEMBRETES:
- Gancho forte na primeira linha (máximo 12 palavras)
- Tom reflexivo, pessoal
- Pode mencionar Oficina1 brevemente uma vez, naturalmente
- Hashtags na última linha: #LinkedIn #Semana #TOTVS #Protheus #IA (4-6 hashtags)`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: promptSistema,
        messages: [{ role: 'user', content: promptUsuario }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic API: ${res.status}`)

    const data = await res.json()
    const textoCompleto = data.content[0].text as string

    // Separa texto e hashtags
    const linhas = textoCompleto.trim().split('\n')
    let textoLimpo = textoCompleto.trim()
    const hashtagsEncontradas: string[] = []

    for (let i = linhas.length - 1; i >= Math.max(0, linhas.length - 4); i--) {
      const linha = linhas[i].trim()
      if (linha === '') continue
      if (linha.includes('#')) {
        const tags = (linha.match(/#\S+/g) ?? []).map(h => h.replace(/[.,!?;:'"]+$/, ''))
        hashtagsEncontradas.unshift(...tags)
      } else break
    }

    if (hashtagsEncontradas.length > 0) {
      const idxPrimeira = linhas.findIndex(l => l.includes('#'))
      if (idxPrimeira >= 0) {
        textoLimpo = linhas.slice(0, idxPrimeira).join('\n').trim()
      }
    }

    // Agenda para o próximo sábado às 10:00 BRT (13:00 UTC)
    // Quando chamado na sexta, addDays(hoje, 1) = sábado
    // Quando chamado no sábado (fallback), addDays(hoje, 0) = hoje
    const agora = new Date()
    const diasAteSabado = agora.getDay() === 6 ? 0 : 1 // sexta(5)+1=sáb, sáb(6)+0=hoje
    let dataPublicacao = addDays(agora, diasAteSabado)
    dataPublicacao.setUTCHours(13, 0, 0, 0) // 13h UTC = 10h BRT

    const { error } = await supabase.from('posts').insert({
      tema_nome: 'Resumo da Semana',
      texto: textoLimpo,
      imagem_url: null,
      imagem_prompt: null,
      hashtags: hashtagsEncontradas.slice(0, 6),
      fontes_pesquisa: [],
      status: 'pendente',
      data_agendada: dataPublicacao.toISOString(),
      horario_publicacao: '10:00',
    })

    if (error) throw error

    console.log('[RESUMO] Resumo semanal gerado com sucesso')
    return { gerado: true }

  } catch (err: any) {
    console.error('[RESUMO] Erro:', err)
    return { gerado: false, erro: err.message }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
