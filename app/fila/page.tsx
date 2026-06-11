'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Edit3, Image, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
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

export default function FilaAprovacao() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [textoEdit, setTextoEdit] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/posts?status=pendente')
    const json = await res.json()
    setPosts(json.posts ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function aprovar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovado' }),
    })
    await carregar()
    setSalvando(null)
  }

  async function rejeitar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejeitado' }),
    })
    await carregar()
    setSalvando(null)
  }

  async function salvarEdicao(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoEdit, editado_por_usuario: true }),
    })
    setEditando(null)
    await carregar()
    setSalvando(null)
  }

  async function regenerar(id: string) {
    setSalvando(id)
    await fetch(`/api/posts/${id}/regenerar`, { method: 'POST' })
    await carregar()
    setSalvando(null)
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <RefreshCw size={24} className="text-blue-500 animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Fila de Aprovação</h1>
        <p className="text-slate-500 mt-1">
          Revise e aprove os posts antes que sejam publicados automaticamente.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Nenhum post pendente!</p>
          <p className="text-slate-400 text-sm mt-1">
            Novos posts serão gerados automaticamente às 9h nos dias úteis.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Cabeçalho do card */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: '#6366f1' }}
                  >
                    {post.tema_nome}
                  </span>
                  {post.data_agendada && (
                    <span className="text-xs text-slate-500">
                      📅 {format(new Date(post.data_agendada), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {post.editado_por_usuario && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      Editado por você
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setExpandido(expandido === post.id ? null : post.id)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {expandido === post.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {/* Conteúdo */}
              <div className="p-6">
                <div className="flex gap-5">
                  {/* Imagem */}
                  {post.imagem_url && (
                    <div className="shrink-0">
                      <img
                        src={post.imagem_url}
                        alt="Imagem do post"
                        className="w-32 h-32 rounded-xl object-cover border border-slate-200"
                      />
                    </div>
                  )}

                  {/* Texto */}
                  <div className="flex-1">
                    {editando === post.id ? (
                      <textarea
                        value={textoEdit}
                        onChange={(e) => setTextoEdit(e.target.value)}
                        className="w-full h-40 text-sm text-slate-800 border border-blue-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {post.texto}
                      </p>
                    )}

                    {/* Hashtags */}
                    {post.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {post.hashtags.map((h: string) => (
                          <span key={h} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fontes (expandível) */}
                {expandido === post.id && post.fontes_pesquisa?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">Fontes usadas na pesquisa:</p>
                    <ul className="space-y-1">
                      {post.fontes_pesquisa.map((f: any, i: number) => (
                        <li key={i} className="text-xs text-slate-500">
                          • <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{f.titulo}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editando === post.id ? (
                    <>
                      <button
                        onClick={() => salvarEdicao(post.id)}
                        disabled={!!salvando}
                        className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Salvar edição
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditando(post.id); setTextoEdit(post.texto) }}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-2 rounded-lg hover:bg-white transition-colors"
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        onClick={() => regenerar(post.id)}
                        disabled={!!salvando}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-2 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={salvando === post.id ? 'animate-spin' : ''} /> Regerar
                      </button>
                    </>
                  )}
                </div>

                {editando !== post.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => rejeitar(post.id)}
                      disabled={!!salvando}
                      className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={15} /> Rejeitar
                    </button>
                    <button
                      onClick={() => aprovar(post.id)}
                      disabled={!!salvando}
                      className="flex items-center gap-2 bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={15} />
                      {salvando === post.id ? 'Salvando...' : 'Aprovar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
