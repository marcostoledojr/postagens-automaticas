/**
 * Endpoint do Cron Job - executado automaticamente pelo Vercel Cron
 * Horários (UTC → BRT):
 *   10:00 UTC = 07:00 BRT → Geração do slot MANHÃ (Seg-Sex)
 *   11:00 UTC = 08:00 BRT → Publicação manhã (Seg-Sáb) + Envio email semanal (só Sáb)
 *   12:00 UTC = 09:00 BRT → Resumo semanal (LinkedIn) + rascunho Email Semanal (só Sex)
 *   13:00 UTC = 10:00 BRT → Geração do slot TARDE (Seg-Sex) — cron separado para evitar timeout
 *   16:00 UTC = 13:00 BRT → Publicação tarde (Seg-Sex)
 *
 * IMPORTANTE: A geração de cada slot (manhã e tarde) roda em crons separados porque
 * gerar 1 post (busca web + Claude + fal.ai + upload) costuma levar 40-55s.
 * Dois posts em sequência no mesmo cron excederia o limite de 60s do Vercel Hobby.
 *
 * ATENÇÃO — janela flexível do Vercel Hobby: o Vercel não garante o disparo no
 * minuto exato, pode atrasar até 1h (ex: cron das 10:00 UTC disparar às 10:47
 * OU só às 11:0x, já na hora seguinte). Por isso cada checagem abaixo aceita a
 * hora "certa" E a hora seguinte, não só `hora === X`. Isso é seguro porque
 * gerarPostsParaAmanha/gerarResumoSemanal/gerarEmailSemanal e o envio semanal
 * já pulam o que já foi feito (idempotentes) — vale a pena tolerar a janela a
 * mais do que perder silenciosamente a execução do dia, que foi o que aconteceu
 * em 16/09/2026 (cron das 10h e das 11h não geraram nada e não caíram em erro,
 * porque `agora.getHours()` bateu numa hora "sem dono" quando o disparo atrasou).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { gerarPostsParaAmanha, gerarResumoSemanal } from '@/lib/motor-geracao'
import { gerarEmailSemanal, enviarEmailSemanalDaSemana } from '@/lib/email-semanal'
import { publicarPostLinkedIn } from '@/lib/linkedin'
import { coletarMetricasRecentes } from '@/lib/metricas'
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

  // === TAREFA 1: Geração do slot MANHÃ (10h UTC / 7h BRT, Seg-Sex) ===
  // Separado do slot tarde para não exceder o limite de 60s por chamada.
  // Aceita também 11h (janela flexível do Hobby — ver nota no topo do arquivo).
  if ((hora === 10 || hora === 11) && diaSemana >= 1 && diaSemana <= 5) {
    console.log('[CRON] Gerando slot MANHÃ para o próximo dia útil...')
    try {
      // Sexta: gera 3 dias à frente para cobrir segunda (sáb+dom pulados pelo motor)
      const diasAFrente = diaSemana === 5 ? 3 : 1
      const resultado = await gerarPostsParaAmanha({ diasAFrente, apenasSlot: 'manha' })
      resultados.geracao = resultado
      console.log(`[CRON] Posts gerados: ${resultado.gerados}, erros: ${resultado.erros}`)
    } catch (err: any) {
      resultados.geracao = { erro: err.message }
      console.error('[CRON] Erro na geração manhã:', err)
      await enviarAlertaErro({ fluxo: 'Geração de Posts (manhã)', erro: err.message })
    }

    // Coleta métricas junto com a geração (uma vez por dia)
    // Schedule inteligente: diário nos primeiros 7 dias, semanal até 30 dias
    console.log('[CRON] Coletando métricas de engajamento...')
    try {
      const metricas = await coletarMetricasRecentes()
      resultados.metricas = metricas
    } catch (err: any) {
      resultados.metricas = { erro: err.message }
      console.error('[CRON] Erro ao coletar métricas:', err)
    }
  }

  // === TAREFA 1B: Geração do slot TARDE (13h UTC / 10h BRT, Seg-Sex) ===
  // Cron separado do slot manhã para não exceder o limite de 60s por chamada.
  // Aceita também 14h (janela flexível do Hobby — ver nota no topo do arquivo).
  if ((hora === 13 || hora === 14) && diaSemana >= 1 && diaSemana <= 5) {
    console.log('[CRON] Gerando slot TARDE para o próximo dia útil...')
    try {
      const diasAFrente = diaSemana === 5 ? 3 : 1
      const resultado = await gerarPostsParaAmanha({ diasAFrente, apenasSlot: 'tarde' })
      resultados.geracaoTarde = resultado
      console.log(`[CRON] Posts tarde gerados: ${resultado.gerados}, erros: ${resultado.erros}`)
    } catch (err: any) {
      resultados.geracaoTarde = { erro: err.message }
      console.error('[CRON] Erro na geração tarde:', err)
      await enviarAlertaErro({ fluxo: 'Geração de Posts (tarde)', erro: err.message })
    }
  }

  // === TAREFA 1C: Resumo semanal (LinkedIn) + rascunho do Email Semanal (sexta, 12h UTC / 9h BRT) ===
  // Separado da geração diária de posts para não competir pelo limite de 60s do cron.
  // NÃO ampliamos a janela aqui de propósito: 13h já é a hora certa da geração do
  // slot TARDE (TAREFA 1B) — se também aceitássemos 13h aqui, um atraso do Vercel
  // faria as duas tarefas (bem mais pesadas) rodarem juntas na mesma chamada e
  // estourar os 60s. Se essa cair na janela de atraso, use o botão "Gerar rascunho
  // agora" na tela de Email Semanal como recuperação manual.
  if (hora === 12 && diaSemana === 5) {
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

    console.log('[CRON] Sexta — gerando rascunho do email semanal (leads perdidos)...')
    try {
      const resultadoEmail = await gerarEmailSemanal()
      resultados.emailSemanal = resultadoEmail
      if (!resultadoEmail.gerado && resultadoEmail.erro) {
        await enviarAlertaErro({ fluxo: 'Geração Email Semanal', erro: resultadoEmail.erro })
      }
    } catch (err: any) {
      resultados.emailSemanal = { erro: err.message }
      console.error('[CRON] Erro no email semanal:', err)
      await enviarAlertaErro({ fluxo: 'Geração Email Semanal', erro: err.message })
    }
  }

    // === TAREFA 1B: Envio do email semanal (sábado, 11h UTC / 8h BRT — só dispara se estiver aprovado) ===
  // Aceita também 12h (janela flexível do Hobby — ver nota no topo do arquivo).
  if ((hora === 11 || hora === 12) && diaSemana === 6) {
    console.log('[CRON] Sábado — verificando email semanal aprovado para envio...')
    try {
      const resultadoEnvio = await enviarEmailSemanalDaSemana()
      resultados.envioEmailSemanal = resultadoEnvio
      if (!resultadoEnvio.enviado && resultadoEnvio.erro && resultadoEnvio.erro !== 'Nenhum email semanal encontrado para essa semana') {
        await enviarAlertaErro({ fluxo: 'Envio Email Semanal', erro: resultadoEnvio.erro })
      }
    } catch (err: any) {
      resultados.envioEmailSemanal = { erro: err.message }
      console.error('[CRON] Erro no envio do email semanal:', err)
      await enviarAlertaErro({ fluxo: 'Envio Email Semanal', erro: err.message })
    }
  }

  // === TAREFA 2: Publicação de posts (11h UTC / 8h BRT e 16h UTC / 13h BRT) ===
  // Aceita também 12h e 17h (janela flexível do Hobby — ver nota no topo do
  // arquivo). publicarPostsAgendados() já calcula sua própria janela precisa
  // de ±30min em cima da hora real, então rodar "a mais" aqui é seguro — só
  // não publica de novo o que já foi publicado.
  if (hora === 11 || hora === 12 || hora === 16 || hora === 17) {
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

  return NextResponse.json({ hora_utc: hora, dia_semana: diaSemana, ...resultados })
}

async function publicarPostsAgendados() {
  const supabase = createClient()
  const agora = new Date()

  // Plano Hobby do Vercel: cron tem janela flexível de até 1h, podendo até
  // "vazar" pra hora seguinte (ex: cron das 11:00 UTC só disparar às 12:0x).
  // NÃO usamos uma janela baseada na "hora atual" (isso reseta pra frente e
  // faz um post agendado pra hora anterior ficar pra trás pra sempre — foi
  // o bug real por trás de 3 dias seguidos sem publicar às 8h). Em vez disso:
  // pega qualquer post 'agendado' cujo horário já chegou (ou chega nos
  // próximos 30min) — sem limite inferior. O filtro de status já garante
  // que nada é publicado duas vezes.
  const janelaFim = new Date(agora.getTime() + 30 * 60 * 1000) // 30min à frente

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'agendado')
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

// coletarMetricasRecentes: importada de @/lib/metricas
