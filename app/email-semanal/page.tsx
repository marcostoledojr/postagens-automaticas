'use client'
import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, RefreshCw, Send, Mail, Edit3, XCircle, RotateCcw, TestTube2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type EmailSemanal = {
  id: string
  semana_inicio: string
  semana_fim: string
  assunto: string
  paragrafo_abertura: string | null
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
  rejeitado: 'Rejeitado',
  sem_conteudo: 'Sem conteúdo essa semana',
}

const STATUS_COR: Record<string, string> = {
  pendente: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-green-100 text-green-700',
  enviado: 'bg-slate-100 text-slate-600',
  erro: 'bg-red-100 text-red-600',
  rejeitado: 'bg-red-100 text-red-600',
  sem_conteudo: 'bg-slate-100 text-slate-500',
}

export default function EmailSemanalPage() {
  const [emails, setEmails] = useState<EmailSemanal[]>([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [regenerando, setRegenerando] = useState<string | null>(null)
  const [aprovando, setAprovando] = useState<string | null>(null)
  const [rejeitando, setRejeitando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [enviandoTeste, setEnviandoTeste] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [assuntoEdit, setAssuntoEdit] = useState('')
  const [aberturaEdit, setAberturaEdit] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [destinatariosAbertos, setDestinatariosAbertos] = useState<string | null>(null)
  const [destinatarios, setDestinatarios] = useState<Record<string, { email: string; status: string; erro: string | null }[]>>({})

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

  async function regerar(id: string) {
    if (!confirm('Isso apaga o rascunho atual dessa semana e gera um novo do zero. Continuar?')) return
    setRegenerando(id)
    await fetch(`/api/email-semanal/${id}`, { method: 'DELETE' })
    const res = await fetch('/api/email-semanal/gerar', { method: 'POST' })
    const data = await res.json()
    if (!data.ok) alert(data.erro ?? 'Erro ao regerar')
    await carregar()
    setRegenerando(null)
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

  async function rejeitar(id: string) {
    if (!confirm('Rejeitar esse rascunho? Ele não será enviado sábado.')) return
    setRejeitando(id)
    await fetch(`/api/email-semanal/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejeitado' }),
    })
    await carregar()
    setRejeitando(null)
  }

  function abrirEdicao(email: EmailSemanal) {
    setEditando(email.id)
    setAssuntoEdit(email.assunto)
    setAberturaEdit(email.paragrafo_abertura ?? '')
  }

  async function salvarEdicao(id: string) {
    setSalvando(true)
    await fetch(`/api/email-semanal/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assunto: assuntoEdit, paragrafo_abertura: aberturaEdit }),
    })
    setSalvando(false)
    setEditando(null)
    await carregar()
  }

  async function enviarTeste(id: string) {
    setEnviandoTeste(id)
    const res = await fetch(`/api/email-semanal/${id}/teste`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      alert(`Teste enviado para ${data.email}`)
    } else {
      alert(data.erro ?? 'Erro ao enviar teste')
    }
    setEnviandoTeste(null)
  }

  async function verDestinatarios(id: string) {
    if (destinatariosAbertos === id) {
      setDestinatariosAbertos(null)
      return
    }
    if (!destinatarios[id]) {
      const res = await fetch(`/api/email-semanal/${id}/destinatarios`)
      const data = await res.json()
      setDestinatarios(prev => ({ ...prev, [id]: data.destinatarios ?? [] }))
    }
    setDestinatariosAbertos(id)
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
              <div className="flex-1">
                <p className="text-xs text-slate-500">
                  Semana de {format(parseISO(email.semana_inicio), "dd 'de' MMM", { locale: ptBR })} a {format(parseISO(email.semana_fim), "dd 'de' MMM", { locale: ptBR })}
                </p>
                {editando === email.id ? (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="text-xs text-slate-500">Assunto</label>
                      <input
                        value={assuntoEdit}
                        onChange={e => setAssuntoEdit(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Parágrafo de abertura</label>
                      <textarea
                        value={aberturaEdit}
                        onChange={e => setAberturaEdit(e.target.value)}
                        rows={3}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full mt-0.5"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => salvarEdicao(email.id)} disabled={salvando} className="text-xs text-blue-600 font-medium disabled:opacity-50">
                        {salvando ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button onClick={() => setEditando(null)} className="text-xs text-slate-500">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{email.assunto}</p>
                    {email.status === 'pendente' && (
                      <button onClick={() => abrirEdicao(email)} className="text-slate-400 hover:text-slate-700">
                        <Edit3 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ml-3 ${STATUS_COR[email.status] ?? 'bg-slate-100 text-slate-600'}`}>
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
                <div className="flex items-center justify-between">
                  <span>
                    Enviado para {email.destinatarios_enviados} de {email.destinatarios_total} destinatários
                    {email.destinatarios_erro > 0 && ` (${email.destinatarios_erro} falharam)`}.
                  </span>
                  <button onClick={() => verDestinatarios(email.id)} className="text-blue-600 text-xs font-medium shrink-0 ml-3">
                    {destinatariosAbertos === email.id ? 'Ocultar lista' : 'Ver quem recebeu'}
                  </button>
                </div>
                {destinatariosAbertos === email.id && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {(destinatarios[email.id] ?? []).map((d, i) => (
                      <div key={i} className="px-3 py-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-700">{d.email}</span>
                        <span className={d.status === 'enviado' ? 'text-green-600' : 'text-red-600'}>
                          {d.status === 'enviado' ? 'Enviado' : `Erro: ${d.erro ?? ''}`}
                        </span>
                      </div>
                    ))}
                    {(destinatarios[email.id] ?? []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-slate-400">Nenhum registro encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {email.status === 'erro' && email.erro_envio && (
              <div className="p-4 text-sm text-red-600 border-t border-red-100 bg-red-50 whitespace-pre-line">
                {email.erro_envio}
              </div>
            )}

            {(email.status === 'pendente' || email.status === 'aprovado' || email.status === 'rejeitado') && (
              <div className="p-4 flex items-center gap-3 border-t border-slate-100">
                {email.status === 'pendente' && (
                  <>
                    <button
                      onClick={() => aprovar(email.id)}
                      disabled={aprovando === email.id}
                      className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle size={16} /> Aprovar
                    </button>
                    <button
                      onClick={() => rejeitar(email.id)}
                      disabled={rejeitando === email.id}
                      className="flex items-center gap-2 bg-white border border-red-200 text-red-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={16} /> Rejeitar
                    </button>
                  </>
                )}
                {email.status === 'aprovado' && (
                  <button
                    onClick={() => enviarAgora(email.id)}
                    disabled={enviando === email.id}
                    className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    title="Enviar agora, sem esperar o sábado"
                  >
                    <Send size={16} /> Enviar agora
                  </button>
                )}
                {(email.status === 'pendente' || email.status === 'aprovado') && (
                  <button
                    onClick={() => enviarTeste(email.id)}
                    disabled={enviandoTeste === email.id}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    title="Manda uma cópia [TESTE] só pra marcos.toledo@oficina1.com.br"
                  >
                    <TestTube2 size={16} /> Enviar teste pra mim
                  </button>
                )}
                <button
                  onClick={() => regerar(email.id)}
                  disabled={regenerando === email.id}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCcw size={16} className={regenerando === email.id ? 'animate-spin' : ''} /> Regerar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
