/**
 * Endpoint do Cron Job - executado automaticamente pelo Vercel Cron
 * Horários (UTC → BRT):
 *   10:00 UTC = 07:00 BRT → Geração de posts (Seg-Sex)
 *   11:00 UTC = 08:00 BRT → Publicação manhã (Seg-Sáb)
 *   16:00 UTC = 13:00 BRT → Publicação tarde (Seg-Sex)
 *
 * Obs: Plano Hobby tem janela flexível de até 1h — crons podem disparar com atraso.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { gerarPostsParaAmanha, gerarResumoSemanal } from '@/lib/motor-geracao'
import { publicarPostLinkedIn } from '@/lib/linkedin'
import { coletarMetricas } from '@/lib/metricas'
import { enviarAlertaErro } from '@/lib/email'

export async function GET(req: NextRequest) {
  // Verifica autenticação do cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const hora = agora.getHours() // UTC
  const diaSemana = agora.getDay()
  // Brasília = UTC-3:
  // 07h BRT = 10h UTC → geração
  // 08h BRT = 11h UTC → publicação manhã
  // 13h BRT = 16h UTC → publicação tarde

  const resultados: Record<string, any> = {}

  // === TAREFA 1: Geração de posts para o próximo dia útil (10h UTC / 7h BRT, Seg-Sex) ===
  if (hora === 10 && diaSemana >= 1 && diaSemana <= 5) {
    console.log('[CRON] Iniciando geração de posts para o próximo dia útil...')
    try {
      // Sexta: gera 3 dias à frente para cobrir segunda (sáb+dom pulados pelo motor)
      const diasAFrente = diaSemana === 5 ? 3 : 1
      const resultado = await gerarPostsParaAmanha({ diasAFrente })
      resultados.geracao = resultado
      console.log(`[CRON] Posts gerados: ${resultado.gerados}, erros: ${resultado.erros}`)
    } catch (err: any) {
      resultados.geracao = { erro: err.message }
      console.error('[CRON] Erro na geração:', err)
      await enviarAlertaErro({ fluxo: 'Geração de Posts', erro: err.message })
    }

    // Sexta: também gera o resumo semanal (agendado para sábado às 11h UTC / 8h BRT)
    if (diaSemana === 5) {
      console.log('[CRON] Sexta — gerando resumo semanal para aprovação...')
      try {
        const resultado = await gerarResumoSemanal()
        resultados.resumoSemanal = resultado
        if (!resultado.gerado && resultado.erro) {
          await enviarAlertaErro({ fluxo: 'Geração Resumo Semanal', erro: resultado.erro })
        }
      } catch (err: any) {
        resultados.resumoSemanal = { erro: err.message }
        console.error('[CRON] Erro no resumo semanal:', err)
        await enviarAlertaErro({ fluxo: 'Geração Resumo Semanal', erro: err.message })
      }
    }

    // Coleta métricas junto com a geração (uma vez por dia)
    console.log('[CRON] Coletando métricas de engajamento...')
    try {
      const metricas = await coletarMetricasRecentes()
      resultados.metricas = metricas
    } catch (err: any) {
      resultados.metricas = { erro: err.message }
      console.error('[CRON] Erro ao coletar métricas:', err)
    }
  }

  // === TAREFA 2: Publicação de posts (11h UTC / 8h BRT e 16h UTC / 13h BRT) ===
  if (hora === 11 || hora === 16) {
    console.log('[CRON] Verificando posts para publicar agora...')
    try {
      const publicados = await publicarPostsAgendados()
      resultados.publicacao = publicados

      // Alerta se houve erros de publicação
      if (publicados.erros && publicados.erros.length > 0) {
        await enviarAlertaErro({
          fluxo: 'Publicação LinkedIn',
          erro: `${publicados.erros.length} post(s) falharam`,
          detalhes: publicados.erros.join('\n'),
        })
      }

      // Alerta se não havia nenhum post para publicar mas há posts agendados no dia
      if (publicados.publicados === 0 && publicados.erros?.length === 0) {
        const supabase = createClient()
        const inicioDia = new Date(agora)
        inicioDia.setUTCHours(0, 0, 0, 0)
        const fimDia = new Date(agora)
        fimDia.setUTCHours(23, 59, 59, 999)
        const { data: agendadosHoje } = await supabase
          .from('posts')
          .select('id, tema_nome, data_agendada')
          .eq('status', 'agendado')
          .gte('data_agendada', inicioDia.toISOString())
          .lte('data_agendada', fimDia.toISOString())
        if (agendadosHoje && agendadosHoje.length > 0) {
          await enviarAlertaErro({
            fluxo: 'Publicação LinkedIn',
            erro: 'Cron rodou mas não encontrou posts na janela de publicação',
            detalhes: `Posts agendados para hoje mas fora da janela:\n${agendadosHoje.map(p => `• ${p.tema_nome} — ${p.data_agendada}`).join('\n')}`,
          })
        }
      }
    } catch (err: any) {
      resultados.publicacao = { erro: err.message }
      console.error('[CRON] Erro na publicação:', err)
      await enviarAlertaErro({ fluxo: 'Publicação LinkedIn (Cron)', erro: err.message })
    }
  }

  // Métricas: coletadas junto com a geração (hora === 10), bloco removido daqui

  return NextResponse.json({ hora_utc: hora, ...resultados })
}

async function publicarPostsAgendados() {
  const supabase = createClient()
  const agora = new Date()

  // Plano Hobby do Vercel: cron tem janela flexível de até 1h
  // Ex: cron das 12:00 UTC pode disparar às 12:47 UTC
  // Solução: buscar desde o início da hora UTC atual até 30min à frente
  const inicioDaHora = new Date(agora)
  inicioDaHora.setUTCMinutes(0, 0, 0)
  const janela = inicioDaHora                                    // ex: 12:00 UTC
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
