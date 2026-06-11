'use client'
import { useEffect, useState } from 'react'
import { Plus, Edit3, Trash2, Save, X, Hash } from 'lucide-react'

type Tema = {
  id: string
  nome: string
  descricao: string
  objetivo: string
  tom: string
  mencoes: string[]
  hashtags: string[]
  cta: string
  frequencia_semanal: number
  ativo: boolean
  cor: string
}

const TONS = [
  { value: 'profissional', label: 'Profissional' },
  { value: 'consultivo',   label: 'Consultivo' },
  { value: 'técnico',      label: 'Técnico' },
  { value: 'inspiracional',label: 'Inspiracional' },
  { value: 'descontraído', label: 'Descontraído' },
]

const CORES = ['#10b981','#6366f1','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

function TemaForm({ tema, onSave, onCancel }: {
  tema: Partial<Tema>
  onSave: (t: Partial<Tema>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Partial<Tema>>(tema)
  const [hashInput, setHashInput] = useState('')
  const [menInput, setMenInput] = useState('')

  const set = (k: keyof Tema, v: any) => setForm(f => ({ ...f, [k]: v }))

  const addHashtag = () => {
    if (!hashInput.trim()) return
    const tag = hashInput.trim().startsWith('#') ? hashInput.trim() : `#${hashInput.trim()}`
    set('hashtags', [...(form.hashtags ?? []), tag])
    setHashInput('')
  }

  const addMencao = () => {
    if (!menInput.trim()) return
    const men = menInput.trim().startsWith('@') ? menInput.trim() : `@${menInput.trim()}`
    set('mencoes', [...(form.mencoes ?? []), men])
    setMenInput('')
  }

  return (
    <div className="bg-white rounded-xl border-2 border-blue-300 p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Nome */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600 block mb-1">Nome do tema *</label>
          <input
            value={form.nome ?? ''}
            onChange={e => set('nome', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="ex: Comercial Oficina1"
          />
        </div>

        {/* Objetivo */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600 block mb-1">Objetivo do tema *</label>
          <input
            value={form.objetivo ?? ''}
            onChange={e => set('objetivo', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="ex: Gerar negócios e leads para a Oficina1"
          />
        </div>

        {/* Tom */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Tom de voz</label>
          <select
            value={form.tom ?? 'profissional'}
            onChange={e => set('tom', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {TONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Frequência */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Posts por semana: <strong>{form.frequencia_semanal}</strong>
          </label>
          <input
            type="range" min={1} max={5}
            value={form.frequencia_semanal ?? 2}
            onChange={e => set('frequencia_semanal', Number(e.target.value))}
            className="w-full mt-2"
          />
        </div>

        {/* CTA */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Chamada para ação (CTA) <span className="text-slate-400">opcional</span>
          </label>
          <input
            value={form.cta ?? ''}
            onChange={e => set('cta', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="ex: Fale com a Oficina1 e saiba como podemos ajudar."
          />
        </div>

        {/* Menções */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Menções (@)</label>
          <div className="flex gap-2">
            <input
              value={menInput}
              onChange={e => setMenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMencao()}
              placeholder="@Oficina1"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={addMencao} className="bg-slate-100 px-3 rounded-lg hover:bg-slate-200 text-sm">+</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(form.mencoes ?? []).map((m, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full flex items-center gap-1">
                {m}
                <button onClick={() => set('mencoes', form.mencoes!.filter((_, j) => j !== i))}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Hashtags</label>
          <div className="flex gap-2">
            <input
              value={hashInput}
              onChange={e => setHashInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHashtag()}
              placeholder="#TOTVS"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={addHashtag} className="bg-slate-100 px-3 rounded-lg hover:bg-slate-200 text-sm">+</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(form.hashtags ?? []).map((h, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                {h}
                <button onClick={() => set('hashtags', form.hashtags!.filter((_, j) => j !== i))}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Cor */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600 block mb-2">Cor de identificação</label>
          <div className="flex gap-2">
            {CORES.map(c => (
              <button
                key={c}
                onClick={() => set('cor', c)}
                className={`w-7 h-7 rounded-full transition-transform ${form.cor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          <Save size={14} /> Salvar tema
        </button>
      </div>
    </div>
  )
}

export default function Temas() {
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/temas')
    const json = await res.json()
    setTemas(json.temas ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar(form: Partial<Tema>, id?: string) {
    if (id) {
      await fetch(`/api/temas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setEditandoId(null)
    } else {
      await fetch('/api/temas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setCriando(false)
    }
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este tema?')) return
    await fetch(`/api/temas/${id}`, { method: 'DELETE' })
    await carregar()
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/temas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    })
    await carregar()
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Temas</h1>
          <p className="text-slate-500 mt-1">Configure os temas dos seus posts e como a IA deve abordá-los.</p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo tema
        </button>
      </div>

      {criando && (
        <div className="mb-6">
          <TemaForm
            tema={{ tom: 'profissional', frequencia_semanal: 2, cor: '#6366f1', mencoes: [], hashtags: [], ativo: true }}
            onSave={(f) => salvar(f)}
            onCancel={() => setCriando(false)}
          />
        </div>
      )}

      <div className="space-y-4">
        {temas.map(tema => (
          <div key={tema.id}>
            {editandoId === tema.id ? (
              <TemaForm
                tema={tema}
                onSave={(f) => salvar(f, tema.id)}
                onCancel={() => setEditandoId(null)}
              />
            ) : (
              <div className={`bg-white rounded-xl border border-slate-200 p-5 ${!tema.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: tema.cor }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{tema.nome}</h3>
                        {!tema.ativo && (
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inativo</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{tema.objetivo}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>Tom: <strong className="text-slate-600">{tema.tom}</strong></span>
                        <span>{tema.frequencia_semanal}× por semana</span>
                        {tema.mencoes?.length > 0 && (
                          <span>{tema.mencoes.join(', ')}</span>
                        )}
                      </div>
                      {tema.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tema.hashtags.slice(0,5).map(h => (
                            <span key={h} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{h}</span>
                          ))}
                          {tema.hashtags.length > 5 && (
                            <span className="text-xs text-slate-400">+{tema.hashtags.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => toggleAtivo(tema.id, tema.ativo)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        tema.ativo
                          ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {tema.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      onClick={() => setEditandoId(tema.id)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => excluir(tema.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
