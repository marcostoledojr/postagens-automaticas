/**
 * Endpoint do Cron Job - executado automaticamente pelo Vercel Cron
 * Configurado no vercel.json para rodar às 9h (horário de Brasília = 12:00 UTC)
 *
 * Responsabilidades:
 * 1. Gerar posts para o dia seguinte (às 9h)
 * 2. Publicar posts aprovados que estão no horário (às 9h e 14h)
 * 3. Coletar métricas de posts publicados recentemente
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { gerarPostsParaAmanha, gerarResumoSemanal } from '@/lib/motor-geracao'
import { publicarPostLinkedIn } from '@/lib/linkedin'
import { coletarMetricas } from '@/lib/metricas'

export async function GET(req: NextRequest) {
  // Verifica autenticação do cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const hora = agora.getHours() // UTC
  const diaSemana = agora.getDay() // UTC — no horário 12h UTC (9h BRT) o dia já é o correto
  // Brasília = UTC-3, então:
  // 9h Brasília  = 12h UTC
  // 14h Brasília = 17h UTC
  // Sábado 9h BRT = Sábado 12h UTC → diaSemana === 6

  const resultados: Record<string, any> = {}

  // === TAREFA 1A: Sábado — gerar resumo da semana ===
  if (hora === 12 && diaSemana === 6) {
    console.log('[CRON] Sábado — gerando resumo semanal...')
    try {
      const resultado = await gerarResumoSemanal()
      resultados.resumoSemanal = resultado
    } catch (err: any) {
      resultados.resumoSemanal = { erro: err.message }
      console.error('[CRON] Erro no resumo semanal:', err)
    }
  }

  // === TAREFA 1B: Geração de posts para amanhã (Seg-Sex às 12h UTC / 9h Brasília) ===
  if (hora === 12 && diaSemana >= 1 && diaSemana <= 5) {
    console.log('[CRON] Iniciando geração de posts para amanhã...')
    try {
      const resultado = await gerarPostsParaAmanha({ diasAFrente: 1 })
      resultados.geracao = resultado
      console.log(`[CRON] Posts gerados: ${resultado.gerados}, erros: ${resultado.erros}`)
    } catch (err: any) {
      resultados.geracao = { erro: err.message }
      console.error('[CRON] Erro na geração:', err)
    }
  }

  // === TAREFA 2: Publicação de posts (roda às 12h e 17h UTC) ===
  if (hora === 12 || hora === 17) {
    console.log('[CRON] Verificando posts para publicar agora...')
    try {
      const publicados = await publicarPostsAgendados()
      resultados.publicacao = publicados
    } catch (err: any) {
      resultados.publicacao = { erro: err.message }
      console.error('[CRON] Erro na publicação:', err)
    }
  }

  // === TAREFA 3: Coleta de métricas (roda uma vez por dia às 12h UTC) ===
  if (hora === 12) {
    console.log('[CRON] Coletando métricas de engajamento...')
    try {
      const metricas = await coletarMetricasRecentes()
      resultados.metricas = metricas
    } catch (err: any) {
      resultados.metricas = { erro: err.message }
      console.error('[CRON] Erro ao coletar métricas:', err)
    }
  }

  return NextResponse.json({ hora_utc: hora, ...resultados })
}

async function publicarPostsAgendados() {
  const supabase = createClient()
  const agora = new Date()

  // Janela de 35 minutos ao redor do horário atual
  const janela = new Date(agora.getTime() - 5 * 60 * 1000) // 5min atrás
  const janelaFim = new Date(agora.getTime() + 30 * 60 * 1000) // 30min à frente

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'agendado')
    .gte('data_agendada', janela.toISOString())
    .lte('data_agendada', janelaFim.toISOString())

  if (!posts || posts.length === 0) {
    return { mensagem: 'Nenhum post para publicar agora', publicados: 0 }
  }

  let publicados = 0
  const erros: string[] = []

  for (const post of posts) {
    try {
      const linkedinId = await publicarPostLinkedIn(post)

      await supabase
        .from('posts')
        .update({
          status: 'publicado',
          publicado_em: new Date().toISOString(),
          linkedin_post_id: linkedinId,
        })
        .eq('id', post.id)

      publicados++
      console.log(`[CRON] Post publicado: ${post.id}`)
    } catch (err: any) {
      erros.push(`Post ${post.id}: ${err.message}`)
      await supabase
        .from('posts')
        .update({ status: 'erro', erro_publicacao: err.message })
        .eq('id', post.id)
    }
  }

  return { publicados, erros }
}

async function coletarMetricasRecentes() {
  const supabase = createClient()

  // Posts publicados nas últimas 72h que ainda não têm métricas do dia
  const limite = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const { data: posts } = await supabase
    .from('posts')
    .select('id, linkedin_post_id')
    .eq('status', 'publicado')
    .gte('publicado_em', limite.toISOString())
    .not('linkedin_post_id', 'is', null)

  if (!posts || posts.length === 0) {
    return { mensagem: 'Nenhum post recente para coletar métricas', coletados: 0 }
  }

  let coletados = 0
  for (const post of posts) {
    try {
      await coletarMetricas(post.id, post.linkedin_post_id)
      coletados++
    } catch (err) {
      console.error(`Erro ao coletar métricas do post ${post.id}:`, err)
    }
  }

  return { coletados }
}
