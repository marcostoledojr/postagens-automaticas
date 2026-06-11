/**
 * Motor principal de geração de posts
 * Orquestra: busca na web → geração de texto → geração de imagem → salva no banco
 */

import { createClient } from './supabase-server'
import { buscarTema } from './busca-web'
import { gerarTextoPost } from './gerar-texto'
import { gerarImagem } from './gerar-imagem'
import { addDays, setHours, setMinutes, setSeconds, format } from 'date-fns'

type ConfigGeracao = {
  diasAFrente?: number      // quantos dias à frente gerar (padrão: 1)
  forcarRegeneracao?: boolean
}

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

  // Busca configurações gerais
  const { data: configs } = await supabase
    .from('configuracoes')
    .select('chave, valor')

  const configMap = Object.fromEntries(
    (configs ?? []).map(c => [c.chave, c.valor])
  )

  const horarios: string[] = configMap['horarios_publicacao'] ?? ['09:00', '14:00']
  const diasAtivos: number[] = configMap['dias_semana_ativos'] ?? [1,2,3,4,5]
  const instrucaoBase: string = configMap['instrucoes_gerais'] ?? ''

  // Busca temas ativos com sua frequência
  const { data: temas } = await supabase
    .from('temas')
    .select('*')
    .eq('ativo', true)
    .order('frequencia_semanal', { ascending: false })

  if (!temas || temas.length === 0) {
    return { gerados: 0, erros: 0, detalhes: [{ erro: 'Nenhum tema ativo encontrado' }] }
  }

  // Busca exemplos de alto desempenho para o aprendizado da IA
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

  // Calcula quais dias e horários precisam de posts
  const slotsParaGerar: Array<{ data: Date; horario: string; temaIndex: number }> = []

  for (let d = 1; d <= diasAFrente; d++) {
    const dia = addDays(new Date(), d)
    const diaSemana = dia.getDay() // 0=Dom, 1=Seg...

    if (!diasAtivos.includes(diaSemana)) continue

    for (const horario of horarios) {
      // Verifica se já existe post aprovado/publicado para este slot
      const [hh, mm] = horario.split(':').map(Number)
      const dataSlot = setSeconds(setMinutes(setHours(dia, hh), mm), 0)

      const { data: existente } = await supabase
        .from('posts')
        .select('id')
        .eq('data_agendada', dataSlot.toISOString())
        .in('status', ['aprovado', 'agendado', 'publicado'])
        .maybeSingle()

      if (existente && !config.forcarRegeneracao) continue

      // Escolhe o tema (rotação baseada em frequência)
      const temaIndex = calcularTemaParaSlot(temas, d, horario)
      slotsParaGerar.push({ data: dataSlot, horario, temaIndex })
    }
  }

  // Gera os posts para cada slot
  for (const slot of slotsParaGerar) {
    const tema = temas[slot.temaIndex % temas.length]
    try {
      console.log(`Gerando post para ${format(slot.data, 'dd/MM HH:mm')} - Tema: ${tema.nome}`)

      // 1. Busca informações relevantes na web
      const fontes = await buscarTema(tema.nome, tema.objetivo)

      // 2. Gera o texto com Claude Haiku
      const exemplos = exemplosPorTema[tema.id] ?? []
      const postGerado = await gerarTextoPost(tema, fontes, instrucaoBase, exemplos)

      // 3. Gera a imagem
      const imagem = await gerarImagem(tema.nome, tema.objetivo, postGerado.texto, postGerado.tipoPost)

      // 4. Salva no banco como pendente
      const { error } = await supabase.from('posts').insert({
        tema_id: tema.id,
        tema_nome: tema.nome,
        texto: postGerado.texto,
        imagem_url: imagem.url,
        imagem_prompt: imagem.prompt,
        hashtags: postGerado.hashtags,
        fontes_pesquisa: fontes,
        status: 'pendente',
        data_agendada: slot.data.toISOString(),
        horario_publicacao: slot.horario,
      })

      if (error) throw error

      gerados++
      detalhes.push({ tema: tema.nome, data: format(slot.data, 'dd/MM HH:mm'), status: 'ok' })

      // Pausa entre gerações para não sobrecarregar as APIs
      await sleep(1500)
    } catch (err: any) {
      erros++
      detalhes.push({
        tema: tema.nome,
        data: format(slot.data, 'dd/MM HH:mm'),
        status: 'erro',
        erro: err.message,
      })
      console.error(`Erro ao gerar post para ${tema.nome}:`, err)
    }
  }

  // Registra no log
  await supabase.from('logs_geracao').insert({
    posts_gerados: gerados,
    posts_com_erro: erros,
    detalhes,
    status: erros === 0 ? 'sucesso' : gerados > 0 ? 'parcial' : 'erro',
  })

  return { gerados, erros, detalhes }
}

/**
 * Escolhe qual tema usar para um dado slot
 * Respeita a frequência configurada de cada tema
 */
function calcularTemaParaSlot(temas: any[], dia: number, horario: string): number {
  // Monta um array expandido respeitando as frequências
  const pool: number[] = []
  for (let i = 0; i < temas.length; i++) {
    const freq = temas[i].frequencia_semanal ?? 2
    for (let j = 0; j < freq; j++) pool.push(i)
  }

  // Usa o dia + horário como seed para distribuição determinística
  const seed = dia * 10 + (horario === '09:00' ? 0 : 1)
  return pool[seed % pool.length]
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
