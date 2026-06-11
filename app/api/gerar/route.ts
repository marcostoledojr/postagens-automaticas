import { NextRequest, NextResponse } from 'next/server'
import { gerarPostsParaAmanha } from '@/lib/motor-geracao'

export const maxDuration = 60 // segundos (Vercel hobby suporta até 60s)

export async function GET() {
  try {
    const resultado = await gerarPostsParaAmanha({ diasAFrente: 1 })
    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const dias = Number(body.dias ?? 1)

    const resultado = await gerarPostsParaAmanha({ diasAFrente: dias })

    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
