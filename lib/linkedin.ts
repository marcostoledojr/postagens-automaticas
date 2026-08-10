/**
 * Publicação no LinkedIn via API direta
 *
 * Fluxo para posts COM imagem:
 * 1. Busca access token e personUrn da tabela `configuracoes`
 * 2. Inicializa upload da imagem  → POST /rest/images?action=initializeUpload
 * 3. Faz upload do binário        → PUT {uploadUrl}  (sem Authorization)
 * 4. Cria o post com imageUrn     → POST /rest/posts
 *
 * Fluxo para posts SEM imagem:
 * 1. Busca access token e personUrn da tabela `configuracoes`
 * 2. Cria o post diretamente      → POST /rest/posts
 */

import { createClient } from './supabase-server'

const LINKEDIN_API_BASE = 'https://api.linkedin.com'
const LINKEDIN_VERSION = '202605'

// URN da página Oficina1 no LinkedIn
const OFICINA1_ORG_URN = 'urn:li:organization:2958968'
const OFICINA1_ORG_NAME = 'Oficina1'

type PostParaPublicar = {
  id: string
  texto: string
  hashtags: string[]
  imagem_url: string | null
  tema_nome: string
}

// ─────────────────────────────────────────────────────────────
// Credenciais
// ─────────────────────────────────────────────────────────────

/**
 * Busca o access token e person URN do LinkedIn da tabela configuracoes.
 */
async function buscarCredenciaisLinkedIn(): Promise<{
  accessToken: string
  personUrn: string
}> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['linkedin_access_token', 'linkedin_person_urn'])

  if (error) throw new Error(`Erro ao buscar credenciais LinkedIn: ${error.message}`)

  const tokenRow = data?.find((r) => r.chave === 'linkedin_access_token')
  const urnRow = data?.find((r) => r.chave === 'linkedin_person_urn')

  if (!tokenRow?.valor)
    throw new Error('linkedin_access_token não encontrado na tabela configuracoes')
  if (!urnRow?.valor)
    throw new Error('linkedin_person_urn não encontrado na tabela configuracoes')

  return {
    accessToken: tokenRow.valor,
    personUrn: urnRow.valor,
  }
}

// ─────────────────────────────────────────────────────────────
// Texto e menções
// ─────────────────────────────────────────────────────────────

/**
 * Converte @Oficina1 no texto para o formato de menção inline do LinkedIn.
 * Ex: "@Oficina1" → "@[Oficina1](urn:li:organization:2958968)"
 */
function substituirMencoes(texto: string): string {
  return texto.replace(
    /@Oficina1/gi,
    `@[${OFICINA1_ORG_NAME}](${OFICINA1_ORG_URN})`
  )
}

// ─────────────────────────────────────────────────────────────
// Upload de imagem (3 etapas)
// ─────────────────────────────────────────────────────────────

/**
 * Etapa 1: Registra o upload e obtém a uploadUrl + imageUrn.
 */
async function inicializarUploadImagem(
  accessToken: string,
  personUrn: string
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const res = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: personUrn },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn initializeUpload falhou: ${res.status} - ${err}`)
  }

  const data = await res.json()
  return {
    uploadUrl: data.value.uploadUrl,
    imageUrn: data.value.image, // ex: "urn:li:image:C4E10AQFoyyAjHPMQuQ"
  }
}

/**
 * Etapas 2+3: Baixa o binário da imagem da URL pública e faz PUT no uploadUrl.
 * IMPORTANTE: O uploadUrl do LinkedIn NÃO aceita o header Authorization —
 * a URL já contém autenticação embutida.
 */
async function fazerUploadBinario(uploadUrl: string, imagemUrl: string): Promise<void> {
  // Baixa a imagem do Supabase Storage
  const imgRes = await fetch(imagemUrl)
  if (!imgRes.ok)
    throw new Error(`Falha ao baixar imagem do Storage: ${imgRes.status} (${imagemUrl})`)

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const buffer = await imgRes.arrayBuffer()

  // Envia o binário para o LinkedIn
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer,
  })

  // LinkedIn retorna 201 no sucesso; alguns casos retornam 200
  if (!uploadRes.ok && uploadRes.status !== 201) {
    const err = await uploadRes.text()
    throw new Error(`LinkedIn upload binário falhou: ${uploadRes.status} - ${err}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Criação do post
// ─────────────────────────────────────────────────────────────

/**
 * Cria o post no LinkedIn e retorna o URN do post publicado.
 * O URN vem no header `x-restli-id` da resposta (não no body).
 */
async function criarPost(
  accessToken: string,
  personUrn: string,
  commentary: string,
  imageUrn?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    author: personUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  if (imageUrn) {
    body.content = {
      media: {
        id: imageUrn,
        altText: 'Imagem do post',
      },
    }
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn createPost falhou: ${res.status} - ${err}`)
  }

  // LinkedIn retorna 201 com o URN do post no header x-restli-id
  const postUrn = res.headers.get('x-restli-id')
  if (!postUrn) throw new Error('LinkedIn não retornou x-restli-id no response')

  return postUrn // ex: "urn:li:share:6844785523593134080"
}

// ─────────────────────────────────────────────────────────────
// Ponto de entrada principal
// ─────────────────────────────────────────────────────────────

/**
 * Verifica se um post ainda existe/está visível no LinkedIn, consultando a
 * própria API (não a página pública, que exige login e pode dar falso negativo).
 * Usado antes de incluir o link "Ver post completo" no email semanal.
 */
export async function verificarPostExiste(linkedinPostId: string): Promise<boolean> {
  try {
    const { accessToken } = await buscarCredenciaisLinkedIn()
    const urnCodificado = encodeURIComponent(linkedinPostId)
    const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts/${urnCodificado}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': LINKEDIN_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function publicarPostLinkedIn(post: PostParaPublicar): Promise<string> {
  // 1. Credenciais do LinkedIn
  const { accessToken, personUrn } = await buscarCredenciaisLinkedIn()

  // 2. Texto completo com hashtags
  const hashtagsTexto =
    post.hashtags?.length > 0 ? '\n\n' + post.hashtags.join(' ') : ''
  const textoCompleto = post.texto + hashtagsTexto

  // 3. Formatar menções para o LinkedIn
  const commentary = substituirMencoes(textoCompleto)

  // 4. Upload de imagem (se houver)
  let imageUrn: string | undefined
  if (post.imagem_url) {
    const { uploadUrl, imageUrn: urn } = await inicializarUploadImagem(
      accessToken,
      personUrn
    )
    await fazerUploadBinario(uploadUrl, post.imagem_url)
    imageUrn = urn
  }

  // 5. Criar post
  const postUrn = await criarPost(accessToken, personUrn, commentary, imageUrn)

  return postUrn
}
