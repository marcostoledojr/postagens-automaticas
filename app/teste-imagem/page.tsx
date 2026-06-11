'use client'
import { useState } from 'react'
import { Image, RefreshCw, Sparkles, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

const TIPOS = [
  { value: 'comercial',   label: 'Comercial (navy + verde neon)' },
  { value: 'autoridade',  label: 'Autoridade (fundo claro, minimalista)' },
]

const EXEMPLOS = [
  { label: 'Release TOTVS', tema: 'Release 12.1.2610 TOTVS Protheus', tipo: 'comercial', texto: 'Outubro chega com release novo. Isso deveria ser prioridade na sua agenda. Todo ano o ciclo se repete: a TOTVS solta uma nova versão do Protheus. Atualização de release no Protheus não é como instalar uma atualização de celular. É um evento com impacto direto em personalizações, integrações e rotinas críticas. Na @Oficina1 já conduzimos esse processo em ambientes com alto grau de personalização. Me manda uma DM ou comente RELEASE aqui.' },
  { label: 'ERP parou', tema: 'Quando o ERP para', tipo: 'comercial', texto: 'Quando o ERP para, não é hora de abrir um chamado. É hora de ligar para alguém que já viu aquilo antes. Nos últimos anos, percebi um padrão claro nas empresas que chegam até mim. A Oficina1 quase nunca entra como primeira opção. O que o time sênior da @Oficina1 traz não é mais um pacote de horas. Me manda uma DM ou comente PROTHEUS aqui.' },
  { label: 'IA no trabalho', tema: 'Inteligência Artificial no trabalho', tipo: 'autoridade', texto: 'A maioria das pessoas ainda usa IA como um buscador mais sofisticado. Pergunta, recebe resposta, copia, cola. Fim do processo. O momento em que IA começou a mudar meu trabalho de verdade foi quando parei de tratar as ferramentas como oráculo e comecei a tratar como um interlocutor. Eu trago contexto, histórico, tensão real do problema. O que percebo no mercado é uma divisão crescente entre quem usa IA para parecer produtivo e quem usa para pensar melhor.' },
  { label: 'Implantação ERP', tema: 'Implantei o ERP e agora', tipo: 'autoridade', texto: 'Implantei o ERP. E agora tenho mais dúvidas do que antes. Ouço isso com frequência. De gestores que passaram por implantações longas, investiram tempo e orçamento, e chegaram do outro lado sem a visibilidade que esperavam ter. O problema raramente está no sistema. O ERP funciona. O que falta é alguém que entenda profundamente como aquele sistema opera. A pergunta que faço quando converso com gestores nessa situação é simples: quem na sua empresa conhece o ERP com profundidade suficiente?' },
]

export default function TesteImagem() {
  const [tema, setTema]     = useState('')
  const [texto, setTexto]   = useState('')
  const [tipo, setTipo]     = useState<'comercial' | 'autoridade'>('comercial')
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<{ url: string; prompt: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tempoGeracao, setTempoGeracao] = useState<number | null>(null)

  async function gerar() {
    if (!tema.trim()) { setErro('Informe o tema.'); return }
    setGerando(true)
    setErro(null)
    setResultado(null)
    setTempoGeracao(null)
    const inicio = Date.now()

    try {
      const res = await fetch('/api/teste-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, texto, tipo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.erro ?? 'Erro desconhecido')
      setResultado({ url: json.url, prompt: json.prompt })
      setTempoGeracao(Math.round((Date.now() - inicio) / 1000))
    } catch (e: any) {
      setErro(e.message)
    }
    setGerando(false)
  }

  function carregarExemplo(ex: typeof EXEMPLOS[0]) {
    setTema(ex.tema)
    setTexto(ex.texto)
    setTipo(ex.tipo as any)
    setResultado(null)
    setErro(null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Image size={20} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Teste de Geração de Imagem</h1>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Flux Dev</span>
        </div>
        <p className="text-slate-500 text-sm">
          Valide a qualidade das imagens antes de usar nos posts. Use os exemplos prontos ou insira seu próprio conteúdo.
        </p>
      </div>

      {/* Exemplos rápidos */}
      <div className="mb-5">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Exemplos prontos</p>
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map(ex => (
            <button
              key={ex.label}
              onClick={() => carregarExemplo(ex)}
              className="text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Tema <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={tema}
              onChange={e => setTema(e.target.value)}
              placeholder="Ex: Release 12.1.2610 TOTVS Protheus"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Texto do post
              <span className="ml-2 text-xs text-slate-400 font-normal">— quanto mais completo, melhor a imagem</span>
            </label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Cole aqui o texto do post para que a IA escolha a imagem mais adequada ao conteúdo..."
              rows={6}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de post</label>
            <div className="space-y-2">
              {TIPOS.map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value={opt.value}
                    checked={tipo === opt.value}
                    onChange={() => setTipo(opt.value as any)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          <button
            onClick={gerar}
            disabled={gerando || !tema.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {gerando ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Gerando imagem via Flux Dev... (~20s)
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Gerar imagem
              </>
            )}
          </button>
        </div>

        {/* Resultado */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {resultado ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Imagem gerada{tempoGeracao ? ` em ${tempoGeracao}s` : ''}
                </span>
                <a href={resultado.url} target="_blank" rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <ExternalLink size={12} /> Abrir original
                </a>
              </div>

              <img
                src={resultado.url}
                alt="Imagem gerada"
                className="w-full aspect-square object-cover rounded-xl border border-slate-200 cursor-pointer"
                onClick={() => window.open(resultado.url, '_blank')}
              />

              <details className="text-xs">
                <summary className="text-slate-400 cursor-pointer hover:text-slate-600 font-medium">
                  Ver prompt usado
                </summary>
                <pre className="mt-2 text-slate-500 whitespace-pre-wrap leading-relaxed text-xs bg-slate-50 p-3 rounded-lg overflow-auto max-h-48">
                  {resultado.prompt}
                </pre>
              </details>

              <button
                onClick={gerar}
                disabled={gerando}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 border border-slate-200 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={13} /> Gerar novamente (variação)
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center">
              {gerando ? (
                <>
                  <RefreshCw size={32} className="text-blue-400 animate-spin mb-3" />
                  <p className="text-slate-500 text-sm">Gerando com Flux Dev...</p>
                  <p className="text-slate-400 text-xs mt-1">Aguarde ~15-25 segundos</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
                    <Image size={28} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm">A imagem aparecerá aqui</p>
                  <p className="text-slate-300 text-xs mt-1">Use um exemplo ou insira o tema ao lado</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-700">
          <strong>Como usar:</strong> Gere algumas imagens de teste para validar se o modelo e os prompts estão produzindo boas imagens.
          O logo da Oficina1 é adicionado automaticamente no canto inferior direito.
          Se a qualidade estiver boa, os novos posts gerados automaticamente usarão as mesmas configurações.
        </p>
      </div>
    </div>
  )
}
