import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * Extrai o URN do LinkedIn de uma URL de post.
 * Formatos suportados:
 *   https://www.linkedin.com/feed/update/urn:li:share:123456/
 *   https://www.linkedin.com/feed/update/urn:li:ugcPost:123456/
 *   https://www.linkedin.com/posts/usuario_titulo-activity-123456-xxxx/
 *   urn:li:share:123456  (URN direto)
 */
function extrairUrn(input: string): string | null {
  const trimmed = input.trim()

  // URN direto
  if (trimmed.startsWith('urn:li:')) return trimmed.replace(/\/$/, '')

  // URL com URN embutida (formato /feed/update/urn:li:...)
  const matchUrn = trimmed.match(/urn:li:(share|ugcPost|activity):\d+/)
  if (matchUrn) return matchUrn[0]

  // URL nova: /posts/usuario_titulo-activity-1234567890-xxxx/
  const matchActivity = trimmed.match(/activity-(\d{15,})-/)
  if (matchActivity) return `urn:li:share:${matchActivity[1]}`

  return null
}

export async function PATCH(req: NextRequest) {
  const { postId, linkedinUrl } = await req.json()

  if (!postId || !linkedinUrl) {
    return NextResponse.json({ erro: 'postId e linkedinUrl são obrigatórios' }, { status: 400 })
  }

  const urn = extrairUrn(linkedinUrl)
  if (!urn) {
    return NextResponse.json(
      { erro: 'URL inválida. Cole a URL completa do post do LinkedIn ou o URN direto.' },
      { status: 400 }
    )
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('posts')
    .update({ linkedin_post_id: urn })
    .eq('id', postId)

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, urn })
}
