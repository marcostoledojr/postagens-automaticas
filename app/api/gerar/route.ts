import { NextRequest, NextResponse } from 'next/server'
import { gerarPostsParaAmanha } from '@/lib/motor-geracao'

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
