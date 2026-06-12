import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { publicarPostLinkedIn } from '@/lib/linkedin'
import { enviarAlertaErro } from '@/lib/email'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { id } = params

  // Busca o post
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !post) {
    return NextResponse.json({ erro: 'Post não encontrado' }, { status: 404 })
  }

  if (post.status !== 'agendado') {
    return NextResponse.json({ erro: 'Post precisa estar agendado (aprovado) para publicar' }, { status: 400 })
  }

  try {
    const linkedinId = await publicarPostLinkedIn(post)

    const { error: updateError } = await supabase
      .from('posts')
      .update({
        status: 'publicado',
        publicado_em: new Date().toISOString(),
        linkedin_post_id: linkedinId,
      })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ ok: true, linkedin_post_id: linkedinId })
  } catch (err: any) {
    await supabase
      .from('posts')
      .update({ status: 'erro', erro_publicacao: err.message })
      .eq('id', id)

    await enviarAlertaErro({
      fluxo: 'Publicação LinkedIn',
      erro: err.message,
      detalhes: `Post ID: ${id} | Tema: ${post.tema_nome} | Agendado: ${post.data_agendada}`,
    })

    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
