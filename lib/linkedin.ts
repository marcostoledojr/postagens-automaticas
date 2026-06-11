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

type PostParaPublicar = {
  id: string
  texto: string
  hashtags: string[]
  imagem_url: string | null
  tema_nome: string
}

export async function publicarPostLinkedIn(post: PostParaPublicar): Promise<string> {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL
  if (!webhookUrl) throw new Error('MAKE_WEBHOOK_URL não configurada')

  // Monta o texto completo com hashtags
  const hashtagsTexto = post.hashtags?.length > 0
    ? '\n\n' + post.hashtags.join(' ')
    : ''
  const textoCompleto = post.texto + hashtagsTexto

  const payload = {
    post_id: post.id,
    texto: textoCompleto,
    imagem_url: post.imagem_url ?? null,
    tema: post.tema_nome,
    timestamp: new Date().toISOString(),
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
