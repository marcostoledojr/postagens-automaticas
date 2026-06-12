import { NextRequest, NextResponse } from 'next/server'
import { gerarPostsParaAmanha } from '@/lib/motor-geracao'
import { buscarTema } from '@/lib/busca-web'
import { gerarTextoPost } from '@/lib/gerar-texto'
import { gerarImagem } from '@/lib/gerar-imagem'
import { createClient } from '@/lib/supabase-server'
import { addDays, setHours, setMinutes, setSeconds } from 'date-fns'

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

// POST /api/gerar
// { acao: 'zerar' }              — apenas apaga posts pendentes (< 1s)
// { acao: 'gerar_tema', tema_id, horario } — gera 1 post para 1 tema (< 60s)
// { dias: N }                    — gera para N dias à frente
export async function POST(req: NextRequest) {
  const supabase = createClient()

  try {
    const body = await req.json().catch(() => ({}))

    // ── Apenas apagar pendentes ──────────────────────────────────────
    if (body.acao === 'zerar') {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('status', 'pendente')

      if (error) throw new Error(`Erro ao apagar pendentes: ${error.message}`)
      return NextResponse.json({ ok: true, zerado: true })
    }

    // ── Gerar 1 post para 1 tema específico ─────────────────────────
    if (body.acao === 'gerar_tema' && body.tema_id) {
      const { data: tema, error: temaErr } = await supabase
        .from('temas')
        .select('*')
        .eq('id', body.tema_id)
        .single()

      if (temaErr || !tema) throw new Error('Tema não encontrado')

      const { data: configs } = await supabase.from('configuracoes').select('chave, valor')
      const configMap = Object.fromEntries((configs ?? []).map((c: any) => [c.chave, c.valor]))
      const instrucaoBase: string = configMap['instrucoes_gerais'] ?? ''

      // Horário e data fornecidos pelo cliente ou fallback para amanhã às 09:00
      const horario: string = body.horario ?? '09:00'
      const [hh, mm] = horario.split(':').map(Number)
      // Aceita data_iso explícita (vindo do endpoint de slots) ou usa amanhã
      const diaBase = body.data_iso ? new Date(body.data_iso) : addDays(new Date(), 1)
      // Vercel roda em UTC. Horários são BRT (UTC-3), então +3h para UTC correto.
      const dataSlot = setSeconds(setMinutes(setHours(diaBase, hh + 3), mm), 0)

      // Busca ângulos já usados nos últimos 30 dias para este tema (anti-repetição)
      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const { data: postsDoMes } = await supabase
        .from('posts')
        .select('texto')
        .eq('tema_id', tema.id)
        .gte('created_at', trintaDiasAtras.toISOString())
        .in('status', ['pendente', 'aprovado', 'agendado', 'publicado'])
        .order('created_at', { ascending: false })
        .limit(20)

      // Extrai a primeira linha (gancho) de cada post como representação do ângulo
      const angulosRecentes = (postsDoMes ?? [])
        .map((p: any) => p.texto?.split('\n').find((l: string) => l.trim().length > 0)?.trim())
        .filter(Boolean) as string[]

      const fontes = await buscarTema(tema.nome, tema.objetivo)
      const postGerado = await gerarTextoPost(tema, fontes, instrucaoBase, [], angulosRecentes)
      const imagem = await gerarImagem(tema.nome, tema.objetivo, postGerado.texto, postGerado.tipoPost)

      const { error: insertErr } = await supabase.from('posts').insert({
        tema_id: tema.id,
        tema_nome: tema.nome,
        texto: postGerado.texto,
        imagem_url: imagem.url,
        imagem_prompt: imagem.prompt,
        hashtags: postGerado.hashtags,
        fontes_pesquisa: fontes,
        status: 'pendente',
        data_agendada: dataSlot.toISOString(),
        horario_publicacao: horario,
      })

      if (insertErr) throw new Error(`Erro ao salvar post: ${insertErr.message}`)

      return NextResponse.json({ ok: true, tema: tema.nome, horario })
    }

    // ── Geração normal (múltiplos dias) ─────────────────────────────
    const dias = Number(body.dias ?? 1)
    const resultado = await gerarPostsParaAmanha({ diasAFrente: dias })
    return NextResponse.json(resultado)

  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
