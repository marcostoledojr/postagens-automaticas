/**
 * Email semanal para leads perdidos (Kommo)
 *
 * Fluxo:
 *  1. Sexta (cron): gerarEmailSemanal() monta o rascunho a partir dos posts
 *     aprovados/agendados/publicados da semana e salva com status 'pendente'.
 *  2. Marcos aprova (ou edita e aprova) na tela de revisão.
 *  3. Sábado (cron): enviarEmailSemanalDaSemana() re-resolve os links dos
 *     posts no LinkedIn (podem não existir ainda na sexta) e dispara via Resend.
 */

import { createClient } from './supabase-server'
import { buscarLeadsPerdidos } from './kommo'
import { verificarPostExiste } from './linkedin'
import { enviarAlertaErro } from './email'

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Oficina1 <onboarding@resend.dev>'
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'comercial@oficina1.com.br'
const CTA_PADRAO = 'Precisando de apoio com TOTVS Protheus, fale com a gente!'
const WHATSAPP = '11 97534-1388'
const WHATSAPP_LINK = 'https://wa.me/5511975341388'
const LINKEDIN_OFICINA1 = 'https://www.linkedin.com/company/oficina1/'
const SITE_OFICINA1 = 'https://oficina1.com.br'
const LOGO_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/logo-oficina1.png`
const PIPELINE_PADRAO = 'OFICINA1'
const STATUS_PERDIDO_PADRAO = 'Closed - lost'

// Destinatários internos fixos — recebem toda semana junto com os leads, pra acompanhamento interno
const DESTINATARIOS_INTERNOS = [
  'jaime.wikanski@oficina1.com.br',
  'andreza.favero@oficina1.com.br',
  'marcos.toledo@oficina1.com.br',
]

type Destaque = {
  postId: string
  tema: string
  gancho: string
  resumo: string
}

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

function linkDoPostLinkedIn(linkedinPostId: string | null): string | null {
  if (!linkedinPostId) return null
  return `https://www.linkedin.com/feed/update/${linkedinPostId}/`
}

/**
 * Verifica, para uma lista de destaques, quais posts ainda existem de fato no
 * LinkedIn. Só entram no email (resumo + link) os posts confirmados — se o
 * post ainda não foi publicado ou não existe mais, ele é descartado por
 * inteiro (não aparece nem o resumo sem link).
 */
