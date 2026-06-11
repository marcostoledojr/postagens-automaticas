import { NextRequest, NextResponse } from 'next/server'
import { gerarPostsParaAmanha, gerarUmPorTema } from '@/lib/motor-geracao'
import { createClient } from '@/lib/supabase-server'

export const maxDuration = 60

// GET /api/gerar — gera posts para amanhã normalmente
export async function GET() {
  try {
    const resultado = await gerarPostsParaAmanha({ diasAFrente: 1 })
    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

// POST /api/gerar — opções avançadas
// body: { acao: 'zerar_e_gerar' } — apaga pendentes e gera 1 por tema
// body: { dias: N } — gera para N dias à frente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    if (body.acao === 'zerar_e_gerar') {
      const supabase = createClient()

      // Apaga todos os posts pendentes
      const { error: delError } = await supabase
        .from('posts')
        .delete()
        .eq('status', 'pendente')

      if (delError) throw new Error(`Erro ao apagar pendentes: ${delError.message}`)

      // Gera 1 post por tema ativo
      const resultado = await gerarUmPorTema()
      return NextResponse.json({ ...resultado, zerado: true })
    }

    const dias = Number(body.dias ?? 1)
    const resultado = await gerarPostsParaAmanha({ diasAFrente: dias })
    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
