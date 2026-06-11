import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const body = await req.json()
  const { id } = params

  // Se está aprovando, guarda o texto original se foi editado
  if (body.status === 'aprovado' && body.texto) {
    const { data: original } = await supabase
      .from('posts')
      .select('texto')
      .eq('id', id)
      .single()

    if (original && original.texto !== body.texto) {
      body.texto_original = original.texto
      body.editado_por_usuario = true
    }
  }

  const { data, error } = await supabase
    .from('posts')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { error } = await supabase.from('posts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
