'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, getDay, addMonths, subMonths
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Post = {
  id: string
  texto: string
  tema_nome: string
  status: string
  data_agendada: string
  horario_publicacao: string
  cor_tema?: string
}

const STATUS_COR: Record<string, string> = {
  pendente:  'bg-amber-400',
  aprovado:  'bg-blue-400',
  agendado:  'bg-blue-400',
  publicado: 'bg-green-500',
  rejeitado: 'bg-red-400',
  erro:      'bg-red-500',
}

export default function Calendario() {
  const [mesAtual, setMesAtual] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)
  const [gerandoAntecipado, setGerandoAntecipado] = useState(false)
  const [diasAntecipados, setDiasAntecipados] = useState(10)

  async function carregar(mes: Date) {
    const inicio = startOfMonth(mes).toISOString()
    const fim = endOfMonth(mes).toISOString()
    const res = await fetch(`/api/posts?de=${inicio}&ate=${fim}&limit=100`)
    const json = await res.json()
    setPosts(json.posts ?? [])
  }

  useEffect(() => { carregar(mesAtual) }, [mesAtual])

  const diasDoMes = eachDayOfInterval({
    start: startOfMonth(mesAtual),
    end: endOfMonth(mesAtual),
  })

  const postsPorDia = (dia: Date) =>
    posts.filter(p => p.data_agendada &&
      format(new Date(p.data_agendada), 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd')
    )

  const postsDiaSelecionado = diaSelecionado ? postsPorDia(diaSelecionado) : []

  async function gerarAntecipado() {
    setGerandoAntecipado(true)
    await fetch('/api/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias: diasAntecipados }),
    })
    await carregar(mesAtual)
    setGerandoAntecipado(false)
    alert(`Posts para os próximos ${diasAntecipados} dias enviados para a fila de aprovação!`)
  }

  const inicioOffset = getDay(startOfMonth(mesAtual)) // 0=Dom

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
          <p className="text-slate-500 mt-1">Visualize e gerencie os posts agendados.</p>
        </div>

        {/* Geração antecipada (para férias) */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs font-medium text-slate-600">Gerar posts antecipados</p>
            <p className="text-xs text-slate-400">Para viagens ou ausências</p>
          </div>
          <select
            value={diasAntecipados}
            onChange={e => setDiasAntecipados(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
          >
            {[5,7,10,14,20,30].map(d => (
              <option key={d} value={d}>{d} dias</option>
            ))}
          </select>
          <button
            onClick={gerarAntecipado}
            disabled={gerandoAntecipado}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {gerandoAntecipado ? 'Gerando...' : 'Gerar'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendário */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Navegação do mês */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <button onClick={() => setMesAtual(m => subMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-slate-800 capitalize">
              {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button onClick={() => setMesAtual(m => addMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7">
            {/* Offset inicial */}
            {Array.from({ length: inicioOffset }).map((_, i) => (
              <div key={`offset-${i}`} className="border-b border-r border-slate-100 h-24" />
            ))}

            {diasDoMes.map(dia => {
              const dPosts = postsPorDia(dia)
              const selecionado = diaSelecionado && format(dia, 'yyyy-MM-dd') === format(diaSelecionado, 'yyyy-MM-dd')
              return (
                <div
                  key={dia.toISOString()}
                  onClick={() => setDiaSelecionado(dia)}
                  className={`border-b border-r border-slate-100 h-24 p-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selecionado ? 'bg-blue-50' : ''
                  } ${!isSameMonth(dia, mesAtual) ? 'opacity-30' : ''}`}
                >
                  <span className={`text-xs font-medium block mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday(dia) ? 'bg-blue-600 text-white' : 'text-slate-700'
                  }`}>
                    {format(dia, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dPosts.slice(0, 3).map(p => (
                      <div
                        key={p.id}
                        className={`text-[10px] text-white px-1.5 py-0.5 rounded truncate ${STATUS_COR[p.status] ?? 'bg-slate-400'}`}
                      >
                        {p.horario_publicacao} {p.tema_nome?.split(' ')[0]}
                      </div>
                    ))}
                    {dPosts.length > 3 && (
                      <p className="text-[10px] text-slate-400">+{dPosts.length - 3}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel lateral - posts do dia selecionado */}
        <div className="w-72 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">
            {diaSelecionado
              ? format(diaSelecionado, "dd 'de' MMMM", { locale: ptBR })
              : 'Selecione um dia'}
          </h3>

          {diaSelecionado && postsDiaSelecionado.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum post agendado para este dia.</p>
          )}

          <div className="space-y-3">
            {postsDiaSelecionado.map(p => (
              <div key={p.id} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={12} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">{p.horario_publicacao}</span>
                  <span className={`text-[10px] text-white px-1.5 py-0.5 rounded-full ${STATUS_COR[p.status] ?? 'bg-slate-400'}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{p.tema_nome}</p>
                <p className="text-xs text-slate-700 mt-1 line-clamp-3">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
