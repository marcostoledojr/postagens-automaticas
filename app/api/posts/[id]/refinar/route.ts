import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { texto, instrucao } = await req.json()

  if (!texto || !instrucao) {
    return NextResponse.json({ erro: 'texto e instrucao são obrigatórios' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Você é um editor de posts para LinkedIn da Oficina1, empresa especializada em TOTVS Protheus.
Sua tarefa é ajustar um post existente seguindo a instrução do usuário, mantendo:
- A voz, tom e estrutura originais
- O gancho inicial
- O CTA final (exatamente como está)
- As hashtags (não altere)
- ZERO emojis, ZERO bullets, ZERO markdown
- Parágrafos curtos separados por linha em branco
- Entre 200-300 palavras no total

Retorne APENAS o texto ajustado, sem explicações, sem aspas, sem prefácio.`,
      messages: [
        {
          role: 'user',
          content: `Instrução de ajuste: ${instrucao}\n\nTexto atual do post:\n${texto}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ erro: `Anthropic API error: ${res.status} - ${err}` }, { status: 500 })
  }

  const data = await res.json()
  const textoRefinado = data.content?.[0]?.text ?? ''
  return NextResponse.json({ texto: textoRefinado.trim() })
}
