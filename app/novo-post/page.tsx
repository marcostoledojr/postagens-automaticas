'use client'
import { useState } from 'react'
import { Sparkles, Send, RefreshCw, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react'

type PostGerado = {
  id: string
  texto: string
  hashtags: string[]
  imagem_url: string | null
  tipo: 'comercial' | 'autoridade'
  data_agendada: string
}

const TIPO_OPTS = [
  { value: 'auto',      label: 'Automático (detecta pelo tema)' },
  { value: 'comercial', label: 'Comercial Oficina1 (com @Oficina1 e CTA)' },
  { value: 'autoridade',label: 'Autoridade Pessoal (sem menção comercial)' },
]

function dataAmanha() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function NovoPost() {
  const [titulo, setTitulo]     = useState('')
  const [contexto, setContexto] = useState('')
  const [url, setUrl]           = useState('')
  const [tipo, setTipo]         = useState('auto')
  const [data, setData]         = useState(dataAmanha())
  const [horario, setHorario]   = useState('09:00')

  const [gerando, setGerando]   = useState(false)
  const [post, setPost]         = useState<PostGerado | null>(null)
  const [salvo, setSalvo]       = useState(false)
  const [erro, setErro]         = useState<string | null>(null)

  async function gerar() {
    if (!titulo.trim()) { setErro('Informe o tema do post.'); return }
    setGerando(true)
    setErro(null)
    setPost(null)
    setSalvo(false)

    try {
      const res = await fetch('/api/posts/avulso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, contexto, url, tipo, data, horario }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.erro ?? 'Erro desconhecido')
      setPost(json.post)
      setSalvo(true)
    } catch (e: any) {
      setErro(e.message)
    }
    setGerando(false)
  }

  function resetar() {
    setPost(null)
    setSalvo(false)
    setErro(null)
    setTitulo('')
    setContexto('')
    setUrl('')
    setTipo('auto')
    setData(dataAmanha())
    setHorario('09:00')
  }

  const dataFormatada = post
    ? new Date(post.data_agendada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Novo Post Avulso</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Gere um post personalizado sobre qualquer tema. Ele vai direto para a Fila de Aprovação.
        </p>
      </div>

      {/* Formulário */}
      {!salvo && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          {/* Tema */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Tema / Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Release 12.1.2610 do TOTVS Protheus em outubro"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Contexto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contexto / Briefing
              <span className="ml-2 text-xs text-slate-400 font-normal">— O que você quer destacar? Qual é o ângulo?</span>
            </label>
            <textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder="Ex: Quero falar sobre o risco de empresas que vão fazer update sem mapear customizações. Ângulo: diagnóstico antes de qualquer migração."
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              URL de referência
              <span className="ml-2 text-xs text-slate-400 font-normal">— artigo, post, notícia (opcional)</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de post</label>
            <div className="space-y-2">
              {TIPO_OPTS.map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="tipo"
                    value={opt.value}
                    checked={tipo === opt.value}
                    onChange={() => setTipo(opt.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Data e Horário */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Data de publicação <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Horário <span className="text-red-500">*</span>
              </label>
              <select
                value={horario}
                onChange={e => setHorario(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'].map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Botão gerar */}
          <button
            onClick={gerar}
            disabled={gerando || !titulo.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {gerando ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Gerando post... aguarde (~40s)
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Gerar post
              </>
            )}
          </button>
        </div>
      )}

      {/* Preview do post gerado */}
      {salvo && post && (
        <div className="space-y-4">
          {/* Sucesso */}
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle size={16} className="text-green-600 shrink-0" />
            <p className="text-sm text-green-700">
              Post gerado e salvo na Fila de Aprovação para {dataFormatada}.
            </p>
          </div>

          {/* Card do post */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${
                post.tipo === 'comercial' ? 'bg-blue-500' : 'bg-purple-500'
              }`}>
                {post.tipo === 'comercial' ? 'Comercial' : 'Autoridade'}
              </span>
              <span className="text-xs text-slate-400">{dataFormatada}</span>
            </div>

            <div className="flex gap-4">
              {post.imagem_url && (
                <div className="shrink-0">
                  <img
                    src={post.imagem_url}
                    alt="Imagem do post"
                    className="w-32 h-32 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(post.imagem_url!, '_blank')}
                    title="Clique para ampliar"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {post.texto}
                </p>
                {post.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {post.hashtags.map(h => (
                      <span key={h} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{h}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={resetar}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Sparkles size={14} />
              Criar outro post
            </button>
            <a
              href="/fila"
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink size={14} />
              Ver na Fila de Aprovação
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
