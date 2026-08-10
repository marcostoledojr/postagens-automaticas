/**
 * GET /api/kommo-import/executar?chave=SEU_CRON_SECRET&modo=teste|real
 * Importação pontual de 29 leads (planilha de oportunidades) para o Kommo:
 * cria um lead por empresa no funil OFICINA1, etapa "Closed - lost", com a
 * tag "Importação Prospecta" e um contato vinculado (nome, telefone, email, CNPJ).
 *
 * modo=teste (padrão): só verifica duplicados e mostra o que seria feito, não grava nada.
 * modo=real: cria de fato os leads que não forem duplicados.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolverPipelineEStatus } from '@/lib/kommo'

export const maxDuration = 60

const NOME_PIPELINE = 'OFICINA1'
const NOME_STATUS = 'Closed - lost'
const NOME_TAG = 'Importação Prospecta'
const CAMPO_CNPJ_ID = 447050

const LEADS = [
  { empresa: 'Marcon Industria Metalurgica', head: 'Tiago Santos de Araujo', telefone: '(14) 99735-0695', email: 'tiago@marcon.ind.br', cnpj: '57211997000146' },
  { empresa: 'Alutec', head: 'Rosana Bueno', telefone: '(19) 2106-9114', email: 'alutec@alutecgrupo.com.br', cnpj: '54371133000101' },
  { empresa: 'All Nutri Alimentos Ltda', head: 'Frederico Duarte', telefone: '(62) 99976-7269', email: 'frederico@arrozefeijaobarao.com.br', cnpj: '05965693000170' },
  { empresa: 'Emtec', head: 'Alessandro Roberto Cardoso', telefone: '(17) 3500-3150', email: 'alessandro.cardoso@emtec.eng.br', cnpj: '04167711000106' },
  { empresa: 'Kamut Alimentos', head: 'Lucas Vieira dos Santos Neto', telefone: '(62) 3513-8300', email: 'ti@kamutalimentos.com.br', cnpj: '73665085000109' },
  { empresa: 'Tupan Assentos', head: 'Rafael Gonçalves', telefone: '(11) 3697-5100', email: 'suporte@tupan.ind.br', cnpj: '50516731000162' },
  { empresa: 'Implatec', head: 'Thiago Fischer', telefone: '(47) 3425-2256', email: 'thiago.gti@implatec.com.br', cnpj: '00716481000136' },
  { empresa: 'Chiaperini Industrial Ltda', head: 'João Carlos Soares', telefone: '(16) 39544-9400', email: 'kall.ti@chiaperini.com.br', cnpj: '59064766000182' },
  { empresa: 'Bardella', head: 'Célio', telefone: '(11) 4961-1116', email: 'celio@bardella.ind.br', cnpj: '00890462000121' },
  { empresa: 'Dryeration', head: 'Edson Chiesa Batista', telefone: '(51) 3778-6272', email: 'informatica@dryeration.com.br', cnpj: '87744546000135' },
  { empresa: 'Manteiga Aviacao', head: 'Matheus Rodrigues', telefone: '(35) 3539-8100', email: 'matheus@laticiniosaviacao.com.br', cnpj: '61365557000110' },
  { empresa: 'Fricon', head: 'Josafa Soares', telefone: '(31) 98747-6030', email: 'josafa@fricon.ind.br', cnpj: '19791995000184' },
  { empresa: 'Dinamica Group', head: 'Paulo Sousa', telefone: '(11) 99216-6815', email: 'paulo.sousa@dinamicagroup.com.br', cnpj: '61784823000140' },
  { empresa: 'Frigorifico Silva Industria E Comercio Ltda', head: 'Marcio Cardoso', telefone: '(55) 2103-2534', email: 'marcio.cardoso@frigorificosilva.com.br', cnpj: '88728027000146' },
  { empresa: 'Afin Assessoria Fiscal E Contabil', head: 'Jaime de Jesus Albuino', telefone: '(19) 98263-1572', email: 'jalbunio@afin.com.br', cnpj: '00802291000131' },
  { empresa: 'Adm Comercio De Alimentos', head: 'Alexandre Marrero Rocha', telefone: '(11) 99637-2271', email: 'alexandre.ti@andiamo.com.br', cnpj: '67886622000130' },
  { empresa: 'Industria Alltec', head: 'Antônio Carvalho', telefone: '(12) 3931-4178', email: 'antonio.carvalho@allteccomposites.com.br', cnpj: '00745309000100' },
  { empresa: 'Donana Alimentos', head: 'Marcos Molgora', telefone: '(67) 98405-9501', email: 'donana.ti@terra.com.br', cnpj: '09244411000105' },
  { empresa: 'Selovac', head: 'Rodrigo de Azevedo', telefone: '(11) 96471-6299', email: 'ti@globalvacbrasil.com.br', cnpj: '62700182000160' },
  { empresa: 'Excel Produtos Eletronicos Ltda', head: 'Edson Dias', telefone: '(11) 99823-7603', email: 'ti@excelft.com', cnpj: '64579782000148' },
  { empresa: 'Grupo Ematex', head: 'Cláudio Lacerda', telefone: '(31) 98432-4918', email: 'lacerda@ematex.com.br', cnpj: '07590753000143' },
  { empresa: 'Pronatec', head: 'Alex Morelli', telefone: '(19) 97085-8940', email: 'ti@pronatec.com.br', cnpj: '05058525000100' },
  { empresa: 'Jomhedica Norte', head: 'Matheus Petry', telefone: '(51) 2108-0900', email: 'matheus.petry@jomhedica.com.br', cnpj: '02429547000132' },
  { empresa: 'Pinfer Metalurgica', head: 'Luis Jeller', telefone: '(41) 3347-1183', email: 'luis@pinfer.com.br', cnpj: '03833260000136' },
  { empresa: 'Plasson Livestock Division', head: 'Tiago Carolle', telefone: '(48) 3431-9500', email: 'ti@plasson.com.br', cnpj: '01628313000151' },
  { empresa: 'S.R. Embalagens Plasticas', head: 'Fábio Aparecido de Castro', telefone: '(17) 3321-2222', email: 'fcastro@srembalagens.com.br', cnpj: '50418557000115' },
  { empresa: 'Metalurgica Forma Ltda', head: 'Douglas Hecher', telefone: '(54) 3025-9711', email: 'douglas@formautilidades.com.br', cnpj: '90357534000162' },
  { empresa: 'Polimetal', head: 'Bruno Jesus Batista Bento', telefone: '(17) 3355-2800', email: 'bruno.bento@polimental.ind.br', cnpj: '58568130000105' },
  { empresa: 'Camaco', head: 'Felipe Ceneri', telefone: '(11) 97464-2706', email: 'fceneri@amvian.com.br', cnpj: '11701069000169' },
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

async function jaExiste(nomeEmpresa: string): Promise<boolean> {
  const data = await kommoFetch(`/leads?query=${encodeURIComponent(nomeEmpresa)}&limit=10`)
  const leads = data._embedded?.leads ?? []
  return leads.some((l: any) => normalizar(l.name) === normalizar(nomeEmpresa))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const modo = searchParams.get('modo') === 'real' ? 'real' : 'teste'

  try {
    const { pipelineId, statusId } = await resolverPipelineEStatus(NOME_PIPELINE, NOME_STATUS)

    const resultados: any[] = []

    for (const item of LEADS) {
      try {
        const duplicado = await jaExiste(item.empresa)
        if (duplicado) {
          resultados.push({ empresa: item.empresa, status: 'pulado_duplicado' })
          continue
        }

        if (modo === 'teste') {
          resultados.push({ empresa: item.empresa, status: 'seria_criado' })
          continue
        }

        const payload = [
          {
            name: item.empresa,
            pipeline_id: pipelineId,
            status_id: statusId,
            _embedded: {
              tags: [{ name: NOME_TAG }],
              contacts: [
                {
                  name: item.head,
                  custom_fields_values: [
                    { field_code: 'PHONE', values: [{ value: item.telefone, enum_code: 'WORK' }] },
                    { field_code: 'EMAIL', values: [{ value: item.email, enum_code: 'WORK' }] },
                    { field_id: CAMPO_CNPJ_ID, values: [{ value: item.cnpj }] },
                  ],
                },
              ],
            },
          },
        ]

        const criado = await kommoFetch('/leads/complex', { method: 'POST', body: JSON.stringify(payload) })
        resultados.push({ empresa: item.empresa, status: 'criado', lead_id: criado?.[0]?.id ?? null })
      } catch (err: any) {
        resultados.push({ empresa: item.empresa, status: 'erro', erro: err.message })
      }
    }

    const resumo = {
      total: resultados.length,
      criados: resultados.filter(r => r.status === 'criado').length,
      seria_criado: resultados.filter(r => r.status === 'seria_criado').length,
      pulados_duplicados: resultados.filter(r => r.status === 'pulado_duplicado').length,
      erros: resultados.filter(r => r.status === 'erro').length,
    }

    return NextResponse.json({ ok: true, modo, resumo, resultados })
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
