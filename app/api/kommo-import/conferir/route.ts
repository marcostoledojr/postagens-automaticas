/**
 * GET /api/kommo-import/conferir?chave=SEU_CRON_SECRET
 * Busca no Kommo, pelo nome de cada uma das 29 empresas importadas, o que
 * realmente ficou gravado (nome do lead, se achou, se o nome bate).
 */
import { NextRequest, NextResponse } from 'next/server'

const EMPRESAS = [
  'Marcon Industria Metalurgica','Alutec','All Nutri Alimentos Ltda','Emtec','Kamut Alimentos',
  'Tupan Assentos','Implatec','Chiaperini Industrial Ltda','Bardella','Dryeration',
  'Manteiga Aviacao','Fricon','Dinamica Group','Frigorifico Silva Industria E Comercio Ltda',
  'Afin Assessoria Fiscal E Contabil','Adm Comercio De Alimentos','Industria Alltec','Donana Alimentos',
  'Selovac','Excel Produtos Eletronicos Ltda','Grupo Ematex','Pronatec','Jomhedica Norte',
  'Pinfer Metalurgica','Plasson Livestock Division','S.R. Embalagens Plasticas','Metalurgica Forma Ltda',
  'Polimetal','Camaco',
]

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

  const resultados: any[] = []
  for (const empresa of EMPRESAS) {
    try {
      const data = await kommoFetch(`/leads?query=${encodeURIComponent(empresa)}&limit=5&with=contacts`)
      const leads = data._embedded?.leads ?? []
      if (leads.length === 0) {
        resultados.push({ esperado: empresa, encontrado: null, lead_id: null })
      } else {
        resultados.push({
          esperado: empresa,
          encontrado: leads.map((l: any) => ({ id: l.id, nome_no_kommo: l.name })),
        })
      }
    } catch (err: any) {
      resultados.push({ esperado: empresa, erro: err.message })
    }
  }

  return NextResponse.json({ ok: true, resultados })
}
