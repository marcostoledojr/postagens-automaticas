/**
 * POST /api/posts/cadastrar-publicado?chave=CRON_SECRET
 * Cadastra um post que já foi publicado diretamente no LinkedIn (fora do
 * sistema), usando o texto exato fornecido — sem gerar nada via IA.
 * Uso único (ex.: post de aniversário da Oficina1 publicado manualmente),
 * pra ele aparecer nos destaques do email semanal com o link certo.
 *
 * Body: { texto, tema_nome, data_agendada (ISO), linkedin_post_id? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const chave = req.nextUrl.searchParams.get('chave')
  if (chave !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { texto, tema_nome, data_agendada, linkedin_post_id } = body

    if (!texto || !tema_nome || !data_agendada) {
      return NextResponse.json({ erro: 'texto, tema_nome e data_agendada são obrigatórios' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: postSalvo, error } = await supabase.from('posts').insert({
      tema_nome,
      texto,
      status: 'publicado',
      data_agendada,
      linkedin_post_id: linkedin_post_id ?? null,
    }).select().single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, post: postSalvo })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
