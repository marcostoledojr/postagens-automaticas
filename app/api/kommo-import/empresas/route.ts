/**
 * GET /api/kommo-import/empresas?chave=SEU_CRON_SECRET&modo=teste|real
 * Segunda etapa da importação: cria uma entidade "Empresa" (Company) no Kommo
 * pra cada um dos 29 leads importados, e vincula ao lead e ao contato —
 * preenchendo o campo "Empresa" que aparece embaixo do contato.
 */
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const CAMPO_CNPJ_ID = 447050

const EMPRESAS: { nome: string; cnpj: string }[] = [
  { nome: 'Marcon Industria Metalurgica', cnpj: '57211997000146' },
  { nome: 'Alutec', cnpj: '54371133000101' },
  { nome: 'All Nutri Alimentos Ltda', cnpj: '05965693000170' },
  { nome: 'Emtec', cnpj: '04167711000106' },
  { nome: 'Kamut Alimentos', cnpj: '73665085000109' },
  { nome: 'Tupan Assentos', cnpj: '50516731000162' },
  { nome: 'Implatec', cnpj: '00716481000136' },
  { nome: 'Chiaperini Industrial Ltda', cnpj: '59064766000182' },
  { nome: 'Bardella', cnpj: '00890462000121' },
  { nome: 'Dryeration', cnpj: '87744546000135' },
  { nome: 'Manteiga Aviacao', cnpj: '61365557000110' },
  { nome: 'Fricon', cnpj: '19791995000184' },
  { nome: 'Dinamica Group', cnpj: '61784823000140' },
  { nome: 'Frigorifico Silva Industria E Comercio Ltda', cnpj: '88728027000146' },
  { nome: 'Afin Assessoria Fiscal E Contabil', cnpj: '00802291000131' },
  { nome: 'Adm Comercio De Alimentos', cnpj: '67886622000130' },
  { nome: 'Industria Alltec', cnpj: '00745309000100' },
  { nome: 'Donana Alimentos', cnpj: '09244411000105' },
  { nome: 'Selovac', cnpj: '62700182000160' },
  { nome: 'Excel Produtos Eletronicos Ltda', cnpj: '64579782000148' },
  { nome: 'Grupo Ematex', cnpj: '07590753000143' },
  { nome: 'Pronatec', cnpj: '05058525000100' },
  { nome: 'Jomhedica Norte', cnpj: '02429547000132' },
  { nome: 'Pinfer Metalurgica', cnpj: '03833260000136' },
  { nome: 'Plasson Livestock Division', cnpj: '01628313000151' },
  { nome: 'S.R. Embalagens Plasticas', cnpj: '50418557000115' },
  { nome: 'Metalurgica Forma Ltda', cnpj: '90357534000162' },
  { nome: 'Polimetal', cnpj: '58568130000105' },
  { nome: 'Camaco', cnpj: '11701069000169' },
]

async function kommoFetch(path: string, init?: RequestInit) {
  const apiUrl = process.env.KOMMO_API_URL
  const token = process.env.KOMMO_LONG_LIVED_TOKEN
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Kommo ${path}: ${res.status} ${await res.text()}`)
  if (res.status === 204) return { _embedded: {} }
  return res.json()
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const modo = searchParams.get('modo') === 'real' ? 'real' : 'teste'

  const resultados: any[] = []

  for (const empresa of EMPRESAS) {
    try {
      // Acha o lead pelo nome + o contato vinculado
      const dataLead = await kommoFetch(`/leads?query=${encodeURIComponent(empresa.nome)}&limit=5&with=contacts`)
      const lead = (dataLead._embedded?.leads ?? []).find((l: any) => normalizar(l.name) === normalizar(empresa.nome))
      if (!lead) {
        resultados.push({ empresa: empresa.nome, status: 'lead_nao_encontrado' })
        continue
      }
      const contato = (lead._embedded?.contacts ?? [])[0]
      if (!contato) {
        resultados.push({ empresa: empresa.nome, status: 'contato_nao_encontrado', lead_id: lead.id })
        continue
      }

      // Verifica se já existe uma empresa com esse nome (evita duplicar se rodar 2x)
      const dataEmpresa = await kommoFetch(`/companies?query=${encodeURIComponent(empresa.nome)}&limit=5`)
      let empresaExistente = (dataEmpresa._embedded?.companies ?? []).find(
        (c: any) => normalizar(c.name) === normalizar(empresa.nome)
      )

      if (modo === 'teste') {
        resultados.push({
          empresa: empresa.nome,
          status: empresaExistente ? 'empresa_ja_existe' : 'seria_criada_e_vinculada',
          lead_id: lead.id,
          contato_id: contato.id,
        })
        continue
      }

      let empresaId = empresaExistente?.id

      if (!empresaId) {
        const criada = await kommoFetch('/companies', {
          method: 'POST',
          body: JSON.stringify([
            {
              name: empresa.nome,
              custom_fields_values: [{ field_id: CAMPO_CNPJ_ID, values: [{ value: empresa.cnpj }] }],
            },
          ]),
        })
        empresaId = criada._embedded?.companies?.[0]?.id
      }

      if (!empresaId) throw new Error('Não foi possível obter o ID da empresa criada')

      // Vincula a empresa ao lead
      await kommoFetch(`/leads/${lead.id}/link`, {
        method: 'POST',
        body: JSON.stringify([{ to_entity_id: empresaId, to_entity_type: 'companies' }]),
      })

      // Vincula a empresa ao contato
      await kommoFetch(`/contacts/${contato.id}/link`, {
        method: 'POST',
        body: JSON.stringify([{ to_entity_id: empresaId, to_entity_type: 'companies' }]),
      })

      resultados.push({ empresa: empresa.nome, status: 'ok', empresa_id: empresaId, lead_id: lead.id, contato_id: contato.id })
    } catch (err: any) {
      resultados.push({ empresa: empresa.nome, status: 'erro', erro: err.message })
    }
  }

  const resumo = {
    total: resultados.length,
    ok: resultados.filter(r => r.status === 'ok').length,
    seria_criada_e_vinculada: resultados.filter(r => r.status === 'seria_criada_e_vinculada').length,
    empresa_ja_existe: resultados.filter(r => r.status === 'empresa_ja_existe').length,
    erros: resultados.filter(r => r.status === 'erro').length,
    nao_encontrados: resultados.filter(r => r.status === 'lead_nao_encontrado' || r.status === 'contato_nao_encontrado').length,
  }

  return NextResponse.json({ ok: true, modo, resumo, resultados })
}
