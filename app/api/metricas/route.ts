import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarResumoTemas } from '@/lib/metricas'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const dias = Number(searchParams.get('dias') ?? '30')
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: metricas }, resumoTemas] = await Promise.all([
    supabase
      .from('metricas')
      .select('*, posts(texto, tema_nome, publicado_em)')
      .gte('coletado_em', desde)
      .order('score_engajamento', { ascending: false })
      .limit(50),
    buscarResumoTemas(dias),
  ])

  // Achata os dados para a UI
  const postsComMetricas = (metricas ?? []).map((m: any) => ({
    post_id: m.post_id,
    texto: m.posts?.texto ?? '',
    tema_nome: m.posts?.tema_nome ?? '',
    publicado_em: m.posts?.publicado_em ?? '',
    impressoes: m.impressoes,
    curtidas: m.curtidas,
    comentarios: m.comentarios,
    compartilhamentos: m.compartilhamentos,
    cliques: m.cliques,
    score_engajamento: m.score_engajamento,
  }))

  return NextResponse.json({ posts: postsComMetricas, temas: resumoTemas })
}
