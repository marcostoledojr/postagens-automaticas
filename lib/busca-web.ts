/**
 * Busca informações relevantes na web sobre um tema específico
 * Usa a API do Serper (serper.dev) - barata e confiável
 */

type ResultadoBusca = {
  titulo: string
  url: string
  resumo: string
}

export async function buscarTema(tema: string, objetivo: string): Promise<ResultadoBusca[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.warn('SERPER_API_KEY não configurada. Usando dados simulados.')
    return resultadosSimulados(tema)
  }

  try {
    const query = construirQuery(tema, objetivo)
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'br',
        hl: 'pt',
        num: 5,
        tbs: 'qdr:d', // últimas 24h
      }),
    })

    if (!res.ok) throw new Error(`Serper API error: ${res.status}`)

    const data = await res.json()
    const resultados: ResultadoBusca[] = []

    // Resultados orgânicos
    if (data.organic) {
      for (const item of data.organic.slice(0, 3)) {
        resultados.push({
          titulo: item.title ?? '',
          url: item.link ?? '',
          resumo: item.snippet ?? '',
        })
      }
    }

    // Top stories (notícias)
    if (data.topStories) {
      for (const item of data.topStories.slice(0, 2)) {
        resultados.push({
          titulo: item.title ?? '',
          url: item.link ?? '',
          resumo: item.date ? `Publicado: ${item.date}` : '',
        })
      }
    }

    return resultados.slice(0, 5)
  } catch (err) {
    console.error('Erro na busca web:', err)
    return resultadosSimulados(tema)
  }
}

function construirQuery(tema: string, objetivo: string): string {
  const mapa: Record<string, string> = {
    'TOTVS':     'TOTVS Protheus novidades atualização 2025',
    'Protheus':  'TOTVS Protheus dicas implementação ERP',
    'IA':        'inteligência artificial negócios Brasil 2025',
    'Artificial': 'IA empresas tendências ferramentas 2025',
    'Oficina1':  'TOTVS Protheus cases sucesso ERP PME',
    'Comercial': 'gestão empresarial ERP benefícios ROI',
  }

  // Verifica se alguma palavra-chave do tema bate com o mapa
  for (const [chave, query] of Object.entries(mapa)) {
    if (tema.toLowerCase().includes(chave.toLowerCase())) {
      return query
    }
  }

  // Query genérica baseada no tema
  return `${tema} novidades tendências 2025 Brasil`
}

function resultadosSimulados(tema: string): ResultadoBusca[] {
  return [
    {
      titulo: `Tendências em ${tema} para 2025`,
      url: 'https://exemplo.com/tendencias',
      resumo: `As principais novidades e tendências relacionadas a ${tema} que estão transformando o mercado brasileiro.`,
    },
    {
      titulo: `Como ${tema} está impactando empresas`,
      url: 'https://exemplo.com/impacto',
      resumo: `Empresas brasileiras estão adotando novas práticas em ${tema} para se tornarem mais competitivas.`,
    },
  ]
}
