import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { verificarPostExiste } from '@/lib/linkedin'

// Diagnóstico read-only: para um email_semanal pendente, mostra o
// linkedin_post_id de cada post incluído e o resultado da checagem
// verificarPostExiste (que decide se o post entra ou não no email).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('chave') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: 'chave inválida' }, { status: 401 })
  }
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, erro: 'informe ?id=' }, { status: 400 })

  const supabase = createClient()
  const { data: emailSemanal } = await supabase.from('emails_semanais').select('posts_incluidos').eq('id', id).single()
  if (!emailSemanal) return NextResponse.json({ ok: false, erro: 'não encontrado' }, { status: 404 })

  const postIds = (emailSemanal.posts_incluidos ?? []).map((d: any) => d.postId)
  const { data: posts, error: erroPosts } = await supabase.from('posts').select('id, linkedin_post_id, status, texto').in('id', postIds)

  if (searchParams.get('debug') === '1') {
    return NextResponse.json({ ok: true, postIds, totalEncontrados: posts?.length ?? 0, erroPosts })
  }

  const resultados = []
  for (const p of posts ?? []) {
    let existeNoLinkedin: boolean | null = null
    let erroChecagem: string | null = null
    if (p.linkedin_post_id) {
      try {
        existeNoLinkedin = await verificarPostExiste(p.linkedin_post_id)
      } catch (e: any) {
        erroChecagem = e.message
      }
    }
    resultados.push({
      id: p.id,
      status: p.status,
      linkedin_post_id: p.linkedin_post_id,
      existeNoLinkedin,
      erroChecagem,
    })
  }

  return NextResponse.json({ ok: true, resultados })
}
