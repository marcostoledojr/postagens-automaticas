/**
 * GET /api/kommo-import/campos?chave=SEU_CRON_SECRET
 * Diagnóstico: lista os campos personalizados de leads e contatos no Kommo,
 * pra identificar o campo certo pra "Empresa" antes de importar.
 */
import { NextRequest, NextResponse } from 'next/server'

async function kommoFetch(path: string) {
  const apiUrl = process.env.KOMMO_API_URL
  const token = process.env.KOMMO_LONG_LIVED_TOKEN
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Kommo ${path}: ${res.status} ${await res.text()}`)
  if (res.status === 204) return { _embedded: {} }
  return res.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const [leadsFields, contactsFields] = await Promise.all([
      kommoFetch('/leads/custom_fields?limit=250'),
      kommoFetch('/contacts/custom_fields?limit=250'),
    ])

    const resumo = (data: any) =>
      (data._embedded?.custom_fields ?? []).map((f: any) => ({ id: f.id, nome: f.name, tipo: f.type, codigo: f.code }))

    return NextResponse.json({
      ok: true,
      campos_leads: resumo(leadsFields),
      campos_contatos: resumo(contactsFields),
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
