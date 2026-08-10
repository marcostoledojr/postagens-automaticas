/**
 * GET /api/kommo-import/checar-empresa?chave=SEU_CRON_SECRET&nome=Pronatec
 * Checagem rápida e pontual: existe uma Company com esse nome? Está vinculada a algum lead?
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
  const nome = searchParams.get('nome')
  if (!nome) return NextResponse.json({ erro: 'Informe ?nome=' }, { status: 400 })

  const dataEmpresa = await kommoFetch(`/companies?query=${encodeURIComponent(nome)}&limit=5&with=leads,contacts`)
  const empresas = dataEmpresa._embedded?.companies ?? []

  return NextResponse.json({
    ok: true,
    empresas: empresas.map((c: any) => ({
      id: c.id,
      nome: c.name,
      leads_vinculados: (c._embedded?.leads ?? []).map((l: any) => l.id),
      contatos_vinculados: (c._embedded?.contacts ?? []).map((ct: any) => ct.id),
    })),
  })
}
