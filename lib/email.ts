/**
 * Alertas por email via Resend
 * Configura: adicione RESEND_API_KEY no .env.local e no Vercel
 * Cadastro gratuito em resend.com
 */

const EMAIL_DESTINO = 'marcos.toledo@oficina1.com.br'
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Postagens Auto <onboarding@resend.dev>'

export async function enviarAlertaErro({
  fluxo,
  erro,
  detalhes,
}: {
  fluxo: string
  erro: string
  detalhes?: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[EMAIL] RESEND_API_KEY não configurada — alerta não enviado')
    return
  }

  const agora = new Date()
  const dataFormatada = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const horaFormatada = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const assunto = `Problema com Fluxo de Postagem Automática LinkedIn - ${dataFormatada}`

  const promptClaude = [
    `Fluxo: ${fluxo}`,
    `Erro: ${erro}`,
    detalhes ? `Detalhes: ${detalhes}` : '',
  ].filter(Boolean).join('\n')

  const corpo = `Olá Marcos,

Ocorreu um problema no sistema de postagens automáticas da Oficina1.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUXO: ${fluxo}
ERRO: ${erro}${detalhes ? `\n\nDETALHES:\n${detalhes}` : ''}
DATA/HORA: ${horaFormatada}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para verificar e corrigir, leve este prompt ao Claude (Cowork):

"Tive um erro no sistema de postagens automáticas:
${promptClaude}
Pode verificar e corrigir?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sistema de Postagens Automáticas — Oficina1`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_DESTINO],
        subject: assunto,
        text: corpo,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[EMAIL] Erro ao enviar alerta:', err)
    } else {
      console.log(`[EMAIL] Alerta enviado: ${assunto}`)
    }
  } catch (err: any) {
    console.error('[EMAIL] Exceção ao enviar alerta:', err.message)
  }
}
