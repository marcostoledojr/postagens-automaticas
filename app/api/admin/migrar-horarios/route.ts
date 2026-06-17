/**
 * GET /api/admin/migrar-horarios?secret=marcos2026secreto
 * Rota temporária de migração: ajusta posts 'agendado' de 09h/14h BRT para 08h/13h BRT
 * Subtraindo 1h do data_agendada e atualizando horario_publicacao
 * REMOVER após uso.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient()

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, tema_nome, data_agendada, horario_publicacao')
    .eq('status', 'agendado')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  if (!posts || posts.length === 0) return NextResponse.json({ ok: true, mensagem: 'Nenhum post agendado para migrar', migrados: 0 })

  const resultados = []
  for (const post of posts) {
    const antigo = new Date(post.data_agendada)
    const novo = new Date(antigo.getTime() - 60 * 60 * 1000) // -1h

    const horarioNovo =
      post.horario_publicacao === '09:00' ? '08:00' :
      post.horario_publicacao === '14:00' ? '13:00' :
      post.horario_publicacao

    const { error: err } = await supabase
      .from('posts')
      .update({ data_agendada: novo.toISOString(), horario_publicacao: horarioNovo })
      .eq('id', post.id)

    resultados.push({
      tema: post.tema_nome,
      de: antigo.toISOString(),
      para: novo.toISOString(),
      horario: `${post.horario_publicacao} → ${horarioNovo}`,
      ok: !err,
      erro: err?.message,
    })
  }

  return NextResponse.json({ ok: true, migrados: resultados.length, resultados })
}
