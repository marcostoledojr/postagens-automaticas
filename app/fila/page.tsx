'use client'
import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Edit3, RefreshCw, ChevronDown, ChevronUp, Trash2, RotateCcw, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Post = {
  id: string
  texto: string
  imagem_url: string | null
  tema_nome: string
  status: string
  data_agendada: string
  horario_publicacao: string
  hashtags: string[]
  fontes_pesquisa: any[]
  editado_por_usuario: boolean
}

type StatusTab = 'pendente' | 'agendado' | 'publicado' | 'rejeitado'

const TABS: { status: StatusTab; label: string; emptyMsg: string }[] = [
  { status: 'pendente',   label: 'Pendentes',  emptyMsg: 'Nenhum post pendente. Clique em "Gerar posts" ou aguarde as 9h.' },
  { status: 'agendado',   label: 'Agendados',  emptyMsg: 'Nenhum post agendado para publicação.' },
  { status: 'publicado',  label: 'Publicados', emptyMsg: 'Nenhum post publicado ainda.' },
  { status: 'rejeitado',  label: 'Rejeitados', emptyMsg: 'Nenhum post rejeitado.' },
]

const TEMA_CORES: Record<string, string> = {
  'Fatos Relevantes TOTVS Protheus': '#ef4444',
  'Comercial Oficina1':               '#3b82f6',
  'Autoridade Oficina1':              '#8b5cf6',
  'Inteligência Artificial':          '#f59e0b',
}

const TAB_CORES: Record<StatusTab, string> = {
  pendente:  'text-blue-600 border-blue-600',
  agendado:  'text-green-600 border-green-600',
  publicado: 'text-slate-600 border-slate-600',
  rejeitado: 'text-red-600 border-red-600',
}

const BADGE_CORES: Record<StatusTab, string> = {
  pendente:  'bg-blue-100 text-blue-700',
  agendado:  'bg-green-100 text-green-700',
  publicado: 'bg-slate-100 text-slate-600',
  rejeitado: 'bg-red-100 text-red-600',
}

