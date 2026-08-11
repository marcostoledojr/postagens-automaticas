import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { criarNotaLead } from '@/lib/kommo'

// Envia o email semanal já existente (mesmo conteúdo já enviado à base antiga)
// apenas para os leads recém-importados via /api/kommo-import/executar +
// /api/kommo-import/empresas, sem alterar contadores/registros do envio original.

const KOMMO_API_URL = process.env.KOMMO_API_URL!
const KOMMO_TOKEN = process.env.KOMMO_LONG_LIVED_TOKEN!
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Oficina1 <onboarding@resend.dev>'
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'comercial@oficina1.com.br'

// contact_ids dos 29 leads criados na importação (ordem da criação)
const CONTATO_IDS = [
  15277684, 15277686, 15277688, 15277690, 15277692,
  15277694, 15277696, 15277698, 15277700, 15277702,
  15277704, 15277706, 15277708, 15277712, 15277714,
  15277716, 15277718, 15277720, 15277722, 15277724,
  15277726, 15277728, 15277732, 15277734, 15277736,
  15277738, 15277740, 15277742, 15277744,
]

// lead_id na mesma ordem de CONTATO_IDS (um lead por contato)
const LEAD_IDS = [
  8303696, 8303698, 8303700, 8303702, 8303704,
  8303706, 8303708, 8303710, 8303714, 8303716,
  8303718, 8303720, 8303722, 8303726, 8303728,
  8303730, 8303732, 8303734, 8303738, 8303740,
  8303742, 8303744, 8303748, 8303750, 8303752,
  8303754, 8303756, 8303758, 8303760,
]

async function kommoFetch(path: string) {
  const res = await fetch(`${KOMMO_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${KOMMO_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Kommo ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: 'chave inválida' }, { status: 401 })
  }

  const emailSemanalId = searchParams.get('id')
  if (!emailSemanalId) return NextResponse.json({ ok: false, erro: 'informe ?id=<uuid do email_semanal>' }, { status: 400 })

  const modo = searchParams.get('modo') === 'real' ? 'real' : 'teste'
  const inicio = Number(searchParams.get('inicio') ?? '0')
  const quantidade = Number(searchParams.get('quantidade') ?? '10')
  const lote = CONTATO_IDS.slice(inicio, inicio + quantidade)

  const supabase = createClient()
  const { data: emailSemanal, error } = await supabase
    .from('emails_semanais')
    .select('*')
    .eq('id', emailSemanalId)
    .single()

  if (error || !emailSemanal) return NextResponse.json({ ok: false, erro: 'email_semanal não encontrado' }, { status: 404 })

  // Busca emails dos contatos em lote
  const filtro = lote.map(id => `filter[id][]=${id}`).join('&')
  const dados = await kommoFetch(`/contacts?${filtro}&limit=250`)
  const contatos = dados._embedded?.contacts ?? []

  const resultados: any[] = []
  const apiKey = process.env.RESEND_API_KEY

  for (const contato of contatos) {
    const idxGlobal = CONTATO_IDS.indexOf(contato.id)
    const leadId = idxGlobal >= 0 ? LEAD_IDS[idxGlobal] : undefined
    const campoEmail = (contato.custom_fields_values ?? []).find((c: any) => c.field_code === 'EMAIL')
    const email = campoEmail?.values?.[0]?.value

    if (!email) {
      resultados.push({ contato_id: contato.id, nome: contato.name, status: 'sem_email' })
      continue
    }

    if (modo === 'teste') {
      resultados.push({ contato_id: contato.id, nome: contato.name, email, status: 'seria_enviado' })
      continue
    }

    if (!apiKey) {
      resultados.push({ contato_id: contato.id, email, status: 'erro', erro: 'RESEND_API_KEY não configurada' })
      continue
    }

    const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email-semanal/optout?email=${encodeURIComponent(email)}`
    const htmlPersonalizado = emailSemanal.corpo_html.replaceAll('{{UNSUB_URL}}', unsubUrl)

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
      resultados.push({ contato_id: contato.id, email, status: 'erro', erro: `Resend ${res.status}: ${await res.text()}` })
    } else {
      resultados.push({ contato_id: contato.id, email, status: 'enviado' })
      if (leadId) {
        const dataEnvio = new Date().toLocaleDateString('pt-BR')
        criarNotaLead(leadId, `Email semanal Oficina1 enviado em ${dataEnvio}.`).catch(() => {})
      }
    }

    await sleep(600)
  }

  return NextResponse.json({
    ok: true,
    modo,
    inicio,
    quantidade,
    proximo_inicio: inicio + quantidade < CONTATO_IDS.length ? inicio + quantidade : null,
    total_contatos: CONTATO_IDS.length,
    resultados,
  })
}
