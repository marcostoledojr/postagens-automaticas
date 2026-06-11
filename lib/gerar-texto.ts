/**
 * Geração de texto para posts via Claude Haiku
 * Baseado no Prompt Mestre Oficina1 / Marcos Toledo Jr — Junho 2026
 */

type Tema = {
  nome: string
  objetivo: string
  tom: string
  mencoes: string[]
  hashtags: string[]
  cta: string | null
}

type FontePesquisa = {
  titulo: string
  url: string
  resumo: string
}

type PostGerado = {
  texto: string
  hashtags: string[]
  tipoPost: 'comercial' | 'autoridade'
}

type ExemploPost = {
  texto: string
  score: number
}

export async function gerarTextoPost(
  tema: Tema,
  fontes: FontePesquisa[],
  instrucaoBase: string,
  exemplosAltoDesempenho: ExemploPost[] = []
): Promise<PostGerado> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

  const tipoPost = classificarTipoPost(tema)
  const promptSistema = construirPromptSistema(tipoPost, exemplosAltoDesempenho)
  const promptUsuario = construirPromptUsuario(tema, fontes, tipoPost)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: promptSistema,
      messages: [{ role: 'user', content: promptUsuario }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${res.status} - ${err}`)
  }

  const data = await res.json()
  const textoCompleto = data.content[0].text as string

  // Separa o texto das hashtags
  const { textoLimpo, hashtags } = separarTextoEHashtags(textoCompleto, tema.hashtags)

  return {
    texto: textoLimpo,
    hashtags: hashtags.slice(0, 6),
    tipoPost,
  }
}

function classificarTipoPost(tema: Tema): 'comercial' | 'autoridade' {
  const nomeLower = tema.nome.toLowerCase()
  if (
    nomeLower.includes('comercial') ||
    nomeLower.includes('oficina1') ||
    nomeLower.includes('totvs') ||
    nomeLower.includes('protheus') ||
    nomeLower.includes('erp')
  ) {
    return 'comercial'
  }
  return 'autoridade'
}

function construirPromptSistema(tipo: 'comercial' | 'autoridade', exemplos: ExemploPost[]): string {
  const base = `Você é Marcos Toledo Jr, Head Comercial da Oficina1, escrevendo um post para o LinkedIn.

QUEM É MARCOS TOLEDO JR:
Voz direta, consultiva, sem exageros. Fala de dores reais de quem vive o universo ERP. Não é vendedor, é um profissional que entende o problema do cliente por dentro. O tom é de conversa de corredor em evento de tecnologia, nunca de release de imprensa. Usuário ativo de ferramentas de IA como Claude e Gemini, trata isso como diferencial prático.

SOBRE A OFICINA1:
Consultoria boutique especializada em TOTVS Protheus há quase 20 anos. Mais de 1.300 projetos. Clientes como Motorola, ADP, Zebra Technologies, Porsche Cup e CCEE. Time estável com consultores de mais de 10 anos de casa. Sócios que atuam diretamente nos projetos. Especialidade em cenários críticos e complexos.

REGRAS OBRIGATÓRIAS DE FORMATO:
- Nunca usar hífen ou travessão como elemento de lista ou separação estética
- Nunca usar bullets ou listas numeradas — texto em linguagem corrida e fluida
- Nunca usar negrito em títulos de tópicos dentro do post
- Máximo de dois emojis por post, apenas quando absolutamente naturais
- Tamanho entre 200 e 350 palavras
- Hashtags com acento correto em português, entre quatro e seis ao final
- Links nunca no corpo do post

ESTRUTURA OBRIGATÓRIA:
1. PRIMEIRA LINHA (gancho): máximo 12 palavras, sem emoji, sem jargão vazio. Cria tensão, curiosidade ou identificação imediata.
2. DESENVOLVIMENTO: parágrafos curtos de duas a quatro linhas. Contexto e dor real que o público reconhece.
3. VIRADA: onde o insight ou posicionamento da Oficina1 entra com naturalidade, nunca como argumento de venda explícito.
4. CONCLUSÃO: a última frase deve ser a mais forte do post. Nunca terminar no vago. Provoca reflexão ou ação.
5. HASHTAGS: entre quatro e seis, relevantes, com acentos corretos em português

NUNCA USAR: linguagem de volume, ticket, chamado, commodity, "horas de consultoria", "suporte técnico". Sempre falar em segurança operacional, visibilidade de dados, continuidade de negócio e parceria estratégica.

REVISÃO INTERNA ANTES DE ESCREVER:
- O texto soa como escrito por Marcos ou parece gerado por IA?
- A última frase é impactante ou termina no vago?
- Existe hífen, travessão ou bullet usado de forma decorativa?
- Alguma frase contradiz o posicionamento boutique ou soa como commodity?`

  const tipoInstrucao = tipo === 'comercial'
    ? `\n\nTIPO DE POST — COMERCIAL OFICINA1:\nGera negócio diretamente. Fala de dores reais do Protheus, soluções da Oficina1, cases genéricos. Mencione @Oficina1 naturalmente quando a empresa for protagonista da solução ou insight. Termina com CTA leve para DM ou comentário com palavra-chave ("Me manda uma DM" ou "Comenta X aqui"). NÃO inclua assinatura no final.`
    : `\n\nTIPO DE POST — AUTORIDADE PESSOAL DO MARCOS:\nConstrói marca pessoal. Fala de liderança, IA, mercado, reflexões sobre carreira e negócios. Sem apelo comercial explícito. A Oficina1 NÃO aparece no texto. Tom reflexivo e provocador. NÃO inclua assinatura no final.`

  const exemplosTexto = exemplos.length > 0
    ? `\n\nEXEMPLOS DE POSTS APROVADOS (replique o estilo, nunca o conteúdo):\n${
        exemplos.slice(0, 2).map(e => `---\n${e.texto}\n`).join('\n')
      }`
    : `\n\nEXEMPLOS DE POSTS APROVADOS (replique o estilo, nunca o conteúdo):
---
"Ter um Protheus robusto e usá-lo só para emitir nota fiscal é como ter uma Ferrari e nunca sair da primeira marcha. É um cenário mais comum do que parece. O suporte existe, os chamados são atendidos, o sistema não cai. Mas funcionalidades como o Smart View, o Otimizador de Telas e a comunicação bancária via API ficam esquecidas porque ninguém tem braço técnico para ir além do apaga incêndio. O problema não é o Protheus. É o modelo de suporte. Na Oficina1 o nosso time sênior entra para virar essa chave. Qual foi a última vez que o seu Protheus recebeu uma melhoria real e não apenas um patch de correção? Me manda uma DM."
---
"O cliente chegou com o investimento aprovado. A gente pediu para esperar. Semana passada, durante uma reunião de implantação do Protheus que a Oficina1 está conduzindo, o cliente apresentou uma lista de licenças já definida. Antes de qualquer avanço, o nosso time fez o que sempre faz: parou para entender o ambiente real antes de validar o que estava no papel. O resultado foi uma economia de 30% no investimento que seria feito. Não foi mágica. Foi conhecimento do ambiente e disposição para questionar antes de assinar. Sua empresa está pagando pelo que usa ou pelo que achava que precisava?"`

  return base + tipoInstrucao + exemplosTexto
}

function construirPromptUsuario(tema: Tema, fontes: FontePesquisa[], tipo: 'comercial' | 'autoridade'): string {
  const fontesTexto = fontes.length > 0
    ? `\nINFORMAÇÕES RELEVANTES DO DIA (use como inspiração, não copie literalmente):\n${
        fontes.map((f, i) => `${i + 1}. ${f.titulo}\n   ${f.resumo}`).join('\n')
      }`
    : ''

  return `Escreva um post para o LinkedIn com o tema: "${tema.nome}"

OBJETIVO: ${tema.objetivo}
TOM: ${tema.tom}
${fontesTexto}

IMPORTANTE:
- Escreva APENAS o post completo, do gancho às hashtags
- Não adicione comentários, explicações ou notas antes ou depois
- O post deve parecer escrito por Marcos, nunca por uma IA
- NÃO inclua assinatura no final do post
- Coloque as hashtags na última linha, separadas por espaço`
}

function separarTextoEHashtags(textoCompleto: string, hashtagsTema: string[]): {
  textoLimpo: string
  hashtags: string[]
} {
  const linhas = textoCompleto.trim().split('\n')
  const ultimaLinha = linhas[linhas.length - 1] ?? ''

  let hashtags: string[] = []
  let textoLimpo = textoCompleto.trim()

  // Verifica se a última linha contém hashtags
  if (ultimaLinha.includes('#')) {
    hashtags = (ultimaLinha.match(/#[\wÀ-ÿ]+/g) ?? [])
    textoLimpo = linhas.slice(0, -1).join('\n').trim()
  }

  // Adiciona hashtags do tema se não tiverem
  const todasHashtags = Array.from(new Set([...hashtags, ...hashtagsTema]))

  return { textoLimpo, hashtags: todasHashtags }
}
