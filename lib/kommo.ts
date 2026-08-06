/**
 * Cliente Kommo — leitura de leads perdidos para o email semanal.
 * Usa token de longa duração (long-lived token), sem fluxo OAuth.
 *
 * Requer no .env.local:
 *   KOMMO_API_URL=https://SEUDOMINIO.kommo.com/api/v4
 *   KOMMO_LONG_LIVED_TOKEN=eyJ...
 */

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function kommoFetch(path: string): Promise<any> {
  const apiUrl = process.env.KOMMO_API_URL
  const token = process.env.KOMMO_LONG_LIVED_TOKEN

  if (!apiUrl) throw new Error('KOMMO_API_URL não configurada')
  if (!token) throw new Error('KOMMO_LONG_LIVED_TOKEN não configurado')

  const res = await fetch(`${apiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new Error(`Kommo API ${path} falhou: ${res.status} - ${corpo}`)
  }

  // 204 (sem conteúdo) acontece quando não há resultados
  if (res.status === 204) return { _embedded: {} }

  return res.json()
}

// ─── Resolve pipeline + status pelo nome ────────────────────────────────────

export async function resolverPipelineEStatus(
  nomePipeline: string,
  nomeStatus: string
): Promise<{ pipelineId: number; statusId: number }> {
  const data = await kommoFetch('/leads/pipelines')
  const pipelines = data._embedded?.pipelines ?? []

  const pipeline = pipelines.find((p: any) => normalizar(p.name) === normalizar(nomePipeline))
  if (!pipeline) {
    const nomes = pipelines.map((p: any) => p.name).join(', ')
    throw new Error(`Funil "${nomePipeline}" não encontrado no Kommo. Funis disponíveis: ${nomes || '(nenhum)'}`)
  }

  const statuses = pipeline._embedded?.statuses ?? []
  const status =
    statuses.find((s: any) => normalizar(s.name) === normalizar(nomeStatus)) ??
    statuses.find((s: any) => normalizar(s.name).includes('perdid') || normalizar(s.name).includes('lost'))

  if (!status) {
    const nomes = statuses.map((s: any) => s.name).join(', ')
    throw new Error(`Etapa "${nomeStatus}" não encontrada no funil "${nomePipeline}". Etapas disponíveis: ${nomes || '(nenhuma)'}`)
  }

  return { pipelineId: pipeline.id, statusId: status.id }
}

// ─── Busca leads perdidos + emails dos contatos vinculados ─────────────────

export type LeadPerdido = {
  leadId: number
  leadNome: string
  contatoId: number | null
  email: string | null
}

export async function buscarLeadsPerdidos(
  nomePipeline: string,
  nomeStatus: string
): Promise<LeadPerdido[]> {
  const { pipelineId, statusId } = await resolverPipelineEStatus(nomePipeline, nomeStatus)

  const leads: any[] = []
  let page = 1
  const limit = 250

  while (true) {
    const data = await kommoFetch(
      `/leads?filter[statuses][0][pipeline_id]=${pipelineId}&filter[statuses][0][status_id]=${statusId}&with=contacts&limit=${limit}&page=${page}`
    )
    const pagina = data._embedded?.leads ?? []
    leads.push(...pagina)
    if (pagina.length < limit) break
    page++
    if (page > 20) break // trava de segurança contra loop infinito
  }

  if (leads.length === 0) return []

  // Coleta o contato principal de cada lead
  const contatoIds = new Set<number>()
  for (const lead of leads) {
    const contatos = lead._embedded?.contacts ?? []
    const principal = contatos.find((c: any) => c.is_main) ?? contatos[0]
    if (principal) contatoIds.add(principal.id)
  }

  // Busca detalhes dos contatos em lotes (email fica em custom_fields_values)
  const emailPorContato = new Map<number, string>()
  const idsArray = Array.from(contatoIds)
  const tamanhoLote = 100

  for (let i = 0; i < idsArray.length; i += tamanhoLote) {
    const lote = idsArray.slice(i, i + tamanhoLote)
    const filtro = lote.map(id => `filter[id][]=${id}`).join('&')
    const data = await kommoFetch(`/contacts?${filtro}&limit=${tamanhoLote}`)
    const contatos = data._embedded?.contacts ?? []
    for (const c of contatos) {
      const campoEmail = (c.custom_fields_values ?? []).find(
        (f: any) => f.field_code === 'EMAIL' || normalizar(f.field_name ?? '') === 'email'
      )
      const email = campoEmail?.values?.[0]?.value
      if (email) emailPorContato.set(c.id, email)
    }
  }

  return leads.map((lead: any) => {
    const contatos = lead._embedded?.contacts ?? []
    const principal = contatos.find((c: any) => c.is_main) ?? contatos[0]
    const contatoId = principal?.id ?? null
    return {
      leadId: lead.id,
      leadNome: lead.name,
      contatoId,
      email: contatoId ? emailPorContato.get(contatoId) ?? null : null,
    }
  })
}
