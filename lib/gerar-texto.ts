/**
 * Geração de texto para posts via Claude Haiku
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
}

// Exemplos de posts de alto desempenho para aprendizado
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

  const promptSistema = construirPromptSistema(instrucaoBase, exemplosAltoDesempenho)
  const promptUsuario = construirPromptUsuario(tema, fontes)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
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

  // Extrai hashtags do texto gerado e as que vieram do tema
  const hashtagsTexto = extrairHashtags(textoCompleto)
  const todasHashtags = Array.from(new Set([...tema.hashtags, ...hashtagsTexto]))

  // Remove hashtags do corpo do texto (ficarão separadas)
  const textoLimpo = textoCompleto.replace(/#\w+/g, '').trim()

  return {
    texto: textoLimpo + (tema.cta ? `\n\n${tema.cta}` : '') +
           (tema.mencoes?.length > 0 ? `\n\n${tema.mencoes.join(' ')}` : ''),
    hashtags: todasHashtags.slice(0, 8),
  }
}

function construirPromptSistema(instrucaoBase: string, exemplos: ExemploPost[]): string {
  let prompt = `${instrucaoBase}

REGRAS IMPORTANTES PARA POSTS NO LINKEDIN:
- Máximo 1300 caracteres no texto principal
- Comece com uma frase de impacto (dado, pergunta ou observação que prenda atenção)
- Use espaçamento entre parágrafos curtos (2-3 linhas cada)
- Seja direto e objetivo - sem enrolação
- Use linguagem natural, como se estivesse conversando com um colega de trabalho
- Nunca use bullet points com travessão (use números ou frases)
- Nunca use jargões corporativos vazios ("sinergia", "disruptivo", "mindset")
- NÃO inclua hashtags no meio do texto - apenas no final
- NÃO inclua emojis em excesso - máximo 2 por post
- O post deve gerar valor real: insight, dado, aprendizado ou provocação`

  if (exemplos.length > 0) {
    prompt += `\n\nEXEMPLOS DE POSTS QUE GERARAM ALTO ENGAJAMENTO (aprenda com o estilo):\n`
    for (const ex of exemplos.slice(0, 3)) {
      prompt += `\n---\n${ex.texto}\n(Score de engajamento: ${ex.score})\n`
    }
  }

  return prompt
}

function construirPromptUsuario(tema: Tema, fontes: FontePesquisa[]): string {
  const fontesTexto = fontes.map((f, i) =>
    `${i + 1}. ${f.titulo}\n   ${f.resumo}`
  ).join('\n')

  return `Escreva um post para o LinkedIn sobre o tema: "${tema.nome}"

OBJETIVO DO POST: ${tema.objetivo}
TOM: ${tema.tom}

INFORMAÇÕES RELEVANTES DO DIA (use como base, não copie):
${fontesTexto}

Escreva APENAS o texto do post (sem comentários adicionais, sem hashtags no corpo).
O post deve parecer escrito por uma pessoa real, não por uma IA.`
}

function extrairHashtags(texto: string): string[] {
  const matches = texto.match(/#\w+/g) ?? []
  return matches.map(h => h)
}
