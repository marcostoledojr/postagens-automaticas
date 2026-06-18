import { createClient } from '@/lib/supabase-server'
import { CheckCircle, Clock, TrendingUp, Zap, AlertCircle, Calendar } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const supabase = createClient()
  const hoje = new Date()
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - hoje.getDay())

  const [pendentes, publicados, agendados, ultimosPublicados] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact' }).eq('status', 'pendente'),
    supabase.from('posts').select('id', { count: 'exact' }).eq('status', 'publicado')
      .gte('publicado_em', inicioSemana.toISOString()),
    supabase.from('posts').select('id', { count: 'exact' }).in('status', ['aprovado', 'agendado']),
    supabase.from('posts')
      .select('id, texto, tema_nome, status, data_agendada, publicado_em, imagem_url')
      .in('status', ['publicado', 'aprovado', 'agendado'])
      .order('data_agendada', { ascending: false })
      .limit(5),
  ])

  return {
    pendentes: pendentes.count ?? 0,
    publicadosSemana: publicados.count ?? 0,
    agendados: agendados.count ?? 0,
    ultimosPublicados: ultimosPublicados.data ?? [],
  }
}

export default async function Dashboard() {
  const data = await getDashboardData()
  const agora = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })

  const stats = [
    {
      label: 'Aguardando Aprovação',
      value: data.pendentes,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      href: '/fila',
      acao: data.pendentes > 0 ? 'Revisar agora' : null,
    },
    {
      label: 'Agendados',
      value: data.agendados,
      icon: Calendar,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      href: '/calendario',
      acao: null,
    },
    {
      label: 'Publicados esta semana',
      value: data.publicadosSemana,
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-50',
      href: '/analytics',
      acao: null,
    },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-8">
        <p className="text-slate-500 text-sm capitalize">{agora}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Bom dia, Marcos 👋</h1>
        <p className="text-slate-500 mt-1">
          Aqui está o resumo do seu sistema de postagens automáticas.
        </p>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href, acao }) => (
          <Link href={href} key={label}>
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm">{label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                  {acao && (
                    <span className="text-xs text-blue-600 font-medium mt-2 block">
                      {acao} →
                    </span>
                  )}
                </div>
                <div className={`${bg} p-3 rounded-xl`}>
                  <Icon size={22} className={color} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Alerta se há posts pendentes */}
      {data.pendentes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-800 font-medium text-sm">
              Você tem {data.pendentes} post{data.pendentes > 1 ? 's' : ''} aguardando aprovação
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              Aprove antes das 14h para garantir a publicação automática de amanhã.
            </p>
          </div>
          <Link
            href="/fila"
            className="bg-amber-500 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors shrink-0"
          >
            Revisar agora
          </Link>
        </div>
      )}

      {/* Últimas atividades */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Atividade Recente</h2>
          <Link href="/fila" className="text-blue-600 text-sm hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {data.ultimosPublicados.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Zap size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum post ainda.</p>
              <p className="text-slate-400 text-xs mt-1">
                O sistema irá gerar posts automaticamente às 9h nos dias úteis.
              </p>
            </div>
          ) : (
            data.ultimosPublicados.map((post: any) => (
              <div key={post.id} className="px-6 py-4 flex items-center gap-4">
                {post.imagem_url ? (
                  <img
                    src={post.imagem_url}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{post.texto.slice(0, 80)}...</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {post.tema_nome} •{' '}
                    {post.data_agendada
                      ? format(new Date(new Date(post.data_agendada).getTime() - 3 * 60 * 60 * 1000), "dd/MM 'às' HH:mm")
                      : '—'}
                  </p>
                </div>
                <StatusBadge status={post.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    pendente:   { label: 'Pendente',   classes: 'bg-amber-100 text-amber-700' },
    aprovado:   { label: 'Aprovado',   classes: 'bg-blue-100 text-blue-700' },
    agendado:   { label: 'Agendado',   classes: 'bg-blue-100 text-blue-700' },
    publicado:  { label: 'Publicado',  classes: 'bg-green-100 text-green-700' },
    rejeitado:  { label: 'Rejeitado',  classes: 'bg-red-100 text-red-700' },
    erro:       { label: 'Erro',       classes: 'bg-red-100 text-red-700' },
  }
  const s = map[status] ?? { label: status, classes: 'bg-slate-100 text-slate-700' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.classes}`}>
      {s.label}
    </span>
  )
}
