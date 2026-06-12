import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { texto, instrucao } = await req.json()

  if (!texto || !instrucao) {
    return NextResponse.json({ erro: 'texto e instrucao são obrigatórios' }, { status: 400 })
  }

  try {
    const message = await client.messages.create({
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
    })

    const textoRefinado = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ texto: textoRefinado.trim() })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
