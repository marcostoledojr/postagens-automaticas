'use client'
import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  TrendingUp, Heart, MessageCircle, Share2, Eye, Award,
  Zap, Clock, RefreshCw, Wifi, WifiOff, MousePointer, Upload,
  Bookmark, Send, UserPlus, Search
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
  salvamentos: number
  envios: number
  seguidores_obtidos: number
  visualizacoes_perfil: number
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

type AnalyticsStatus = {
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
  const [linkedinAnalytics, setLinkedinAnalytics] = useState<AnalyticsStatus | null>(null)
  const [periodo, setPeriodo] = useState('30')
  const [loading, setLoading] = useState(true)
  const [coletando, setColetando] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [notificacao, setNotificacao] = useState<string | null>(null)
  const [postsSemId, setPostsSemId] = useState<{id:string;texto:string;tema_nome:string;publicado_em:string}[]>([])
  const [urlsDigitadas, setUrlsDigitadas] = useState<Record<string, string>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false)
  const [importando, setImportando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function carregar() {
    setLoading(true)
    const res = await fetch(`/api/metricas?dias=${periodo}`)
    const json = await res.json()
    setMetricas(json.posts ?? [])
    setResumoTemas(json.temas ?? [])
    setHorarios(json.horarios ?? [])
    setLinkedin(json.linkedin ?? null)
    setLinkedinAnalytics(json.linkedinAnalytics ?? null)
    setLoading(false)
  }

  async function importarExcelLinkedIn(file: File) {
    setImportando(true)
    setNotificacao(null)
    try {
      // Lê o arquivo como ArrayBuffer e envia para o servidor processar
      const buffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))))

      const res = await fetch('/api/metricas/importar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo: base64, nome: file.name }),
      })
      const json = await res.json()

      if (json.ok) {
        setNotificacao(`✓ Importado: ${json.impressoes} impressões, ${json.curtidas} curtidas, ${json.compartilhamentos} compartilhamentos`)
        await carregar()
      } else {
        setNotificacao(`⚠ ${json.erro}`)
      }
    } catch (err: any) {
      setNotificacao(`⚠ Erro ao importar: ${err.message}`)
    } finally {
      setImportando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function carregarPostsSemId() {
    const res = await fetch('/api/posts/sem-linkedin-id')
    const data = await res.json()
    setPostsSemId(data)
    setMostrarRecuperacao(true)
  }

  async function salvarUrlLinkedIn(postId: string) {
    const url = urlsDigitadas[postId]
    if (!url) return
    setSalvandoId(postId)
    try {
      const res = await fetch('/api/posts/atualizar-linkedin-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, linkedinUrl: url }),
      })
      const json = await res.json()
      if (json.ok) {
        setPostsSemId(prev => prev.filter(p => p.id !== postId))
        setUrlsDigitadas(prev => { const n = {...prev}; delete n[postId]; return n })
        setNotificacao(`✓ ID salvo: ${json.urn} — clique em Coletar Agora para buscar as métricas`)
      } else {
        setNotificacao(`⚠ ${json.erro}`)
      }
    } finally {
      setSalvandoId(null)
    }
  }

  async function coletarAgora(force = false) {
    setColetando(true)
    setNotificacao(null)
    try {
      const url = force ? '/api/metricas/coletar?force=true' : '/api/metricas/coletar'
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setNotificacao(`⚠ Erro na coleta: ${json.erro ?? 'Tente novamente.'}`)
      } else {
        const { reparo, coleta } = json
        const msgs = []
        if (reparo.reparados > 0) msgs.push(`${reparo.reparados} ID(s) de post recuperado(s) no LinkedIn`)
        if (coleta.coletados > 0) msgs.push(`${coleta.coletados} post(s) com métricas coletadas`)
        if (coleta.pulados > 0 && coleta.coletados === 0) {
          msgs.push(`${coleta.pulados} post(s) sem ID real do LinkedIn — veja instrução abaixo`)
        }
        setNotificacao(msgs.length > 0 ? `✓ ${msgs.join(' · ')}` : '⚠ Nenhum post com ID real do LinkedIn encontrado.')
        await carregar()
      }
    } catch (err: any) {
      setNotificacao(`⚠ Erro: ${err.message}`)
    } finally {
      setColetando(false)
    }
  }

  useEffect(() => { carregar() }, [periodo])

  useEffect(() => {
    const conectado = searchParams.get('conectado')
    const erro = searchParams.get('erro')
    if (conectado === '1') setNotificacao('✓ LinkedIn conectado com sucesso! Métricas serão coletadas automaticamente.')
    if (searchParams.get('analytics_conectado') === '1') setNotificacao('✓ LinkedIn Analytics conectado! Impressões e métricas completas agora disponíveis.')
    if (erro) {
      const msgs: Record<string, string> = {
        oauth_cancelado: 'Conexão cancelada.',
        token_falhou: 'Erro ao obter token do LinkedIn. Tente novamente.',
        credenciais_faltando: 'Credenciais do LinkedIn App não configuradas no Vercel.',
        salvar_token: 'Erro ao salvar token no banco. Tente novamente.',
        analytics_oauth_cancelado: 'Conexão de analytics cancelada.',
        analytics_token_falhou: 'Erro ao obter token de analytics. Tente novamente.',
        analytics_credenciais_faltando: 'LINKEDIN_ANALYTICS_CLIENT_ID/SECRET não configurados no Vercel.',
      }
      setNotificacao(`⚠ ${msgs[erro] ?? 'Erro desconhecido.'}`)
    }
  }, [searchParams])

  // Considera apenas posts com pelo menos uma métrica real (exclui posts com todos os zeros)
  const metricasValidas = metricas.filter(m =>
    m.impressoes > 0 || m.curtidas > 0 || m.comentarios > 0 || m.compartilhamentos > 0 ||
    m.cliques > 0 || m.salvamentos > 0 || m.envios > 0 || m.seguidores_obtidos > 0 || m.visualizacoes_perfil > 0
  )

  const totais = metricasValidas.reduce((acc, m) => ({
    impressoes: acc.impressoes + m.impressoes,
    curtidas: acc.curtidas + m.curtidas,
    comentarios: acc.comentarios + m.comentarios,
    compartilhamentos: acc.compartilhamentos + m.compartilhamentos,
    cliques: acc.cliques + m.cliques,
    salvamentos: acc.salvamentos + m.salvamentos,
    envios: acc.envios + m.envios,
    seguidores_obtidos: acc.seguidores_obtidos + m.seguidores_obtidos,
    visualizacoes_perfil: acc.visualizacoes_perfil + m.visualizacoes_perfil,
  }), { impressoes: 0, curtidas: 0, comentarios: 0, compartilhamentos: 0, cliques: 0, salvamentos: 0, envios: 0, seguidores_obtidos: 0, visualizacoes_perfil: 0 })

  const taxaEngajamentoGeral = totais.impressoes > 0
    ? (
        (totais.curtidas + totais.comentarios * 3 + totais.salvamentos * 3 +
         totais.envios * 2 + totais.cliques * 0.5 + totais.compartilhamentos * 5) /
        totais.impressoes * 100
      ).toFixed(2)
    : null

  const melhorPost = [...metricasValidas].sort((a, b) => b.score_engajamento - a.score_engajamento)[0]
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
          <label
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
            title="Importar Excel exportado do LinkedIn (Análise da publicação)"
          >
            <Upload size={14} className={importando ? 'animate-pulse' : ''} />
            {importando ? 'Importando...' : 'Importar Excel'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importarExcelLinkedIn(f) }}
            />
          </label>
          <button
            onClick={() => coletarAgora(false)}
            disabled={coletando}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Buscar métricas do LinkedIn (respeita intervalo de 20h)"
          >
            <RefreshCw size={14} className={coletando ? 'animate-spin' : ''} />
            {coletando ? 'Coletando...' : 'Coletar Agora'}
          </button>
          <button
            onClick={() => coletarAgora(true)}
            disabled={coletando}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Força recoleta de todos os posts (ignora intervalo de 20h)"
          >
            <RefreshCw size={14} className={coletando ? 'animate-spin' : ''} />
            {coletando ? 'Coletando...' : 'Forçar Recoleta'}
          </button>
          <button
            onClick={async () => { setRefreshing(true); await carregar(); setRefreshing(false) }}
            disabled={refreshing}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={`text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
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

      {/* Status LinkedIn Analytics (segundo app — Community Management API) */}
      <div className={`rounded-xl border p-4 mb-4 flex items-center justify-between ${
        linkedinAnalytics?.conectado
          ? 'bg-green-50 border-green-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          {linkedinAnalytics?.conectado ? (
            <TrendingUp size={18} className="text-green-600" />
          ) : (
            <TrendingUp size={18} className="text-amber-500" />
          )}
          <div>
            {linkedinAnalytics?.conectado ? (
              <>
                <p className="text-sm font-medium text-green-800">Analytics conectado — impressões ativas</p>
                <p className="text-xs text-green-600">Token válido por mais {linkedinAnalytics.diasRestantes} dias</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-amber-800">Analytics não conectado — impressões indisponíveis</p>
                <p className="text-xs text-amber-700">
                  {process.env.NEXT_PUBLIC_APP_URL
                    ? 'Aguardando aprovação LinkedIn → conecte após receber o email de aprovação'
                    : 'Conecte o app de analytics após aprovação da Community Management API pelo LinkedIn'}
                </p>
              </>
            )}
          </div>
        </div>
        <a
          href="/api/auth/linkedin-analytics"
          className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
            linkedinAnalytics?.conectado
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
          }`}
        >
          {linkedinAnalytics?.conectado ? 'Reconectar Analytics' : 'Conectar Analytics'}
        </a>
      </div>

      {/* Banner instrução Make.com — aparece apenas se LinkedIn conectado e ainda sem nenhuma coleta */}
      {linkedin?.conectado && metricas.length === 0 && resumoTemas.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-amber-900 mb-2">📋 Configure o Make.com para enviar o ID real do LinkedIn</p>
          <p className="text-sm text-amber-800 mb-3">
            Os posts foram publicados via Make.com, mas o ID real do post do LinkedIn não foi retornado.
            Para ativar as métricas, o cenário do Make.com precisa devolver o ID do LinkedIn na resposta do webhook.
          </p>
          <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
            <li>Abra o cenário no <strong>Make.com</strong> que publica posts no LinkedIn</li>
            <li>No módulo de resposta ao webhook (último módulo), adicione um campo: <code className="bg-amber-100 px-1 rounded">linkedin_post_id</code></li>
            <li>Mapeie o valor para o <strong>ID do post</strong> retornado pelo módulo LinkedIn (geralmente chamado <em>ID</em> ou <em>URN</em> no output do módulo)</li>
            <li>Salve e teste — os próximos posts publicados pelo sistema terão ID real e as métricas começarão a ser coletadas automaticamente</li>
          </ol>
        </div>
      )}

      {/* Cards de totais — linha 1 */}
      <div className="grid grid-cols-4 gap-4 mb-3">
        {[
          { label: 'Impressões',        value: totais.impressoes,        icon: Eye,           color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Curtidas',          value: totais.curtidas,          icon: Heart,         color: 'text-red-500',   bg: 'bg-red-50'    },
          { label: 'Comentários',       value: totais.comentarios,       icon: MessageCircle, color: 'text-blue-500',  bg: 'bg-blue-50'   },
          { label: 'Compartilhamentos', value: totais.compartilhamentos, icon: Share2,        color: 'text-green-500', bg: 'bg-green-50'  },
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
      {/* Cards de totais — linha 2 (novas métricas) */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Cliques no Link',         value: totais.cliques,             icon: MousePointer, color: 'text-orange-500',  bg: 'bg-orange-50'  },
          { label: 'Salvamentos',             value: totais.salvamentos,         icon: Bookmark,     color: 'text-purple-500',  bg: 'bg-purple-50'  },
          { label: 'Envios por DM',           value: totais.envios,              icon: Send,         color: 'text-cyan-500',    bg: 'bg-cyan-50'    },
          { label: 'Seguidores Obtidos',      value: totais.seguidores_obtidos,  icon: UserPlus,     color: 'text-emerald-500', bg: 'bg-emerald-50' },
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
                  <div className="flex-1 grid grid-cols-4 gap-3 text-xs text-center">
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
          {metricasValidas.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              {linkedin?.conectado
                ? 'Métricas serão coletadas automaticamente às 7h. Primeiros dados amanhã.'
                : 'Conecte o LinkedIn para começar a coletar métricas.'}
            </div>
          ) : (
            metricasValidas.slice(0, 15).map(m => (
              <div key={m.post_id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-0.5">
                    {m.tema_nome} • {m.publicado_em ? new Date(m.publicado_em).toLocaleDateString('pt-BR') : '—'} • {m.horario || '—'}
                  </p>
                  <p className="text-sm text-slate-800 truncate">{m.texto.slice(0, 80)}...</p>
                </div>
                <div className="flex gap-3 text-xs text-slate-500 shrink-0">
                  <span title="Impressões" className="flex items-center gap-1">
                    <Eye size={12} /> {m.impressoes > 0 ? m.impressoes.toLocaleString('pt-BR') : '—'}
                  </span>
                  <span title="Curtidas" className="flex items-center gap-1">
                    <Heart size={12} /> {m.curtidas}
                  </span>
                  <span title="Comentários" className="flex items-center gap-1">
                    <MessageCircle size={12} /> {m.comentarios}
                  </span>
                  <span title="Cliques no link" className="flex items-center gap-1 text-orange-500">
                    <MousePointer size={12} /> {m.cliques > 0 ? m.cliques : '—'}
                  </span>
                  <span title="Salvamentos" className="flex items-center gap-1 text-purple-500">
                    <Bookmark size={12} /> {m.salvamentos > 0 ? m.salvamentos : '—'}
                  </span>
                  <span title="Envios por DM" className="flex items-center gap-1 text-cyan-500">
                    <Send size={12} /> {m.envios > 0 ? m.envios : '—'}
                  </span>
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
