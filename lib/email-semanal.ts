/**
 * Email semanal para leads perdidos (Kommo)
 *
 * Fluxo:
 *  1. Sexta (cron): gerarEmailSemanal() monta o rascunho a partir dos posts
 *     aprovados/agendados/publicados da semana e salva com status 'pendente'.
 *  2. Marcos aprova (ou edita e aprova) na tela de revisão.
 *  3. Sábado (cron): enviarEmailSemanalDaSemana() busca o rascunho aprovado
 *     da semana, puxa os leads "perdido" no Kommo e dispara via Resend.
 */

import { createClient } from './supabase-server'
import { buscarLeadsPerdidos } from './kommo'
import { enviarAlertaErro } from './email'

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Oficina1 <onboarding@resend.dev>'
const CTA_PADRAO = 'Precisando de apoio com TOTVS Protheus ou ERP? Fale com a gente: contato@oficina1.com.br'
const PIPELINE_PADRAO = 'OFICINA1'
const STATUS_PERDIDO_PADRAO = 'Closed - lost'

// ─── Helpers de data (mesma lógica do resumo semanal do LinkedIn) ──────────

function limitesDaSemana(referencia: Date): { inicio: Date; fim: Date } {
  const diaSemana = referencia.getDay()
  const segunda = new Date(referencia)
  segunda.setDate(referencia.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
  segunda.setHours(0, 0, 0, 0)

  const sexta = new Date(segunda)
  sexta.setDate(segunda.getDate() + 4)
  sexta.setHours(23, 59, 59, 999)

  return { inicio: segunda, fim: sexta }
}

function formatarDataISO(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function buscarConfig(chave: string, padrao: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()
  if (!data?.valor) return padrao
  return typeof data.valor === 'string' ? data.valor : padrao
}

// ─── Geração do rascunho (sexta) ────────────────────────────────────────────

export async function gerarEmailSemanal(): Promise<{ gerado: boolean; erro?: string; id?: string }> {
  const supabase = createClient()
  const { inicio, fim } = limitesDaSemana(new Date())

  // Evita duplicar se já existe rascunho para essa semana
  const { data: existente } = await supabase
    .from('emails_semanais')
    .select('id, status')
    .eq('semana_inicio', formatarDataISO(inicio))
    .maybeSingle()

  if (existente) {
    return { gerado: false, erro: `Já existe um email para essa semana (status: ${existente.status})`, id: existente.id }
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('texto, tema_nome, data_agendada')
    .in('status', ['publicado', 'aprovado', 'agendado'])
    .neq('tema_nome', 'Resumo da Semana')
    .gte('data_agendada', inicio.toISOString())
    .lte('data_agendada', fim.toISOString())
    .order('data_agendada', { ascending: true })

  if (!posts || posts.length === 0) {
    await supabase.from('emails_semanais').insert({
      semana_inicio: formatarDataISO(inicio),
      semana_fim: formatarDataISO(fim),
      assunto: '(sem conteúdo)',
      corpo_html: '',
      status: 'sem_conteudo',
    })
    return { gerado: false, erro: 'Nenhum post aprovado essa semana para montar o email' }
  }

  const destaques = posts.map(p => {
    const primeiraLinha = p.texto.split('\n').find((l: string) => l.trim())?.trim() ?? ''
    const trecho = p.texto.split('\n').filter((l: string) => l.trim()).slice(1, 3).join(' ').trim()
    return { tema: p.tema_nome as string, gancho: primeiraLinha, trecho: trecho.slice(0, 220) }
  })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { gerado: false, erro: 'ANTHROPIC_API_KEY não configurada' }

  const contexto = destaques.map((d, i) => `${i + 1}. [${d.tema}] "${d.gancho}"`).join('\n')

  const promptSistema = `Você escreve, na voz de Marcos Toledo Jr (Head Comercial da Oficina1), o texto de um email curto enviado a pessoas que já conversaram com a Oficina1 no passado mas o negócio não avançou.

REGRAS ABSOLUTAS:
- ZERO emojis
- ZERO bullets, listas ou markdown
- ZERO negrito ou asteriscos
- ZERO "a gente"
- Tom direto, consultivo, sem venda forçada
- Não inclua saudação (ex: "Olá") nem assinatura — isso é montado à parte
- Não inclua links nem CTA — isso é montado à parte
- Responda em EXATAMENTE duas partes separadas pela linha "---", sem nenhum texto antes da primeira parte ou depois da segunda`

  const promptUsuario = `Essa semana a Oficina1 publicou conteúdo no LinkedIn sobre:
${contexto}

Parte 1 (linha única): um assunto de email curto (máximo 60 caracteres), sem aspas, que desperte curiosidade sem parecer spam.

---

Parte 2: um parágrafo curto (50-80 palavras) que serve de abertura do email. Reconhece que a conversa não avançou, sem cobrança, e convida a pessoa a dar uma olhada no que foi discutido essa semana como forma leve de manter contato.`

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
        max_tokens: 500,
        system: promptSistema,
        messages: [{ role: 'user', content: promptUsuario }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic API: ${res.status}`)

    const data = await res.json()
    const textoCompleto = (data.content[0].text as string).trim()
    const [assuntoBruto, ...resto] = textoCompleto.split('---')
    const assunto = assuntoBruto.trim().replace(/^["']|["']$/g, '') || 'Essa semana na Oficina1'
    const paragrafoAbertura = resto.join('---').trim()

    const cta = await buscarConfig('email_semanal_cta', CTA_PADRAO)
    const { html, texto } = montarHtmlEmail({ paragrafoAbertura, destaques, cta })

    const { data: inserido, error } = await supabase
      .from('emails_semanais')
      .insert({
        semana_inicio: formatarDataISO(inicio),
        semana_fim: formatarDataISO(fim),
        assunto,
        corpo_html: html,
        corpo_texto: texto,
        posts_incluidos: destaques,
        status: 'pendente',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    return { gerado: true, id: inserido.id }
  } catch (err: any) {
    console.error('[EMAIL SEMANAL] Erro ao gerar:', err)
    return { gerado: false, erro: err.message }
  }
}

// ─── Montagem do HTML ───────────────────────────────────────────────────────

function montarHtmlEmail({
  paragrafoAbertura,
  destaques,
  cta,
}: {
  paragrafoAbertura: string
  destaques: { tema: string; gancho: string; trecho: string }[]
  cta: string
}): { html: string; texto: string } {
  const blocosDestaque = destaques
    .map(
      d => `
        <tr>
          <td style="padding:14px 0;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:.04em;">${escaparHtml(d.tema)}</p>
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">${escaparHtml(d.gancho)}</p>
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">${escaparHtml(d.trecho)}</p>
          </td>
        </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:20px 28px;">
              <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">Oficina1</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 18px;font-size:15px;color:#0f172a;line-height:1.6;">Olá,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#0f172a;line-height:1.6;">${escaparHtml(paragrafoAbertura)}</p>
              <table width="100%" cellpadding="0" cellspacing="0">${blocosDestaque}</table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="background:#eff6ff;border-radius:6px;padding:18px 20px;">
                    <p style="margin:0;font-size:14px;color:#1e3a8a;line-height:1.6;">${escaparHtml(cta)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                Você recebeu este email porque já teve contato com a Oficina1.
                Se não quiser mais receber, <a href="{{UNSUB_URL}}" style="color:#94a3b8;text-decoration:underline;">clique aqui para não receber mais</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const texto = [
    'Olá,',
    '',
    paragrafoAbertura,
    '',
    ...destaques.map(d => `${d.tema}: ${d.gancho}\n${d.trecho}`),
    '',
    cta,
    '',
    'Para não receber mais: {{UNSUB_URL}}',
  ].join('\n')

  return { html, texto }
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─── Envio (sábado) ──────────────────────────────────────────────────────────

export async function enviarEmailSemanalDaSemana(): Promise<{
  enviado: boolean
  erro?: string
  destinatarios?: number
}> {
  const supabase = createClient()
  const { inicio } = limitesDaSemana(new Date())

  const { data: emailSemanal } = await supabase
    .from('emails_semanais')
    .select('*')
    .eq('semana_inicio', formatarDataISO(inicio))
    .maybeSingle()

  if (!emailSemanal) {
    return { enviado: false, erro: 'Nenhum email semanal encontrado para essa semana' }
  }

  if (emailSemanal.status === 'enviado') {
    return { enviado: false, erro: 'Email dessa semana já foi enviado' }
  }

  if (emailSemanal.status !== 'aprovado') {
    return { enviado: false, erro: `Email não foi aprovado (status atual: ${emailSemanal.status}) — não será enviado` }
  }

  return enviarEmailSemanalPorId(emailSemanal.id)
}

export async function enviarEmailSemanalPorId(id: string): Promise<{
  enviado: boolean
  erro?: string
  destinatarios?: number
}> {
  const supabase = createClient()
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { enviado: false, erro: 'RESEND_API_KEY não configurada' }

  const { data: emailSemanal, error: fetchError } = await supabase
    .from('emails_semanais')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !emailSemanal) return { enviado: false, erro: 'Email semanal não encontrado' }
  if (emailSemanal.status !== 'aprovado') {
    return { enviado: false, erro: `Email precisa estar aprovado (status atual: ${emailSemanal.status})` }
  }

  try {
    const nomePipeline = await buscarConfig('kommo_pipeline_nome', PIPELINE_PADRAO)
    const nomeStatus = await buscarConfig('kommo_status_perdido_nome', STATUS_PERDIDO_PADRAO)

    const leads = await buscarLeadsPerdidos(nomePipeline, nomeStatus)

    const emailsUnicos = Array.from(
      new Set(leads.map(l => l.email).filter((e): e is string => !!e).map(e => e.toLowerCase().trim()))
    )

    const { data: optouts } = await supabase.from('email_optout').select('email')
    const setOptout = new Set((optouts ?? []).map(o => o.email.toLowerCase().trim()))
    const destinatarios = emailsUnicos.filter(e => !setOptout.has(e))

    if (destinatarios.length === 0) {
      await supabase
        .from('emails_semanais')
        .update({ status: 'erro', erro_envio: 'Nenhum destinatário válido encontrado no Kommo (leads perdidos sem email, ou todos optaram por não receber)' })
        .eq('id', id)
      return { enviado: false, erro: 'Nenhum destinatário válido' }
    }

    let enviados = 0
    let comErro = 0
    const errosDetalhe: string[] = []

    for (const email of destinatarios) {
      try {
        const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email-semanal/optout?email=${encodeURIComponent(email)}`
        const htmlPersonalizado = emailSemanal.corpo_html.replaceAll('{{UNSUB_URL}}', unsubUrl)

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            subject: emailSemanal.assunto,
            html: htmlPersonalizado,
          }),
        })

        if (!res.ok) {
          comErro++
          errosDetalhe.push(`${email}: ${res.status}`)
        } else {
          enviados++
        }
        await sleep(600) // evita estourar rate limit do Resend
      } catch (err: any) {
        comErro++
        errosDetalhe.push(`${email}: ${err.message}`)
      }
    }

    await supabase
      .from('emails_semanais')
      .update({
        status: comErro > 0 && enviados === 0 ? 'erro' : 'enviado',
        destinatarios_total: destinatarios.length,
        destinatarios_enviados: enviados,
        destinatarios_erro: comErro,
        erro_envio: errosDetalhe.length > 0 ? errosDetalhe.slice(0, 10).join('\n') : null,
        enviado_em: new Date().toISOString(),
      })
      .eq('id', id)

    if (comErro > 0) {
      await enviarAlertaErro({
        fluxo: 'Email Semanal (envio)',
        erro: `${comErro} de ${destinatarios.length} envios falharam`,
        detalhes: errosDetalhe.slice(0, 10).join('\n'),
      })
    }

    return { enviado: enviados > 0, destinatarios: enviados }
  } catch (err: any) {
    console.error('[EMAIL SEMANAL] Erro ao enviar:', err)
    await supabase
      .from('emails_semanais')
      .update({ status: 'erro', erro_envio: err.message })
      .eq('id', id)
    await enviarAlertaErro({ fluxo: 'Email Semanal (Kommo/envio)', erro: err.message })
    return { enviado: false, erro: err.message }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
