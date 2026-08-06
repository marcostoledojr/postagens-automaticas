'use client'
import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, RefreshCw, Send, Mail, Edit3 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type EmailSemanal = {
  id: string
  semana_inicio: string
  semana_fim: string
  assunto: string
  corpo_html: string
  status: string
  destinatarios_total: number
  destinatarios_enviados: number
  destinatarios_erro: number
  erro_envio: string | null
  criado_em: string
  aprovado_em: string | null
  enviado_em: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando aprovação',
  aprovado: 'Aprovado — envia sábado',
  enviado: 'Enviado',
  erro: 'Erro',
  sem_conteudo: 'Sem conteúdo essa semana',
}

const STATUS_COR: Record<string, string> = {
  pendente: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-green-100 text-green-700',
  enviado: 'bg-slate-100 text-slate-600',
  erro: 'bg-red-100 text-red-600',
  sem_conteudo: 'bg-slate-100 text-slate-500',
}

export default function EmailSemanalPage() {
  const [emails, setEmails] = useState<EmailSemanal[]>([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [aprovando, setAprovando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [assuntoEdit, setAssuntoEdit] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/email-semanal?limit=12', { cache: 'no-store' })
    const data = await res.json()
    setEmails(data.emails ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function gerarAgora() {
    setGerando(true)
    const res = await fetch('/api/email-semanal/gerar', { method: 'POST' })
    const data = await res.json()
    if (!data.ok) alert(data.erro ?? 'Erro ao gerar')
    await carregar()
    setGerando(false)
  }

  async function aprovar(id: string) {
    setAprovando(id)
    await fetch(`/api/email-semanal/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovado' }),
    })
    await carregar()
    setAprovando(null)
  }

  async function salvarAssunto(id: string) {
    await fetch(`/api/email-semanal/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assunto: assuntoEdit }),
    })
    setEditando(null)
    await carregar()
  }

  async function enviarAgora(id: string) {
    if (!confirm('Enviar agora para todos os leads perdidos no Kommo? Essa ação não pode ser desfeita.')) return
    setEnviando(id)
    const res = await fetch(`/api/email-semanal/${id}/enviar`, { method: 'POST' })
    const data = await res.json()
    if (!data.ok) alert(data.erro ?? 'Erro ao enviar')
    await carregar()
    setEnviando(null)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail size={22} /> Email Semanal — Leads Perdidos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerado toda sexta a partir dos posts aprovados da semana. Aprove aqui para o envio de sábado acontecer sozinho.
          </p>
        </div>
        <button
          onClick={gerarAgora}
          disabled={gerando}
          className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={16} className={gerando ? 'animate-spin' : ''} />
          Gerar rascunho agora
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Carregando...</p>}
      {!loading && emails.length === 0 && (
        <p className="text-slate-500 text-sm">Nenhum email semanal ainda. Clique em "Gerar rascunho agora" ou aguarde a sexta-feira.</p>
      )}

      <div className="space-y-4">
        {emails.map(email => (
          <div key={email.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500">
                  Semana de {format(parseISO(email.semana_inicio), "dd 'de' MMM", { locale: ptBR })} a {format(parseISO(email.semana_fim), "dd 'de' MMM", { locale: ptBR })}
                </p>
                {editando === email.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={assuntoEdit}
                      onChange={e => setAssuntoEdit(e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-sm w-72"
                    />
                    <button onClick={() => salvarAssunto(email.id)} className="text-xs text-blue-600 font-medium">Salvar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{email.assunto}</p>
                    {email.status === 'pendente' && (
                      <button
                        onClick={() => { setEditando(email.id); setAssuntoEdit(email.assunto) }}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COR[email.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_LABEL[email.status] ?? email.status}
              </span>
            </div>

            {email.corpo_html && (
              <div className="max-h-64 overflow-y-auto bg-slate-50">
                <iframe
                  srcDoc={email.corpo_html.replaceAll('{{UNSUB_URL}}', '#')}
                  className="w-full"
                  style={{ height: '340px', border: 'none' }}
                />
              </div>
            )}

            {email.status === 'enviado' && (
              <div className="p-4 text-sm text-slate-600 border-t border-slate-100">
                Enviado para {email.destinatarios_enviados} de {email.destinatarios_total} destinatários
                {email.destinatarios_erro > 0 && ` (${email.destinatarios_erro} falharam)`}.
              </div>
            )}

            {email.status === 'erro' && email.erro_envio && (
              <div className="p-4 text-sm text-red-600 border-t border-red-100 bg-red-50 whitespace-pre-line">
                {email.erro_envio}
              </div>
            )}

            {(email.status === 'pendente' || email.status === 'aprovado') && (
              <div className="p-4 flex items-center gap-3 border-t border-slate-100">
                {email.status === 'pendente' && (
                  <button
                    onClick={() => aprovar(email.id)}
                    disabled={aprovando === email.id}
                    className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle size={16} /> Aprovar
                  </button>
                )}
                <button
                  onClick={() => enviarAgora(email.id)}
                  disabled={enviando === email.id || email.status !== 'aprovado'}
                  className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={email.status !== 'aprovado' ? 'Aprove antes de enviar' : 'Enviar agora, sem esperar o sábado'}
                >
                  <Send size={16} /> Enviar agora
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