async function filtrarDestaquesValidos(
  destaques: Destaque[],
  postIds: string[]
): Promise<{ destaquesValidos: Destaque[]; linksPostId: Record<string, string | null> }> {
  const supabase = createClient()
  const { data: postsAtuais } = await supabase
    .from('posts')
    .select('id, linkedin_post_id')
    .in('id', postIds)

  const verificacoes = await Promise.all(
    (postsAtuais ?? []).map(async p => {
      if (!p.linkedin_post_id) return [p.id, null] as const
      const existe = await verificarPostExiste(p.linkedin_post_id)
      return [p.id, existe ? p.linkedin_post_id : null] as const
    })
  )
  const linksPostId = Object.fromEntries(verificacoes)
  const destaquesValidos = destaques.filter(d => !!linksPostId[d.postId])

  return { destaquesValidos, linksPostId }
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
    .select('id, texto, tema_nome, data_agendada, linkedin_post_id')
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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { gerado: false, erro: 'ANTHROPIC_API_KEY não configurada' }

  const contexto = posts
    .map((p, i) => {
      const primeiraLinha = p.texto.split('\n').find((l: string) => l.trim())?.trim() ?? ''
      const corpo = p.texto.split('\n').filter((l: string) => l.trim()).slice(1).join(' ').trim()
      return `${i + 1}. [${p.tema_nome}] Gancho: "${primeiraLinha}"\nTexto: ${corpo.slice(0, 500)}`
    })
    .join('\n\n')

  const promptSistema = `Você escreve, na voz de Marcos Toledo Jr (Head Comercial da Oficina1), o conteúdo de um email curto enviado a pessoas que já conversaram com a Oficina1 no passado mas o negócio não avançou.

REGRAS ABSOLUTAS:
- ZERO emojis
- ZERO bullets, listas ou markdown
- ZERO negrito ou asteriscos
- ZERO travessão (—) ou hífen (-) no meio de frases
- ZERO "a gente"
- Tom caloroso, humano, como alguém escrevendo mesmo o email — não um resumo corporativo
- Não inclua saudação (ex: "Olá") nem assinatura — isso é montado à parte
- Não inclua links nem CTA — isso é montado à parte
- Responda em EXATAMENTE três partes separadas pela linha "---", sem nenhum texto antes da primeira parte ou depois da última`

  const promptUsuario = `Essa semana a Oficina1 publicou ${posts.length} posts no LinkedIn:

${contexto}

Parte 1 (linha única): um assunto de email curto (máximo 60 caracteres), sem aspas, que desperte curiosidade sem parecer spam.

---

Parte 2: um parágrafo de abertura (40 a 70 palavras) no estilo "Segue o resumo da semana Oficina1" — comece parecido com isso, depois mencione de forma fluida e humana a variedade de assuntos que apareceram essa semana (sem listar como bullet, numa frase corrida natural), e feche convidando para a leitura com entusiasmo genuíno. Não repita o conteúdo dos posts em detalhe aqui — isso vem na parte 3. Não mencione que "a conversa não avançou" nem nada sobre o relacionamento comercial anterior — o tom aqui é de compartilhar conteúdo útil, não de retomar contato.

---

Parte 3: exatamente ${posts.length} linhas numeradas (1. 2. 3. ...), na mesma ordem dos posts acima. Cada linha é um resumo de 1 frase (máximo 25 palavras) do que aquele post específico argumenta — não copie o gancho, sintetize a ideia central com suas palavras.`

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
        max_tokens: 900,
        system: promptSistema,
        messages: [{ role: 'user', content: promptUsuario }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic API: ${res.status}`)

    const data = await res.json()
    const textoCompleto = (data.content[0].text as string).trim()
    const partes = textoCompleto.split('---').map(p => p.trim())
    const assunto = (partes[0] ?? '').replace(/^["']|["']$/g, '') || 'Essa semana na Oficina1'
    const paragrafoAbertura = partes[1] ?? ''
    const blocoResumos = partes[2] ?? ''

    const linhasResumo = blocoResumos
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^\d+[.).]\s*/, ''))

    const destaques: Destaque[] = posts.map((p, i) => {
      const primeiraLinha = p.texto.split('\n').find((l: string) => l.trim())?.trim() ?? ''
      return {
        postId: p.id,
        tema: p.tema_nome as string,
        gancho: primeiraLinha,
        resumo: linhasResumo[i] ?? primeiraLinha,
      }
    })

    // A prévia de sexta também só mostra posts confirmados como existentes —
    // os que ainda não foram publicados aparecem de novo automaticamente
    // quando o email for reconstruído no envio (sábado), já publicados.
    const { destaquesValidos } = await filtrarDestaquesValidos(destaques, posts.map(p => p.id))

    const cta = await buscarConfig('email_semanal_cta', CTA_PADRAO)
    const { html, texto } = montarHtmlEmail({
      paragrafoAbertura,
      destaques: destaquesValidos,
      cta,
      linksPostId: Object.fromEntries(posts.map(p => [p.id, p.linkedin_post_id])),
    })

    const { data: inserido, error } = await supabase
      .from('emails_semanais')
      .insert({
        semana_inicio: formatarDataISO(inicio),
        semana_fim: formatarDataISO(fim),
        assunto,
        paragrafo_abertura: paragrafoAbertura,
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
  linksPostId,
}: {
  paragrafoAbertura: string
  destaques: Destaque[]
  cta: string
  linksPostId: Record<string, string | null>
}): { html: string; texto: string } {
  const blocosDestaque = destaques
    .map(d => {
      const link = linkDoPostLinkedIn(linksPostId[d.postId] ?? null)
      const linkHtml = link
        ? `<a href="${link}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:13px;color:#3b82f6;text-decoration:none;font-weight:600;">Ver post completo →</a>`
        : ''
      return `
        <tr>
          <td style="padding:14px 0;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">${escaparHtml(d.gancho)}</p>
            <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">${escaparHtml(d.resumo)}</p>
            ${linkHtml}
          </td>
        </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#ffffff;padding:24px 28px;border-bottom:1px solid #e2e8f0;">
              <img src="${LOGO_URL}" alt="Oficina1" width="140" style="display:block;height:auto;" />
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
                    <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1e3a8a;line-height:1.6;">${escaparHtml(cta)}</p>
                    <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.8;">
                      WhatsApp: <a href="${WHATSAPP_LINK}" style="color:#1e3a8a;font-weight:600;">${WHATSAPP}</a><br/>
                      Email: <a href="mailto:${REPLY_TO}" style="color:#1e3a8a;font-weight:600;">${REPLY_TO}</a><br/>
                      LinkedIn: <a href="${LINKEDIN_OFICINA1}" style="color:#1e3a8a;font-weight:600;">linkedin.com/company/oficina1</a><br/>
                      Site: <a href="${SITE_OFICINA1}" style="color:#1e3a8a;font-weight:600;">oficina1.com.br</a>
                    </p>
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
    ...destaques.map(d => {
      const link = linkDoPostLinkedIn(linksPostId[d.postId] ?? null)
      return `${d.gancho}\n${d.resumo}${link ? `\n${link}` : ''}`
    }),
    '',
    cta,
    `WhatsApp: ${WHATSAPP} | Email: ${REPLY_TO} | ${LINKEDIN_OFICINA1} | ${SITE_OFICINA1}`,
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

/**
 * Reconstrói o HTML/texto de um email semanal a partir do que está salvo
 * (parágrafo de abertura + destaques), resolvendo os links do LinkedIn com
 * os dados mais atuais dos posts. Usado no envio (sábado) e sempre que o
 * parágrafo de abertura é editado manualmente.
 */
export async function reconstruirHtmlEmailSemanal(id: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = createClient()
  const { data: emailSemanal, error: fetchError } = await supabase
    .from('emails_semanais')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !emailSemanal) return { ok: false, erro: 'Email semanal não encontrado' }

  const destaques = (emailSemanal.posts_incluidos ?? []) as Destaque[]
  if (destaques.length === 0 || !destaques[0]?.postId) return { ok: true }

  try {
    // Só entram no email os posts confirmados como existentes no LinkedIn —
    // se um post ainda não foi publicado ou foi removido, ele é descartado
    // por inteiro (nem o resumo aparece, não só o link).
    const postIds = destaques.map(d => d.postId)
    const { destaquesValidos, linksPostId } = await filtrarDestaquesValidos(destaques, postIds)

    const cta = await buscarConfig('email_semanal_cta', CTA_PADRAO)
    const refeito = montarHtmlEmail({
      paragrafoAbertura: emailSemanal.paragrafo_abertura ?? '',
      destaques: destaquesValidos,
      cta,
      linksPostId,
    })

    await supabase
      .from('emails_semanais')
      .update({ corpo_html: refeito.html, corpo_texto: refeito.texto, atualizado_em: new Date().toISOString() })
      .eq('id', id)

    return { ok: true }
  } catch (err: any) {
    return { ok: false, erro: err.message }
  }
}

export async function enviarEmailSemanalDeTeste(id: string, emailDestino: string): Promise<{ enviado: boolean; erro?: string }> {
  const supabase = createClient()
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { enviado: false, erro: 'RESEND_API_KEY não configurada' }

  await reconstruirHtmlEmailSemanal(id)

  const { data: emailSemanal, error: fetchError } = await supabase
    .from('emails_semanais')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !emailSemanal) return { enviado: false, erro: 'Email semanal não encontrado' }

  const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email-semanal/optout?email=${encodeURIComponent(emailDestino)}`
  const htmlPersonalizado = emailSemanal.corpo_html.replaceAll('{{UNSUB_URL}}', unsubUrl)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [emailDestino],
      reply_to: REPLY_TO,
      subject: `[TESTE] ${emailSemanal.assunto}`,
      html: htmlPersonalizado,
    }),
  })

  if (!res.ok) {
    const corpo = await res.text()
    return { enviado: false, erro: `Resend ${res.status}: ${corpo}` }
  }

  return { enviado: true }
}

export async function enviarEmailSemanalPorId(id: string): Promise<{
  enviado: boolean
  erro?: string
  destinatarios?: number
}> {
  const supabase = createClient()
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { enviado: false, erro: 'RESEND_API_KEY não configurada' }

  const { data: emailSemanalInicial, error: fetchError } = await supabase
    .from('emails_semanais')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !emailSemanalInicial) return { enviado: false, erro: 'Email semanal não encontrado' }
  if (!['aprovado', 'erro'].includes(emailSemanalInicial.status)) {
    return { enviado: false, erro: `Email precisa estar aprovado (status atual: ${emailSemanalInicial.status})` }
  }

  try {
    // Re-resolve os links dos posts no LinkedIn — na sexta (geração) alguns
    // posts da semana ainda podem não ter sido publicados, então refazemos
    // o HTML agora com os linkedin_post_id mais atuais antes de enviar.
    await reconstruirHtmlEmailSemanal(id)

    const { data: emailSemanal } = await supabase.from('emails_semanais').select('*').eq('id', id).single()
    const corpoHtml = emailSemanal.corpo_html

    const nomePipeline = await buscarConfig('kommo_pipeline_nome', PIPELINE_PADRAO)
    const nomeStatus = await buscarConfig('kommo_status_perdido_nome', STATUS_PERDIDO_PADRAO)

    const leads = await buscarLeadsPerdidos(nomePipeline, nomeStatus)

    const emailsUnicos = Array.from(
      new Set([
        ...leads.map(l => l.email).filter((e): e is string => !!e),
        ...DESTINATARIOS_INTERNOS,
      ].map(e => e.toLowerCase().trim()))
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
    const registrosDestinatarios: { email_semanal_id: string; email: string; status: string; erro: string | null }[] = []

    for (const email of destinatarios) {
      try {
        const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email-semanal/optout?email=${encodeURIComponent(email)}`
        const htmlPersonalizado = corpoHtml.replaceAll('{{UNSUB_URL}}', unsubUrl)

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            reply_to: REPLY_TO,
            subject: emailSemanal.assunto,
            html: htmlPersonalizado,
          }),
        })

        if (!res.ok) {
          comErro++
          errosDetalhe.push(`${email}: ${res.status}`)
          registrosDestinatarios.push({ email_semanal_id: id, email, status: 'erro', erro: `HTTP ${res.status}` })
        } else {
          enviados++
          registrosDestinatarios.push({ email_semanal_id: id, email, status: 'enviado', erro: null })
        }
        await sleep(600) // evita estourar rate limit do Resend
      } catch (err: any) {
        comErro++
        errosDetalhe.push(`${email}: ${err.message}`)
        registrosDestinatarios.push({ email_semanal_id: id, email, status: 'erro', erro: err.message })
      }
    }

    // Limpa registros de tentativas anteriores (ex: retry após erro) antes de gravar a lista atual
    await supabase.from('emails_semanais_destinatarios').delete().eq('email_semanal_id', id)
    if (registrosDestinatarios.length > 0) {
      await supabase.from('emails_semanais_destinatarios').insert(registrosDestinatarios)
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
