'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, Heart, MessageCircle, Share2, Eye, Users, Award } from 'lucide-react'

type MetricaPost = {
  post_id: string
  texto: string
  tema_nome: string
  publicado_em: string
  impressoes: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  cliques: number
  score_engajamento: number
}

type ResumoTema = {
  tema_nome: string
  total_posts: number
  media_impressoes: number
  media_curtidas: number
  media_comentarios: number
  media_compartilhamentos: number
  score_medio: number
}

export default function Analytics() {
  const [metricas, setMetricas] = useState<MetricaPost[]>([])
  const [resumoTemas, setResumoTemas] = useState<ResumoTema[]>([])
  const [periodo, setPeriodo] = useState('30')
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const res = await fetch(`/api/metricas?dias=${periodo}`)
    const json = await res.json()
    setMetricas(json.posts ?? [])
    setResumoTemas(json.temas ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [periodo])

  const totais = metricas.reduce((acc, m) => ({
    impressoes: acc.impressoes + m.impressoes,
    curtidas: acc.curtidas + m.curtidas,
    comentarios: acc.comentarios + m.comentarios,
    compartilhamentos: acc.compartilhamentos + m.compartilhamentos,
    cliques: acc.cliques + m.cliques,
  }), { impressoes: 0, curtidas: 0, comentarios: 0, compartilhamentos: 0, cliques: 0 })

  const melhorPost = metricas.sort((a, b) => b.score_engajamento - a.score_engajamento)[0]
  const melhorTema = [...resumoTemas].sort((a, b) => b.score_medio - a.score_medio)[0]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">Acompanhe o engajamento e o desempenho dos seus posts.</p>
        </div>
        <select
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Impressões', value: totais.impressoes, icon: Eye, color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Curtidas', value: totais.curtidas, icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Comentários', value: totais.comentarios, icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Compartilhamentos', value: totais.compartilhamentos, icon: Share2, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Cliques', value: totais.cliques, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`${bg} p-2 rounded-lg w-fit mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Melhor post */}
        {melhorPost && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award size={16} className="text-amber-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Melhor Post do Período</h3>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {melhorPost.tema_nome}
            </span>
            <p className="text-sm text-slate-700 mt-2 line-clamp-3">{melhorPost.texto}</p>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span>👁 {melhorPost.impressoes.toLocaleString('pt-BR')}</span>
              <span>❤️ {melhorPost.curtidas}</span>
              <span>💬 {melhorPost.comentarios}</span>
              <span>🔄 {melhorPost.compartilhamentos}</span>
            </div>
          </div>
        )}

        {/* Melhor tema */}
        {melhorTema && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-green-500" />
              <h3 className="font-semibold text-slate-800 text-sm">Tema com Maior Engajamento</h3>
            </div>
            <p className="text-2xl font-bold text-slate-900">{melhorTema.tema_nome}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-slate-900">{Math.round(melhorTema.media_impressoes).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-slate-500">Impressões médias</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-slate-900">{Math.round(melhorTema.media_curtidas)}</p>
                <p className="text-xs text-slate-500">Curtidas médias</p>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-2 font-medium">
              ✓ A IA priorizará este tema nos próximos posts
            </p>
          </div>
        )}
      </div>

      {/* Desempenho por tema */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Desempenho por Tema</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {resumoTemas.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              Dados disponíveis após os primeiros posts publicados.
            </div>
          ) : (
            resumoTemas.map(tema => (
              <div key={tema.tema_nome} className="px-6 py-4 flex items-center gap-6">
                <div className="w-48">
                  <p className="text-sm font-medium text-slate-800">{tema.tema_nome}</p>
                  <p className="text-xs text-slate-400">{tema.total_posts} posts</p>
                </div>
                <div className="flex-1 grid grid-cols-4 gap-4 text-xs text-center">
                  <div>
                    <p className="font-semibold text-slate-800">{Math.round(tema.media_impressoes).toLocaleString('pt-BR')}</p>
                    <p className="text-slate-400">Impressões</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{Math.round(tema.media_curtidas)}</p>
                    <p className="text-slate-400">Curtidas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{Math.round(tema.media_comentarios)}</p>
                    <p className="text-slate-400">Comentários</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{tema.score_medio.toFixed(2)}</p>
                    <p className="text-slate-400">Score</p>
                  </div>
                </div>
                {/* Barra de score */}
                <div className="w-24">
                  <div className="bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((tema.score_medio / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Últimos posts publicados */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Posts Recentes</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {metricas.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              Nenhum post publicado ainda neste período.
            </div>
          ) : (
            metricas.slice(0, 10).map(m => (
              <div key={m.post_id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-0.5">{m.tema_nome}</p>
                  <p className="text-sm text-slate-800 truncate">{m.texto.slice(0, 80)}...</p>
                </div>
                <div className="flex gap-4 text-xs text-slate-500 shrink-0">
                  <span title="Impressões">👁 {m.impressoes.toLocaleString('pt-BR')}</span>
                  <span title="Curtidas">❤️ {m.curtidas}</span>
                  <span title="Comentários">💬 {m.comentarios}</span>
                  <span title="Compartilhamentos">🔄 {m.compartilhamentos}</span>
                </div>
                <div className="w-16 text-right">
                  <span className="text-xs font-semibold text-blue-600">
                    {m.score_engajamento.toFixed(1)} pts
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
