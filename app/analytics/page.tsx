'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  TrendingUp, Heart, MessageCircle, Share2, Eye, Award,
  Zap, Clock, RefreshCw, Wifi, WifiOff, MousePointer
} from 'lucide-react'

type MetricaPost = {
  post_id: string
  texto: string
  tema_nome: string
  publicado_em: string
  horario: string
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
  media_cliques: number
  score_medio: number
}

type HorarioAnalise = {
  horario: string
  total_posts: number
  score_medio: number
  impressoes_medias: number
}

type LinkedInStatus = {
  conectado: boolean
  expiraEm: string | null
  diasRestantes: number | null
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Carregando analytics...</div>}>
      <Analytics />
    </Suspense>
  )
}

function Analytics() {
  const searchParams = useSearchParams()
  const [metricas, setMetricas] = useState<MetricaPost[]>([])
  const [resumoTemas, setResumoTemas] = useState<ResumoTema[]>([])
  const [horarios, setHorarios] = useState<HorarioAnalise[]>([])
  const [linkedin, setLinkedin] = useState<LinkedInStatus | null>(null)
  const [periodo, setPeriodo] = useState('30')
  const [loading, setLoading] = useState(true)
  const [notificacao, setNotificacao] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    const res = await fetch(`/api/metricas?dias=${periodo}`)
    const json = await res.json()
    setMetricas(json.posts ?? [])
    setResumoTemas(json.temas ?? [])
    setHorarios(json.horarios ?? [])
    setLinkedin(json.linkedin ?? null)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [periodo])

  useEffect(() => {
    const conectado = searchParams.get('conectado')
    const erro = searchParams.get('erro')
    if (conectado === '1') setNotificacao('✓ LinkedIn conectado com sucesso! Métricas serão coletadas automaticamente.')
    if (erro) {
      const msgs: Record<string, string> = {
        oauth_cancelado: 'Conexão cancelada.',
        token_falhou: 'Erro ao obter token do LinkedIn. Tente novamente.',
        credenciais_faltando: 'Credenciais do LinkedIn App não configuradas no Vercel.',
        salvar_token: 'Erro ao salvar token no banco. Tente novamente.',
      }
      setNotificacao(`⚠ ${msgs[erro] ?? 'Erro desconhecido.'}`)
    }
  }, [searchParams])

  const totais = metricas.reduce((acc, m) => ({
    impressoes: acc.impressoes + m.impressoes,
    curtidas: acc.curtidas + m.curtidas,
    comentarios: acc.comentarios + m.comentarios,
    compartilhamentos: acc.compartilhamentos + m.compartilhamentos,
    cliques: acc.cliques + m.cliques,
  }), { impressoes: 0, curtidas: 0, comentarios: 0, compartilhamentos: 0, cliques: 0 })

  const taxaEngajamentoGeral = totais.impressoes > 0
    ? ((totais.curtidas + totais.comentarios + totais.compartilhamentos + totais.cliques) / totais.impressoes * 100).toFixed(2)
    : null

  const melhorPost = [...metricas].sort((a, b) => b.score_engajamento - a.score_engajamento)[0]
  const melhorTema = [...resumoTemas].sort((a, b) => b.score_medio - a.score_medio)[0]
  const melhorHorario = horarios.length > 0 ? horarios[0] : null

  const maxScore = Math.max(...resumoTemas.map(t => t.score_medio), 0.01)
  const maxHorarioScore = Math.max(...horarios.map(h => h.score_medio), 0.01)

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Notificação OAuth */}
      {notificacao && (
        <div className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
          notificacao.startsWith('✓')
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {notificacao}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">Desempenho dos posts e aprendizado automático.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <button
            onClick={carregar}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Status LinkedIn */}
      <div className={`rounded-xl border p-4 mb-6 flex items-center justify-between ${
        linkedin?.conectado
          ? 'bg-green-50 border-green-200'
          : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          {linkedin?.conectado ? (
            <Wifi size={18} className="text-green-600" />
          ) : (
            <WifiOff size={18} className="text-slate-400" />
          )}
          <div>
            {linkedin?.conectado ? (
              <>
                <p className="text-sm font-medium text-green-800">LinkedIn conectado</p>
                <p className="text-xs text-green-600">
                  Token válido por mais {linkedin.diasRestantes} dias
                  {linkedin.diasRestantes !== null && linkedin.diasRestantes <= 10
                    ? ' — renovação em breve necessária'
                    : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">LinkedIn não conectado</p>
                <p className="text-xs text-slate-500">
                  Conecte para coletar impressões, cliques e taxa de engajamento real dos seus posts.
                </p>
              </>
            )}
          </div>
        </div>
        <a
          href="/api/auth/linkedin"
          className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
            linkedin?.conectado
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {linkedin?.conectado ? 'Reconectar' : 'Conectar LinkedIn'}
        </a>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Impressões',       value: totais.impressoes,       icon: Eye,           color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Curtidas',         value: totais.curtidas,         icon: Heart,         color: 'text-red-500',   bg: 'bg-red-50'    },
          { label: 'Comentários',      value: totais.comentarios,      icon: MessageCircle, color: 'text-blue-500',  bg: 'bg-blue-50'   },
          { label: 'Compartilhamentos',value: totais.compartilhamentos,icon: Share2,        color: 'text-green-500', bg: 'bg-green-50'  },
          { label: 'Cliques',          value: totais.cliques,          icon: MousePointer,  color: 'text-purple-500',bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`${bg} p-2 rounded-lg w-fit mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {value > 0 ? value.toLocaleString('pt-BR') : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Taxa de engajamento geral */}
      {taxaEngajamentoGeral && (
        <div className="bg-blue-600 text-white rounded-xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Taxa de Engajamento Geral</p>
            <p className="text-3xl font-bold mt-1">{taxaEngajamentoGeral}%</p>
            <p className="text-blue-200 text-xs mt-1">
              Média LinkedIn: ~2% (acima de 5% = excelente)
            </p>
          </div>
          <TrendingUp size={40} className="text-blue-300" />
        </div>
      )}

      {/* Grid: Melhor post + Melhor tema + Melhor horário */}
      <div className="grid grid-cols-3 gap-6 mb-6">

        {/* Melhor post */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-amber-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Melhor Post</h3>
          </div>
          {melhorPost ? (
            <>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {melhorPost.tema_nome}
              </span>
              <p className="text-sm text-slate-700 mt-2 line-clamp-3">{melhorPost.texto}</p>
              <div className="flex gap-3 mt-3 text-xs text-slate-500">
                {melhorPost.impressoes > 0 && <span>👁 {melhorPost.impressoes.toLocaleString('pt-BR')}</span>}
                <span>❤️ {melhorPost.curtidas}</span>
                <span>💬 {melhorPost.comentarios}</span>
              </div>
              <p className="text-xs font-semibold text-blue-600 mt-2">
                Score: {melhorPost.score_engajamento.toFixed(1)}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2">Dados disponíveis após posts publicados.</p>
          )}
        </div>

        {/* Melhor tema */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-green-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Tema com Mais Engajamento</h3>
          </div>
          {melhorTema ? (
            <>
              <p className="text-xl font-bold text-slate-900">{melhorTema.tema_nome}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {melhorTema.media_impressoes > 0 && (
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-slate-900">{Math.round(melhorTema.media_impressoes).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-slate-500">Impressões</p>
                  </div>
                )}
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-base font-bold text-slate-900">{Math.round(melhorTema.media_curtidas)}</p>
                  <p className="text-xs text-slate-500">Curtidas</p>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-3 font-medium">
                ✓ IA usa posts deste tema como referência
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2">Dados disponíveis após posts publicados.</p>
          )}
        </div>

        {/* Melhor horário */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-purple-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Melhor Horário</h3>
          </div>
          {horarios.length >= 2 ? (
            <>
              <div className="space-y-3 mt-2">
                {horarios.map((h, i) => (
                  <div key={h.horario}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{h.horario}</span>
                        {i === 0 && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">melhor</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{h.total_posts} posts</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${i === 0 ? 'bg-purple-500' : 'bg-slate-300'}`}
                        style={{ width: `${(h.score_medio / maxHorarioScore) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Score médio: {h.score_medio.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              {horarios.length < 5 && (
                <p className="text-xs text-slate-400 mt-3">
                  Análise mais precisa com mais posts publicados.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2">
              Disponível após pelo menos 4 posts publicados com métricas.
            </p>
          )}
        </div>
      </div>

      {/* Desempenho por tema */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Desempenho por Tema</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Os top 6 posts por tema são usados como exemplos na geração de novos conteúdos.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {resumoTemas.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              Dados disponíveis após os primeiros posts publicados com LinkedIn conectado.
            </div>
          ) : (
            resumoTemas
              .sort((a, b) => b.score_medio - a.score_medio)
              .map(tema => (
                <div key={tema.tema_nome} className="px-6 py-4 flex items-center gap-6">
                  <div className="w-44 shrink-0">
                    <p className="text-sm font-medium text-slate-800">{tema.tema_nome}</p>
                    <p className="text-xs text-slate-400">{tema.total_posts} posts</p>
                  </div>
                  <div className="flex-1 grid grid-cols-5 gap-3 text-xs text-center">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {tema.media_impressoes > 0 ? Math.round(tema.media_impressoes).toLocaleString('pt-BR') : '—'}
                      </p>
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
                      <p className="font-semibold text-slate-800">
                        {tema.media_cliques > 0 ? Math.round(tema.media_cliques) : '—'}
                      </p>
                      <p className="text-slate-400">Cliques</p>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-600">{tema.score_medio.toFixed(2)}</p>
                      <p className="text-slate-400">Score</p>
                    </div>
                  </div>
                  <div className="w-20 shrink-0">
                    <div className="bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${(tema.score_medio / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Loop de aprendizado */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-blue-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Loop de Aprendizado Automático</h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1 bg-white rounded-lg p-3 text-center border border-blue-100">
            <p className="text-xs text-slate-500 mb-1">1. Publicação</p>
            <p className="font-medium text-slate-700">Post vai ao ar</p>
          </div>
          <span className="text-blue-300">→</span>
          <div className="flex-1 bg-white rounded-lg p-3 text-center border border-blue-100">
            <p className="text-xs text-slate-500 mb-1">2. Coleta (30 dias)</p>
            <p className="font-medium text-slate-700">Diária até D+7, semanal até D+30</p>
          </div>
          <span className="text-blue-300">→</span>
          <div className="flex-1 bg-white rounded-lg p-3 text-center border border-blue-100">
            <p className="text-xs text-slate-500 mb-1">3. Score</p>
            <p className="font-medium text-slate-700">Engajamento calculado</p>
          </div>
          <span className="text-blue-300">→</span>
          <div className="flex-1 bg-white rounded-lg p-3 text-center border border-blue-100">
            <p className="text-xs text-slate-500 mb-1">4. Geração</p>
            <p className="font-medium text-slate-700">Top posts viram exemplos para IA</p>
          </div>
        </div>
      </div>

      {/* Posts recentes */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Posts por Engajamento</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {metricas.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              {linkedin?.conectado
                ? 'Métricas serão coletadas automaticamente às 7h. Primeiros dados amanhã.'
                : 'Conecte o LinkedIn para começar a coletar métricas.'}
            </div>
          ) : (
            metricas.slice(0, 15).map(m => (
              <div key={m.post_id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-0.5">{m.tema_nome} • {m.horario || '—'}</p>
                  <p className="text-sm text-slate-800 truncate">{m.texto.slice(0, 80)}...</p>
                </div>
                <div className="flex gap-3 text-xs text-slate-500 shrink-0">
                  {m.impressoes > 0 && <span title="Impressões">👁 {m.impressoes.toLocaleString('pt-BR')}</span>}
                  <span title="Curtidas">❤️ {m.curtidas}</span>
                  <span title="Comentários">💬 {m.comentarios}</span>
                  {m.cliques > 0 && <span title="Cliques">🖱 {m.cliques}</span>}
                </div>
                <div className="w-16 text-right shrink-0">
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