export default function FilaAprovacao() {
  const [tabAtiva, setTabAtiva] = useState<StatusTab>('pendente')
  const [postsPorStatus, setPostsPorStatus] = useState<Record<StatusTab, Post[]>>({
    pendente: [], agendado: [], publicado: [], rejeitado: [],
  })
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [textoEdit, setTextoEdit] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [zerando, setZerando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [diasGerar, setDiasGerar] = useState(7)
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false)
  const [progressoGeracao, setProgressoGeracao] = useState<{ atual: number; total: number; tema: string } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    // Carrega todos os status de uma vez
    const resultados = await Promise.all(
      TABS.map(t => fetch(`/api/posts?status=${t.status}`, { cache: 'no-store' }).then(r => r.json()))
    )
    const novo: Record<StatusTab, Post[]> = {
      pendente: [], agendado: [], publicado: [], rejeitado: [],
    }
    TABS.forEach((t, i) => { novo[t.status] = resultados[i].posts ?? [] })
    setPostsPorStatus(novo)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const posts = postsPorStatus[tabAtiva]

  async function aprovar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovado' }),
    })
    await carregar(); setSalvando(null)
  }

  async function rejeitar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejeitado' }),
    })
    await carregar(); setSalvando(null)
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este post permanentemente?')) return
    setSalvando(id)
    await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    await carregar(); setSalvando(null)
  }

  async function restaurar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pendente' }),
    })
    await carregar(); setSalvando(null)
  }

  async function salvarEdicao(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoEdit, editado_por_usuario: true }),
    })
    setEditando(null); await carregar(); setSalvando(null)
  }

  async function regenerar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}/regenerar`, { method: 'POST' })
    await carregar(); setSalvando(null)
  }

  // Apaga apenas posts pendentes — sem gerar nada
  async function zerar() {
    if (!confirm('Apagar todos os posts pendentes (ainda não aprovados)? Posts aprovados e publicados não serão afetados.')) return
    setZerando(true)
    try {
      const res = await fetch('/api/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'zerar' }),
      })
      if (!res.ok) throw new Error('Erro ao apagar pendentes')
      await carregar()
    } catch (e: any) {
      alert(`Erro: ${e.message}`)
    }
    setZerando(false)
  }

  // Gera posts para os próximos N dias respeitando agenda e temas
  async function gerarPosts() {
    setMostrarOpcoes(false)
    setGerando(true)
    setProgressoGeracao({ atual: 0, total: 0, tema: 'Buscando slots...' })

    try {
      // 1. Busca slots vazios nos próximos N dias
      const slotsRes = await fetch(`/api/gerar/slots?dias=${diasGerar}`)
      const slotsData = await slotsRes.json()
      const slots: { data_iso: string; horario: string; tema_id: string; tema_nome: string; dia_label: string }[]
        = slotsData.slots ?? []

      if (slots.length === 0) {
        alert(`Nenhum slot vazio nos próximos ${diasGerar} dias úteis. Todos os slots já estão preenchidos — clique em "Zerar" primeiro se quiser regenerar.`)
        setGerando(false)
        setProgressoGeracao(null)
        return
      }

      let gerados = 0
      let erros = 0

      // 2. Gera 1 post por slot (chamadas individuais < 60s cada)
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        setProgressoGeracao({
          atual: i + 1,
          total: slots.length,
          tema: `${slot.dia_label} ${slot.horario} — ${slot.tema_nome}`,
        })

        const res = await fetch('/api/gerar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'gerar_tema',
            tema_id: slot.tema_id,
            horario: slot.horario,
            data_iso: slot.data_iso,
          }),
        })
        if (res.ok) { gerados++ } else { erros++ }

        await carregar()
      }

      alert(`✅ Gerados: ${gerados} | ❌ Erros: ${erros}`)
      setTabAtiva('pendente')
    } catch (e: any) {
      alert(`Erro: ${e.message}`)
    }

    setProgressoGeracao(null)
    setGerando(false)
  }

  function toggle(id: string) {
    setExpandido(prev => prev === id ? null : id)
    setEditando(null)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fila de Aprovação</h1>
          <p className="text-slate-500 mt-1 text-sm">Revise posts antes da publicação automática.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={carregar} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button onClick={zerar} disabled={zerando || gerando}
            className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
            <Trash2 size={13} className={zerando ? 'animate-spin' : ''} />
            {zerando ? 'Zerando...' : 'Zerar pendentes'}
          </button>

          {/* Botão Gerar com seletor de dias */}
          <div className="relative">
            <div className="flex items-stretch">
              <button
                onClick={gerarPosts}
                disabled={gerando || zerando}
                className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-2 rounded-l-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Sparkles size={13} className={gerando ? 'animate-pulse' : ''} />
                {gerando ? 'Gerando...' : `Gerar posts (${diasGerar} dias úteis)`}
              </button>
              <button
                onClick={() => setMostrarOpcoes(prev => !prev)}
                disabled={gerando || zerando}
                className="text-sm bg-blue-700 text-white px-2 py-2 rounded-r-lg hover:bg-blue-800 transition-colors disabled:opacity-50 border-l border-blue-500"
                title="Escolher quantos dias"
              >
                ▾
              </button>
            </div>
            {mostrarOpcoes && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3 min-w-40">
                <p className="text-xs font-medium text-slate-500 mb-2">Dias úteis à frente:</p>
                {[3, 5, 7, 10].map(d => (
                  <button
                    key={d}
                    onClick={() => { setDiasGerar(d); setMostrarOpcoes(false) }}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      diasGerar === d
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {d} dias úteis {d === 5 ? '(1 semana)' : d === 10 ? '(2 semanas)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra de progresso de geração */}
      {progressoGeracao && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-blue-700 font-medium flex items-center gap-1.5">
              <RefreshCw size={13} className="animate-spin" />
              {progressoGeracao.total === 0
                ? progressoGeracao.tema
                : `${progressoGeracao.atual}/${progressoGeracao.total}: ${progressoGeracao.tema}`}
            </span>
            {progressoGeracao.total > 0 && (
              <span className="text-xs text-blue-500">{Math.round((progressoGeracao.atual / progressoGeracao.total) * 100)}%</span>
            )}
          </div>
          {progressoGeracao.total > 0 && (
            <div className="w-full bg-blue-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(progressoGeracao.atual / progressoGeracao.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tabs de filtro */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map(({ status, label }) => {
          const count = postsPorStatus[status].length
          const ativo = tabAtiva === status
          return (
            <button
              key={status}
              onClick={() => { setTabAtiva(status); setExpandido(null); setEditando(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                ativo
                  ? `${TAB_CORES[status]} bg-white`
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  ativo ? BADGE_CORES[status] : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista de posts */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={24} className="text-blue-500 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{TABS.find(t => t.status === tabAtiva)?.emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const aberto = expandido === post.id
            const estaEditando = editando === post.id
       