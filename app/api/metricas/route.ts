import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buscarResumoTemas, getLinkedInStatus, getLinkedInAnalyticsStatus, analisarMelhoresHorarios } from '@/lib/metricas'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const dias = Number(searchParams.get('dias') ?? '30')
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: metricas }, resumoTemas, linkedinStatus, linkedinAnalyticsStatus, melhoresHorarios] = await Promise.all([
    supabase
      .from('metricas')
      .select('*, posts(texto, tema_nome, publicado_em, horario_publicacao)')
      .gte('coletado_em', desde)
      .order('score_engajamento', { ascending: false })
      .limit(50),
    buscarResumoTemas(dias),
    getLinkedInStatus(),
    getLinkedInAnalyticsStatus(),
    analisarMelhoresHorarios(Math.max(dias, 60)),
  ])

  const postsComMetricas = (metricas ?? []).map((m: any) => ({
    post_id: m.post_id,
    texto: m.posts?.texto ?? '',
    tema_nome: m.posts?.tema_nome ?? '',
    publicado_em: m.posts?.publicado_em ?? '',
    horario: m.posts?.horario_publicacao ?? '',
    impressoes: m.impressoes ?? 0,
    curtidas: m.curtidas ?? 0,
    comentarios: m.comentarios ?? 0,
    compartilhamentos: m.compartilhamentos ?? 0,
    cliques: m.cliques ?? 0,
    salvamentos: m.salvamentos ?? 0,
    envios: m.envios ?? 0,
    seguidores_obtidos: m.seguidores_obtidos ?? 0,
    visualizacoes_perfil: m.visualizacoes_perfil ?? 0,
    score_engajamento: m.score_engajamento,
  }))

  return NextResponse.json({
    posts: postsComMetricas,
    temas: resumoTemas,
    horarios: melhoresHorarios,
    linkedin: linkedinStatus,
    linkedinAnalytics: linkedinAnalyticsStatus,
  })
}
