/**
 * Publicação no LinkedIn via Make.com
 *
 * O Make.com atua como intermediário:
 * 1. Recebe o webhook com o conteúdo do post
 * 2. Faz a autenticação OAuth com o LinkedIn
 * 3. Publica o post no perfil de Marcos
 *
 * Esta abordagem elimina a necessidade de gerenciar tokens OAuth diretamente
 */

// ID numérico da página Oficina1 no LinkedIn
const OFICINA1_ORG_URN = 'urn:li:organization:2958968'

type PostParaPublicar = {
  id: string
  texto: string
  hashtags: string[]
  imagem_url: string | null
  tema_nome: string
}

/**
 * Detecta @Oficina1 no texto e retorna dados de menção para a API do LinkedIn.
 * O LinkedIn precisa da posição exata do texto a ser marcado como menção.
 */
function extrairMencoes(texto: string) {
  const mencoes: { urn: string; start: number; length: number }[] = []
  const regex = /@Oficina1/gi
  let match
  while ((match = regex.exec(texto)) !== null) {
    mencoes.push({
      urn: OFICINA1_ORG_URN,
      start: match.index,
      length: match[0].length,
    })
  }
  return mencoes
}

export async function publicarPostLinkedIn(post: PostParaPublicar): Promise<string> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL
  if (!webhookUrl) throw new Error('MAKE_WEBHOOK_URL não configurada')

  // Monta o texto completo com hashtags
  const hashtagsTexto = post.hashtags?.length > 0
    ? '\n\n' + post.hashtags.join(' ')
    : ''
  const textoCompleto = post.texto + hashtagsTexto

  // Detecta menções ao @Oficina1 para o LinkedIn API
  const mencoes = extrairMencoes(textoCompleto)

  const payload = {
    post_id: post.id,
    texto: textoCompleto,
    imagem_url: post.imagem_url ?? null,
    tema: post.tema_nome,
    timestamp: new Date().toISOString(),
    // Menções para o módulo LinkedIn do Make.com (campo "Mentioned Entities")
    mencoes: mencoes.length > 0 ? mencoes : undefined,
    // Primeiro URN de menção para mapeamento simples no Make.com
    mencao_urn: mencoes.length > 0 ? mencoes[0].urn : undefined,
    mencao_start: mencoes.length > 0 ? mencoes[0].start : undefined,
    mencao_length: mencoes.length > 0 ? mencoes[0].length : undefined,
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Make.com webhook error: ${res.status} - ${err}`)
  }

  const data = await res.json().catch(() => ({}))

  // O Make.com retorna o ID do post do LinkedIn no campo linkedin_post_id
  const linkedinId = data.linkedin_post_id ?? `make_${Date.now()}`

  return linkedinId
}
